"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { analyze, IMPORT_MAX_BYTES } from "@/lib/import";
import type {
	GenericMapping,
	GroupDecision,
	ImportAnalysis,
	ImportOutcome,
	ImportSummary,
	ParsedRow,
} from "@/lib/import";

/**
 * L'import di transazioni da file (Fase 21, issue #35).
 *
 * ⚠️ **Il file viaggia DUE volte, ed è deliberato.** Una prima per l'anteprima,
 * una seconda insieme alle decisioni. L'alternativa — il client tiene le righe
 * già interpretate e le rimanda al momento di scrivere — è comoda e sbagliata:
 * ciò che finisce nel database dipenderebbe da un payload che il browser ha
 * avuto in mano, quindi un'anteprima innocua e una scrittura arbitraria
 * sarebbero la stessa richiesta. Qui **il client sceglie il significato, il
 * server tiene i fatti**: le righe le rilegge dal file, ogni volta.
 *
 * Il costo è trascurabile — l'estratto Trade Republic di tre anni pesa 40 KB.
 */

type AnalyzeResult = { data: ImportAnalysis } | { error: string };
type ImportResult = { data: ImportOutcome } | { error: string };

/** Il testo del file, con i controlli che devono precedere qualsiasi lettura. */
async function readFile(
	form: FormData,
	t: Awaited<ReturnType<typeof requireUser>>["t"],
): Promise<{ text: string; name: string } | { error: string }> {
	const file = form.get("file");

	if (!(file instanceof File) || file.size === 0) {
		return { error: t.errors.noFileSelected };
	}

	/*
	 * ⚠️ Il limite va controllato QUI e vale meno di quello del framework.
	 * `bodySizeLimit` in `next.config.ts` è 3 MB e scatta PRIMA che questa
	 * funzione esista, con un errore che non dice nulla di utile all'utente:
	 * questo controllo serve a dare un messaggio, non a difendere. Se un giorno
	 * si alzasse `IMPORT_MAX_BYTES` sopra il tetto del framework, il messaggio
	 * smetterebbe di comparire e tornerebbe l'errore muto — è la stessa catena
	 * di limiti da tenere allineati già documentata per l'avatar.
	 */
	if (file.size > IMPORT_MAX_BYTES) {
		return { error: t.import.errors.tooLarge };
	}

	// L'estensione e non il MIME: i browser mandano `text/csv`,
	// `application/vnd.ms-excel` o niente a seconda del sistema, quindi un
	// controllo sul tipo rifiuterebbe file validi su Windows.
	if (!/\.csv$/i.test(file.name)) {
		return { error: t.import.errors.notCsv };
	}

	return { text: await file.text(), name: file.name };
}

