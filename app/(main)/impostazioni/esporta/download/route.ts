import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { getTransactions } from "@/app/(main)/action";
import { getAttachmentCountsChecked } from "@/app/(main)/attachment-actions";
import { toCsv, type CsvValue } from "@/lib/export/csv";
import { TRANSACTION_PERIODS } from "@/lib/transaction-utils";
import { transactionCsvHeader, transactionCsvRows } from "@/lib/export/transactions-csv";
import { isAccountId, isUuid } from "@/lib/accounts";
import { lookup } from "@/lib/i18n/format";
import { consumeRateLimit } from "@/lib/rate-limit";
import { exportErrorRedirect } from "@/lib/export/download-response";
import type { ExportError } from "@/lib/export/download-error";
import { TRANSACTION_TYPES, type Transaction } from "@/types";
import { logServerError } from "@/lib/errors";

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

/**
 * ⚠️ Ogni errore torna alla pagina dell'export con un codice (#162), mai con
 * un testo: il comando è un `<a>` nudo, e un testo sarebbe una pagina bianca
 * senza tasto indietro nella PWA installata. Vedi `lib/export/download-error.ts`.
 */
const fail = (req: NextRequest, error: ExportError) => exportErrorRedirect(req, error);

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

	if (badFilter) return fail(req, { target: "csv", code: "filtro" });

	// I nomi dei conti si risolvono da una mappa e non con una join: la relazione
	// embedded di PostgREST si chiama come il VINCOLO
	// (`accounts!transactions_account_owner_fkey`), quindi si romperebbe in
	// silenzio alla prossima rinomina. Stessa scelta della lista movimenti.
	//
	// La categoria del filtro si verifica nello stesso giro (#124, vedi sotto):
	// le due letture sono indipendenti.
	const [{ data: accounts, error: accountsError }, categoryRes] = await Promise.all([
		supabase.from("accounts").select("id, name").eq("user_id", user.id),
		categoria !== ""
			? supabase.from("categories").select("id").eq("id", categoria).eq("user_id", user.id).maybeSingle()
			: null,
	]);

	if (accountsError) {
		logServerError("[export] conti:", accountsError.message);
		return fail(req, { target: "csv", code: "lettura" });
	}

	const accountName = new Map((accounts ?? []).map((a) => [a.id, a.name]));

	/*
	 * ⚠️ Un conto o una categoria ben formati ma NON dell'utente producevano un
	 * CSV vuoto (#124). Il controllo di forma qui sopra li lasciava passare, e la
	 * RLS poi restituiva zero righe: il file scaricato diceva "nessun movimento"
	 * su quel conto — la stessa affermazione falsa che il rifiuto dei filtri
	 * malformati esiste per impedire, arrivata dalla porta accanto. Un id
	 * cancellato altrove nel frattempo è lo stesso caso.
	 *
	 * Il conto si verifica sulla mappa che serve comunque per i nomi; la
	 * categoria con una query sua, minuscola, solo quando il filtro c'è.
	 */
	if (conto !== "" && !accountName.has(conto)) return fail(req, { target: "csv", code: "filtro" });

	if (categoryRes) {
		if (categoryRes.error) {
			logServerError("[export] categoria:", categoryRes.error.message);
			return fail(req, { target: "csv", code: "lettura" });
		}
		if (!categoryRes.data) return fail(req, { target: "csv", code: "filtro" });
	}

	// #161 · il tetto, dopo i filtri e prima di leggere i movimenti: una
	// richiesta con un filtro sbagliato non consuma un posto. Oltre il tetto si
	// torna alla pagina con l'attesa, che compone la frase (#162).
	const limit = await consumeRateLimit(supabase, "export");
	if ("error" in limit) {
		logServerError("[export] limite:", limit.error.code, limit.error.message);
		return fail(req, { target: "csv", code: "lettura" });
	}
	if (limit.wait > 0) return fail(req, { target: "csv", code: "limite", wait: limit.wait });

	const rows: CsvValue[][] = [transactionCsvHeader(t)];

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
			logServerError("[export] movimenti:", result.error);
			return fail(req, { target: "csv", code: "lettura" });
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
			logServerError("[export] conteggio ricevute incompleto");
			return fail(req, { target: "csv", code: "lettura" });
		}

		// Le righe le scrive `transactionCsvRows()`, la stessa funzione del CSV
		// dentro l'archivio completo (#162).
		rows.push(
			...transactionCsvRows(
				page.map((tx) => ({ ...tx, categoryName: tx.categories?.name ?? null })),
				{ accountName, attachmentCounts: counts, conto: conto || null, t },
			),
		);

		if (!result.hasMore) {
			const contoSlug = conto ? slug(accountName.get(conto) ?? "") : "";
			/*
			 * ⚠️ Il PERIODO nel nome (#124), come promette la Fase 23: tre export
			 * nella cartella Download devono distinguersi senza aprirli, e "ultimi 7
			 * giorni" e "tutto" fatti lo stesso giorno avevano lo stesso nome. È
			 * l'etichetta che l'utente ha scelto, nella sua lingua ("30-giorni",
			 * "all-time"): la data accanto dice da quando contare.
			 */
			const periodSlug = slug(
				lookup(t.transactions.periods, periodo, (label) => label, periodo),
			);
			/*
			 * ⚠️ La data viene dall'orologio del SERVER, che su Vercel è UTC: fra
			 * mezzanotte e le 2 ora italiana il nome porta il giorno prima. È
			 * accettato — a differenza dei confini di periodo dei budget (17a), qui
			 * lo scarto tocca un NOME DI FILE e non un calcolo, quindi non produce
			 * un numero sbagliato. Chiuderlo costerebbe un parametro in più da
			 * validare per un'etichetta.
			 */
			const stamp = new Date().toISOString().slice(0, 10);
			const name = ["seichi-movimenti", periodSlug, contoSlug, stamp].filter(Boolean).join("-");

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
	logServerError("[export] troppi giri: hasMore non si è mai chiuso");
	return fail(req, { target: "csv", code: "lettura" });
}
