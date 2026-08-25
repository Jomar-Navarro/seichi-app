import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { getTransactions } from "@/app/(main)/action";
import { getAttachmentCountsChecked } from "@/app/(main)/attachment-actions";
import { toCsv, type CsvValue } from "@/lib/export/csv";
import { TRANSACTION_PERIODS, amountSign } from "@/lib/transaction-utils";
import { isAccountId, isUuid } from "@/lib/accounts";
import { lookup } from "@/lib/i18n/format";
import { TRANSACTION_TYPES, type Transaction } from "@/types";

/**
 * Il file CSV dei movimenti (Fase 23a, issue #37).
 *
 * ## Perché un Route Handler e non una server action
 *
 * ⚠️ **Il fattore decisivo è il telefono.** Una server action dovrebbe
 * materializzare il file come stringa, rispedirlo nel canale RSC e farlo
 * scaricare dal client con un `<a download>` su un `blob:` — meccanismo
 * storicamente inaffidabile su iOS Safari, che è l'ambiente in cui questa app
 * viene davvero usata. Un `Content-Disposition: attachment` lo scarica il
 * browser da sé, ovunque, e senza tenere due copie del file in memoria.
 *
 * ⚠️ **Non viola la regola** *Server Actions per tutte le operazioni DB — mai
 * chiamate API REST dirette*: quella vieta al CLIENT di parlare con Supabase
 * senza passare dal server, non a noi di avere una rotta nostra — ce ne sono già
 * quattro, tutte auth. Sta scritto qui, o alla prossima rilettura sembra uno
 * strappo alla regola invece che un caso che la regola non contempla.
 *
 * ## Cosa deve fare per essere sicuro
 *
 * È un URL pubblico raggiungibile con una GET, quindi autentica da sé
 * (`requireUser()`), valida ogni filtro che arriva dalla query string, e
 * dichiara la risposta non memorizzabile: contiene l'intera storia finanziaria
 * di una persona.
 */

/**
 * Quante righe per giro.
 *
 * ⚠️ 500 e non 1000, per la stessa ragione per cui `SEARCH_SCAN_LIMIT` sta sotto
 * il tetto di PostgREST: `getTransactions` scopre se c'è dell'altro chiedendo
 * **una riga in più**, e a ridosso del limite esterno (Max rows = 1000 su questo
 * progetto) quella riga verrebbe tagliata insieme alle altre. `hasMore`
 * risulterebbe falso proprio nel giro in cui deve essere vero, e il file
 * finirebbe a metà **senza dirlo**.
 */
const EXPORT_CHUNK = 500;

/**
 * Un fermo contro un ciclo infinito, non un limite di prodotto.
 *
 * L'export non tronca mai in silenzio: il giro finisce quando una pagina torna
 * incompleta. Questo tetto esiste solo perché un `hasMore` sempre vero — un
 * difetto nostro, non un archivio grande — bloccherebbe il server. Se scatta si
 * risponde con un errore, **non con un file parziale**.
 */
const MAX_CHUNKS = 200;

/** I tipi di movimento ammessi nel filtro, dalla stessa fonte del form. */
const TYPE_IDS: string[] = TRANSACTION_TYPES.map((type) => type.id);