/** Legge il file e dice cosa ha capito: profilo riconosciuto, o colonne da mappare. */
export async function analyzeImport(form: FormData): Promise<AnalyzeResult> {
	const { user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const file = await readFile(form, t);
	if ("error" in file) return file;

	const mapping = parseMapping(form.get("mapping"));
	const analysis = analyze(file.text, mapping);

	if (analysis.kind === "letto" && analysis.result.rows.length === 0) {
		return { error: t.import.errors.empty };
	}

	return { data: analysis };
}

function parseMapping(raw: FormDataEntryValue | null): GenericMapping | undefined {
	if (typeof raw !== "string" || raw === "") return undefined;
	try {
		const parsed = JSON.parse(raw) as GenericMapping;
		if (typeof parsed?.date !== "number" || typeof parsed?.amount !== "number") return undefined;
		return {
			date: parsed.date,
			amount: parsed.amount,
			description: typeof parsed.description === "number" ? parsed.description : null,
		};
	} catch {
		return undefined;
	}
}

/**
 * Scrive l'import.
 *
 * Riceve il file, il conto a cui appartiene e **una decisione per gruppo**;
 * ricompone le righe e le passa a `import_transactions()`, che le scrive in una
 * transazione sola con `on conflict do nothing` sulla chiave di deduplica.
 */
export async function runImport(form: FormData): Promise<ImportResult> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const file = await readFile(form, t);
	if ("error" in file) return file;

	const accountId = form.get("accountId");
	if (typeof accountId !== "string" || accountId === "") {
		return { error: t.import.errors.noAccount };
	}

	const analysis = analyze(file.text, parseMapping(form.get("mapping")));
	if (analysis.kind !== "letto") return { error: t.import.errors.unknownFormat };

	const { rows, groups, unreadable } = analysis.result;

	let decisions: GroupDecision[];
	try {
		decisions = JSON.parse(String(form.get("decisions") ?? "[]")) as GroupDecision[];
	} catch {
		return { error: t.import.errors.badDecisions };
	}

	const byGroup = new Map(decisions.map((d) => [d.groupId, d]));

	// Ogni gruppo dev'essere deciso. Il pulsante lato client lo impedisce già,
	// ma una server action è raggiungibile con una POST diretta: il controllo si
	// rifà qui, come per ogni altra operazione di questa app.
	for (const g of groups) {
		const d = byGroup.get(g.id);
		if (!d || !g.allowed.includes(d.target)) return { error: t.import.errors.undecided };
	}

	// I conti e le categorie dell'utente, per validare le decisioni. Il filtro
	// esplicito su `user_id` è ridondante con la RLS ed è voluto: se un domani
	// quella policy venisse allentata, questa validazione non deve diventare
	// globale senza che nessuno se ne accorga.
	const [{ data: accounts, error: accErr }, { data: categories, error: catErr }] =
		await Promise.all([
			supabase.from("accounts").select("id, archived").eq("user_id", user.id),
			supabase.from("categories").select("id, type").eq("user_id", user.id),
		]);

	/*
	 * ⚠️ L'errore va guardato, o un guasto di rete si traveste da dato mancante.
	 * Con `data` a `null` le due mappe restano vuote, e i controlli qui sotto
	 * rispondono "Scegli il conto" o "La categoria non corrisponde al tipo" — due
	 * frasi che mandano a controllare cose sane. È la stessa classe corretta due
	 * volte nella 20b: due cause diverse non possono avere lo stesso messaggio
	 * solo perché arrivano dalla stessa `catch`.
	 */
	if (accErr || catErr) {
		console.error("[import] conti/categorie:", accErr?.message ?? catErr?.message);
		return { error: t.common.genericError };
	}

	const liveAccounts = new Map((accounts ?? []).map((a) => [a.id, a]));
	const categoryType = new Map((categories ?? []).map((c) => [c.id, c.type as string]));

	if (!liveAccounts.get(accountId) || liveAccounts.get(accountId)?.archived) {
		return { error: t.import.errors.noAccount };
	}

	const payload: BuiltRow[] = [];
	let ignored = 0;

	for (const row of rows) {
		const d = byGroup.get(row.groupId);
		if (!d || d.target === "ignora") {
			ignored++;
			continue;
		}

		const built = buildRow(row, d, accountId, t, liveAccounts, categoryType);
		if ("error" in built) return built;
		payload.push(built.row);
	}

	if (payload.length === 0) return { error: t.import.errors.nothingToImport };

	const { data, error } = await supabase.rpc("import_transactions", {
		p_account_id: accountId,
		p_source: analysis.result.source,
		p_filename: file.name,
		p_rows: payload,
	});

	/*
	 * ⚠️ Il messaggio di Postgres si LOGGA e non si mostra: una violazione di
	 * CHECK direbbe all'utente `new row for relation "transactions" violates
	 * check constraint "transactions_transfer_category_check"`, che non lo aiuta
	 * e racconta la forma dello schema. È la convenzione già fissata da
	 * `createAccount` e dai loader della home.
	 */
	if (error) {
		console.error("[import] import_transactions:", error.message);
		return { error: t.common.genericError };
	}

	const result = Array.isArray(data) ? data[0] : data;
	const imported: number = result?.inserted ?? 0;

	// La home, la lista movimenti, i conti e le analisi cambiano tutti.
	revalidatePath("/", "layout");

	return {
		data: {
			importId: result?.import_id ?? null,
			imported,
			skipped: payload.length - imported,
			ignored,
			unreadable,
		},
	};
}

/** Come una riga arriva a `import_transactions()`: i nomi sono quelli delle colonne. */
type BuiltRow = {
	account_id: string;
	to_account_id: string | null;
	type: string;
	amount: number;
	date: string;
	notes: string;
	category_id: string | null;
	investment_type: string | null;
	import_key: string;
};

/** Una riga del file più la decisione del suo gruppo = una riga di `transactions`. */
function buildRow(
	row: ParsedRow,
	d: GroupDecision,
	fileAccountId: string,
	t: Awaited<ReturnType<typeof requireUser>>["t"],
	accounts: Map<string, { id: string; archived: boolean }>,
	categoryType: Map<string, string>,
): { row: BuiltRow } | { error: string } {
	if (d.target === "trasferimento") {
		const other = d.counterpartAccountId;
		/*
		 * ⚠️ Anche la controparte dev'essere ATTIVA, non solo esistente. Il conto
		 * del file lo era già; questo lato no, ed è raggiungibile con una POST
		 * diretta. Scriverci sopra significherebbe mandare denaro su un conto
		 * escluso da ogni totale mostrato — lo stesso guasto silenzioso che la 20b
		 * ha chiuso vietando le ricorrenti sui conti archiviati.
		 */
		if (!other || !accounts.get(other) || accounts.get(other)?.archived) {
			return { error: t.import.errors.transferNeedsAccount };
		}
		/*
		 * ⚠️ `to_account_id <> account_id` è un CHECK del database
		 * (`transactions_dest_distinct_check`): senza questo controllo l'errore
		 * arriverebbe comunque, ma come violazione di vincolo — cioè un messaggio
		 * che manda a cercare il guasto nel posto sbagliato. È la lezione della
		 * review della 20b: due cause diverse non possono avere lo stesso
		 * messaggio solo perché arrivano dalla stessa catch.
		 */
		if (other === fileAccountId) return { error: t.import.errors.sameAccount };

		/*
		 * ⚠️ **Il verso, che è il punto meno intuitivo di tutta la fase.**
		 *
		 * Con il modello a una riga della 20b, `account_id` è l'ORIGINE. Una riga
		 * in entrata sul conto del file (un bonifico arrivato su Trade Republic)
		 * ha quindi come origine l'ALTRO conto: l'import scrive movimenti il cui
		 * `account_id` non è il conto dell'estratto che si sta importando.
		 *
		 * Invertendo i due, il saldo si muoverebbe dalla parte sbagliata su
		 * entrambi i conti — e nessun vincolo lo intercetterebbe, perché la riga
		 * sarebbe perfettamente valida.
		 */
		const incoming = row.direction === "entrata";
		return {
			row: {
				account_id: incoming ? other : fileAccountId,
				to_account_id: incoming ? fileAccountId : other,
				type: "trasferimento",
				amount: row.amount,
				date: row.date,
				notes: row.description,
				// Lo impone `transactions_transfer_category_check`: un
				// trasferimento non ha categoria.
				category_id: null,
				investment_type: null,
				import_key: row.key,
			},
		};
	}

	if (d.categoryId) {
		const type = categoryType.get(d.categoryId);
		// L'accoppiamento 1:1 fra tipo di movimento e tipo di categoria non è un
		// vincolo del database ma una regola dell'app (`TransactionForm` filtra
		// le categorie per tipo). Rispettarla qui evita di scrivere per import
		// combinazioni che il form non permetterebbe di creare a mano.
		if (!type || type !== d.target) return { error: t.import.errors.badCategory };
	}

	return {
		row: {
			account_id: fileAccountId,
			to_account_id: null,
			type: d.target,
			amount: row.amount,
			date: row.date,
			notes: row.description,
			category_id: d.categoryId,
			// `investment_type` ha senso solo su un investimento: portarselo
			// dietro su una spesa lascerebbe nel database un dato che non
			// descrive la riga che lo contiene.
			investment_type: d.target === "investimento" ? row.investmentType : null,
			import_key: row.key,
		},
	};
}

/**
 * Gli import già eseguiti, per poterli annullare anche dopo.
 *
 * ⚠️ Il conteggio delle righe si chiede al database e non è memorizzato: è la
 * stessa scelta di `spent`, `saved_amount` e `balance`. Qui conta il doppio,
 * perché le righe di un import possono essere cancellate a mano una per una —
 * un numero congelato al momento della scrittura mentirebbe subito dopo.
 *
 * ⚠️ La relazione embedded si chiama come la TABELLA e non come il vincolo
 * (`transactions(count)` invece di `transactions!transactions_import_id_fkey`).
 * Funziona perché fra `imports` e `transactions` c'è una FK sola, quindi non c'è
 * ambiguità da risolvere; con una seconda FK PostgREST pretenderebbe il nome del
 * vincolo, ed è la forma che si rompe in silenzio a una rinomina.
 */
export async function listImports(): Promise<{ data: ImportSummary[] } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const { data, error } = await supabase
		.from("imports")
		.select("id, filename, source, account_id, created_at, transactions(count)")
		.eq("user_id", user.id)
		.order("created_at", { ascending: false })
		.limit(20);

	if (error) {
		console.error("[import] listImports:", error.message);
		return { error: t.common.genericError };
	}

	return {
		data: (data ?? []).map((row) => ({
			id: row.id as string,
			filename: row.filename as string,
			source: row.source as ImportSummary["source"],
			accountId: row.account_id as string,
			createdAt: row.created_at as string,
			rows:
				(row.transactions as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
		})),
	};
}

/**
 * Annulla un import: cancella il lotto, e la cascade porta via le sue righe.
 *
 * ⚠️ Cancella movimenti VERI, comprese le modifiche fatte a mano dopo l'import.
 * È ciò che l'utente chiede quando dice "annulla", ed è il motivo per cui il
 * comando deve passare da una conferma, come `deleteGoal`.
 */
export async function undoImport(importId: string): Promise<{ ok: true } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const { error } = await supabase
		.from("imports")
		.delete()
		.eq("id", importId)
		.eq("user_id", user.id);

	if (error) {
		console.error("[import] undoImport:", error.message);
		return { error: t.common.genericError };
	}

	revalidatePath("/", "layout");
	return { ok: true };
}