/** La risposta di errore: testo semplice, già tradotto dal dizionario. */
function fail(message: string, status: number) {
	return new NextResponse(message, {
		status,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

/**
 * Il nome del conto, ridotto a qualcosa che stia in un nome di file.
 *
 * Toglie i diacritici invece di sostituirli con un trattino: "Città" resta
 * leggibile, mentre un trattino al posto della lettera accentata spezzerebbe
 * proprio i nomi italiani.
 */
function slug(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 24);
}

export async function GET(req: NextRequest) {
	const { supabase, user, t, locale } = await requireUser();

	// Non un 401 secco: chi tocca questo link sta usando l'app, e una sessione
	// scaduta si risolve rientrando. È anche ciò che fa ogni pagina di `(main)`.
	if (!user) return NextResponse.redirect(new URL("/sign", req.url));

	const params = req.nextUrl.searchParams;
	const periodo = params.get("periodo") ?? "30d";
	const tipo = params.get("tipo") ?? "";
	const conto = params.get("conto") ?? "";
	const categoria = params.get("categoria") ?? "";

	/*
	 * ⚠️ Un filtro non riconosciuto viene RIFIUTATO, non ignorato — ed è
	 * l'opposto di ciò che fa la lista movimenti, deliberatamente.
	 *
	 * Là `isAccountId()` degrada a "nessun filtro" perché la barra resta a
	 * schermo a dire cosa si sta guardando: l'utente vede lo scarto e lo corregge.
	 * Un file scaricato non ha un'interfaccia che lo corregga, e un CSV con dentro
	 * le righe sbagliate — o vuoto — si legge come un fatto sui propri soldi.
	 */
	const badFilter =
		!(TRANSACTION_PERIODS as readonly string[]).includes(periodo) ||
		(tipo !== "" && !TYPE_IDS.includes(tipo)) ||
		(conto !== "" && !isAccountId(conto)) ||
		(categoria !== "" && !isUuid(categoria));

	if (badFilter) return fail(t.export.errors.badFilter, 400);

	// I nomi dei conti si risolvono da una mappa e non con una join: la relazione
	// embedded di PostgREST si chiama come il VINCOLO
	// (`accounts!transactions_account_owner_fkey`), quindi si romperebbe in
	// silenzio alla prossima rinomina. Stessa scelta della lista movimenti.
	const { data: accounts, error: accountsError } = await supabase
		.from("accounts")
		.select("id, name")
		.eq("user_id", user.id);

	if (accountsError) {
		console.error("[export] conti:", accountsError.message);
		return fail(t.export.errors.failed, 500);
	}

	const accountName = new Map((accounts ?? []).map((a) => [a.id, a.name]));

	const c = t.export.columns;
	const rows: CsvValue[][] = [
		[c.date, c.type, c.category, c.account, c.toAccount, c.amount, c.notes, c.attachments],
	];

	for (let chunk = 0; chunk < MAX_CHUNKS; chunk++) {
		const result = await getTransactions({
			tipo: tipo || undefined,
			periodo,
			conto: conto || undefined,
			categoria: categoria || undefined,
			limit: EXPORT_CHUNK,
			offset: chunk * EXPORT_CHUNK,
		});

		if ("error" in result) {
			console.error("[export] movimenti:", result.error);
			return fail(t.export.errors.failed, 500);
		}

		const page = (result.data as Transaction[]) ?? [];

		/*
		 * Il conteggio delle ricevute: spezza già in blocchi da 100 perché gli id
		 * viaggiano nella query string di una GET, e oltre ~215 l'URL viene
		 * rifiutato (Fase 22).
		 *
		 * ⚠️ La variante `Checked` e non quella della lista: là un conteggio
		 * mancante è una graffetta che non compare, qui diventerebbe uno **zero
		 * scritto in un file salvato**, cioè una lettura fallita travestita da
		 * fatto. Meglio nessun file di un file che afferma il falso.
		 */
		const { counts, complete } = await getAttachmentCountsChecked(page.map((tx) => tx.id));
		if (!complete) {
			console.error("[export] conteggio ricevute incompleto");
			return fail(t.export.errors.failed, 500);
		}

		for (const tx of page) {
			/*
			 * ⚠️ Il segno è quello che l'app MOSTRA, non uno inventato per il file:
			 * `amountSign()` guarda il conto filtrato, quindi un trasferimento è `−`
			 * sull'origine e `+` sulla destinazione. Senza conto selezionato resta
			 * senza segno, ed è positivo — la colonna "Tipo" accanto dice che è un
			 * trasferimento. Il file e la lista devono dire la stessa cosa, o
			 * diventano due risposte alla stessa domanda.
			 *
			 * ⚠️ Conseguenza dichiarata: SENZA un conto scelto, sommare la colonna
			 * Importo in un foglio di calcolo **sovrastima**, perché i trasferimenti
			 * vi entrano col segno più pur non essendo né entrate né uscite. Non è
			 * un difetto risolvibile in questa colonna: senza un punto di vista il
			 * segno di un trasferimento non esiste (è la stessa ragione per cui la
			 * lista lo lascia neutro), e azzerarlo o svuotare la cella perderebbe un
			 * dato vero. Chi vuole un totale sommabile esporta un conto per volta —
			 * là ogni riga ha un segno, e la somma riconcilia col saldo.
			 */
			const sign = amountSign(tx, conto || null);

			rows.push([
				// ⚠️ Solo la data, senza orario: `transactions.date` è un `timestamp
				// without time zone`, quindi tagliare i primi dieci caratteri è
				// leggerlo come è scritto, senza conversioni di fuso. È anche l'unica
				// parte che l'app mostra.
				tx.date.slice(0, 10),
				/*
				 * ⚠️ `t.transactionTypes[…].label` e NON `t.typesSingular`.
				 *
				 * Il secondo serve alla UI delle categorie e **non contiene**
				 * `trasferimento` né `disinvestimento` — deliberatamente, perché nessuno
				 * dei due può avere una categoria propria. Usandolo qui, `lookup()`
				 * ripiegava sull'id del database: la colonna Tipo diceva "Spesa" per
				 * cinque tipi e `trasferimento` minuscolo per il sesto — e in un file
				 * INGLESE sarebbe comparsa la parola italiana.
				 *
				 * `t.transactionTypes` descrive i tipi di MOVIMENTO, li ha tutti e sette,
				 * ed è la stessa etichetta che l'utente legge sulle card del modale.
				 * Il ripiego resta comunque, perché il tipo arriva dal database.
				 */
				lookup(t.transactionTypes, tx.type, (entry) => entry.label, tx.type),
				tx.categories?.name ?? "",
				accountName.get(tx.account_id) ?? "",
				tx.to_account_id ? (accountName.get(tx.to_account_id) ?? "") : "",
				sign === "−" ? -tx.amount : tx.amount,
				tx.notes ?? "",
				counts[tx.id] ?? 0,
			]);
		}

		if (!result.hasMore) {
			const contoSlug = conto ? slug(accountName.get(conto) ?? "") : "";
			/*
			 * ⚠️ La data viene dall'orologio del SERVER, che su Vercel è UTC: fra
			 * mezzanotte e le 2 ora italiana il nome porta il giorno prima. È
			 * accettato — a differenza dei confini di periodo dei budget (17a), qui
			 * lo scarto tocca un NOME DI FILE e non un calcolo, quindi non produce
			 * un numero sbagliato. Chiuderlo costerebbe un parametro in più da
			 * validare per un'etichetta.
			 */
			const stamp = new Date().toISOString().slice(0, 10);
			const name = ["seichi-movimenti", contoSlug, stamp].filter(Boolean).join("-");

			return new NextResponse(toCsv(rows, locale), {
				headers: {
					"Content-Type": "text/csv; charset=utf-8",
					"Content-Disposition": `attachment; filename="${name}.csv"`,
					// ⚠️ La storia finanziaria di una persona non deve finire nella cache
					// di un proxy o del browser. Stesso principio delle quattro rotte
					// dichiarate in `next.config.ts`.
					"Cache-Control": "private, no-store",
				},
			});
		}
	}

	// Ci si arriva solo se `hasMore` resta vero per centomila righe: è un difetto
	// nostro, non un archivio grande. Meglio un errore di un file monco.
	console.error("[export] troppi giri: hasMore non si è mai chiuso");
	return fail(t.export.errors.failed, 500);
}
