"use server";

import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { plural } from "@/lib/i18n/format";
import { isAccountId } from "@/lib/accounts";
import { ACCOUNT_TYPES, type Account, type AccountWithBalance } from "@/types";
import type { SupabaseServerClient } from "@/lib/supabase/server";

/** Il limite è quello della colonna (`varchar(50)`): tagliarlo qui dà un messaggio. */
const NAME_MAX = 50;

/**
 * I soli colori scrivibili in `accounts.color`.
 *
 * ⚠️ Un ELENCO CHIUSO e non una regex: il valore viene interpolato in una
 * `color-mix()` inline, quindi "sembra un colore" non basta — deve essere uno
 * dei token del design system, o il tema chiaro/scuro smette di spostarlo.
 * Duplica `COLOR_CHOICES` di `AccountSheet` perché il client non può essere la
 * fonte di verità di un controllo che esiste per difendersi dal client.
 */
const COLOR_CHOICES = [
	"var(--color-ao)",
	"var(--color-midori)",
	"var(--color-kin)",
	"var(--color-murasaki)",
	"var(--color-aka)",
];

type AccountInput = {
	name: string;
	type: string | null;
	icon?: string | null;
	color?: string | null;
	initialBalance: number;
};

/**
 * Validazione condivisa da create e update.
 *
 * ⚠️ `type` accetta anche NULL: la colonna è nullable e un conto senza tipo è
 * legittimo — l'app ripiega su icona ed etichetta generiche. Un valore FUORI
 * dall'elenco invece no, e va fermato qui perché il `CHECK` del database darebbe
 * un errore di vincolo, corretto ma illeggibile.
 */
function validate(input: AccountInput, t: Awaited<ReturnType<typeof requireUser>>["t"]) {
	const name = input.name.trim();
	if (!name) return { error: t.accounts.errors.nameRequired };
	if (name.length > NAME_MAX) return { error: t.accounts.errors.nameTooLong };
	if (input.type !== null && !ACCOUNT_TYPES.includes(input.type as never)) {
		return { error: t.errors.invalidType };
	}
	/*
	 * ⚠️ Anche `color` va validato, e non era. È dato dell'utente — una POST
	 * diretta può scriverci qualsiasi cosa — e finisce interpolato GREZZO dentro
	 * `color-mix(in srgb, ${color} 16%, transparent)` in tre componenti. Un
	 * valore arbitrario rende la dichiarazione CSS invalida: la pastiglia perde
	 * lo sfondo su ogni schermata che mostra quel conto, senza un errore e senza
	 * modo di accorgersene dall'interfaccia. `type` era già protetto così;
	 * `color` era rimasto aperto.
	 */
	if (input.color != null && !COLOR_CHOICES.includes(input.color)) {
		return { error: t.accounts.errors.invalidColor };
	}
	return { name };
}

/**
 * I conti con il saldo, dalla vista `account_balances`.
 *
 * ⚠️ Si legge la VISTA, non la tabella: il saldo lo calcola Postgres. Sommarlo
 * qui vorrebbe dire scaricare ogni transazione di ogni conto a ogni vista della
 * pagina, cioè rifare l'errore che la `20260808` ha corretto per la home.
 *
 * ⚠️ Gli archiviati NON sono filtrati: la pagina li mostra in una sezione a
 * parte e il chiamante decide. Filtrare qui costringerebbe a una seconda query
 * per l'altra metà della stessa schermata.
 *
 * L'ordinamento è `created_at`, cioè l'ordine in cui l'utente li ha creati: il
 * primo conto — quello dell'onboarding o del backfill — resta in cima.
 */
export async function getAccounts(): Promise<
	{ data: AccountWithBalance[] } | { error: string }
> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const { data, error } = await supabase
		.from("account_balances")
		.select("*")
		.eq("user_id", user.id)
		.order("created_at", { ascending: true });

	if (error) return { error: error.message };

	// `numeric` arriva come stringa da PostgREST a seconda della scala: si
	// converte al confine, una volta, invece di sperare che sia già un numero.
	// È lo stesso accorgimento di `dashboard_totals` in action.ts.
	const accounts: AccountWithBalance[] = (data ?? []).map((a) => ({
		...a,
		initial_balance: Number(a.initial_balance),
		balance: Number(a.balance),
	}));

	return { data: accounts };
}

/**
 * Solo i campi che servono a NOMINARE un conto.
 *
 * ⚠️ Esiste perché `getAccounts()` legge la vista `account_balances`, il cui
 * `balance` è un `left join` su tutta `transactions` con `group by`: chiamarla
 * per riempire una tendina significa pagare l'aggregazione dell'intero archivio
 * per mostrare qualche nome, buttando via saldo, colore, icona e date. È
 * esattamente il costo che la `20260808` aveva tolto dalla home.
 */
export async function getAccountOptions(): Promise<
	{ data: Pick<Account, "id" | "name" | "archived">[] } | { error: string }
> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const { data, error } = await supabase
		.from("accounts")
		.select("id, name, archived")
		.eq("user_id", user.id)
		.order("created_at", { ascending: true });

	return error ? { error: error.message } : { data: data ?? [] };
}

export async function createAccount(input: AccountInput) {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const checked = validate(input, t);
	if ("error" in checked) return checked;

	// L'id torna al chiamante come in `createCategory`: serve a selezionare
	// subito il conto appena creato, per esempio nel form movimento.
	const { data, error } = await supabase
		.from("accounts")
		.insert({
			user_id: user.id,
			name: checked.name,
			type: input.type,
			icon: input.icon ?? null,
			color: input.color ?? null,
			initial_balance: input.initialBalance,
		})
		.select("id")
		.single();

	if (error) {
		// ⚠️ Il messaggio di Postgres si LOGGA e non si mostra: un overflow su
		// `numeric(10,2)` direbbe all'utente "A field with precision 10, scale 2…",
		// che non lo aiuta e racconta la forma dello schema. È la convenzione già
		// stabilita in `page.tsx` per i loader della home.
		console.error("[conti] createAccount:", error.message);
		return { error: t.accounts.errors.saveFailed };
	}
	revalidatePath("/", "layout");
	return { success: true as const, id: data.id as string };
}

/**
 * ⚠️ `initial_balance` è modificabile anche DOPO la creazione, e il mockup lo
 * nascondeva in modifica.
 *
 * Senza, un refuso diventa irreparabile: il conto non si cancella (per
 * decisione), il saldo deriva da lì, e l'unico rimedio sarebbe una transazione
 * fittizia — cioè sporcare i movimenti reali per riparare un campo di
 * configurazione. Vale il precedente della 17a: *correzione e cambio sono la
 * stessa operazione*, e l'intenzione non va chiesta all'utente.
 */
export async function updateAccount(id: string, input: AccountInput) {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	const checked = validate(input, t);
	if ("error" in checked) return checked;

	/*
	 * ⚠️ `icon` entra nella patch SOLO se il chiamante l'ha mandata.
	 *
	 * Con `icon: input.icon ?? null` un campo OPZIONALE e omesso diventava una
	 * cancellazione: `AccountSheet` non manda l'icona (non c'è ancora un picker),
	 * quindi ogni salvataggio azzerava la colonna. Oggi è latente perché nessuno
	 * la popola — ma il giorno in cui un picker o un import la scrivessero,
	 * rinominare un conto la cancellerebbe. Omesso significa "non toccare", non
	 * "metti a NULL".
	 */
	const patch: Record<string, unknown> = {
		name: checked.name,
		type: input.type,
		color: input.color ?? null,
		initial_balance: input.initialBalance,
	};
	if (input.icon !== undefined) patch.icon = input.icon;

	const { data, error } = await supabase
		.from("accounts")
		.update(patch)
		.eq("id", id)
		.eq("user_id", user.id)
		.select("id")
		.maybeSingle();

	if (error) {
		console.error("[conti] updateAccount:", error.message);
		return { error: t.accounts.errors.saveFailed };
	}
	// ⚠️ Un UPDATE su zero righe NON è un errore: senza questo controllo l'app
	// direbbe "salvato" a vuoto. È lo stesso motivo per cui `profiles` usa
	// sempre `upsert` e mai `update`.
	if (!data) return { error: t.accounts.errors.notFound };

	revalidatePath("/", "layout");
	return { success: true as const };
}

/**
 * Archiviare NON è eliminare, ed è tutta la differenza.
 *
 * ⚠️ Un conto non si cancella: `transactions.account_id` è `on delete no action`
 * proprio perché cancellarlo porterebbe via anni di movimenti reali. Un conto
 * chiuso in banca non fa sparire ciò che ci hai speso. Quindi `archived` è un
 * flag e i movimenti restano leggibili.
 *
 * ⚠️ Si rifiuta di archiviare l'ULTIMO conto attivo: ogni transazione deve
 * appartenere a un conto (`account_id` NOT NULL) e il form movimento non
 * avrebbe nulla da proporre. Il controllo sta qui e non nel database perché
 * "almeno una riga con archived = false" non è esprimibile come vincolo di
 * tabella senza un trigger.
 */
export async function setAccountArchived(id: string, archived: boolean) {
	const { supabase, user, t, locale } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	if (archived) {
		const { count, error: countError } = await supabase
			.from("accounts")
			.select("id", { count: "exact", head: true })
			.eq("user_id", user.id)
			.eq("archived", false);

		if (countError) return { error: countError.message };
		if ((count ?? 0) <= 1) return { error: t.accounts.errors.lastAccount };

		/*
		 * ⚠️ Le regole ricorrenti ATTIVE su questo conto impediscono
		 * l'archiviazione — debito lasciato aperto dalla 20a e chiuso qui.
		 *
		 * Lo scenario: regola "Netflix € 12" mensile sul conto *Contanti*.
		 * L'utente archivia Contanti. Ogni notte `generate_recurring_transactions()`
		 * copia `r.account_id` e scrive la transazione **su quel conto archiviato**.
		 * Il suo saldo scende ogni mese, ma gli archiviati sono esclusi dal "Saldo ·
		 * N conti attivi" della home e di `/conti`: **quel denaro sparisce da ogni
		 * numero che l'app mostra**, senza errori e senza segnali.
		 *
		 * È la stessa famiglia del difetto della #47 — un guasto isolato ma non
		 * registrato è invisibile — con l'aggravante che qui non c'è nemmeno un
		 * guasto: le transazioni si scrivono benissimo, solo in un posto che
		 * nessuna schermata somma.
		 *
		 * ⚠️ **Rifiutare, non avvisare**, e solo perché ora esiste una via
		 * d'uscita: `RecurringSheet` espone il conto, quindi la regola si può
		 * spostare. Fino a un momento fa non si poteva, e allora questo divieto
		 * sarebbe stato un vicolo cieco — per questo i due pezzi vanno insieme.
		 * Un avviso ignorabile lascerebbe accadere esattamente ciò che il
		 * controllo esiste per impedire.
		 *
		 * Solo le regole ATTIVE: una in pausa non genera nulla, quindi non c'è
		 * niente da impedire — e obbligare a cancellarla farebbe perdere una
		 * configurazione che l'utente potrebbe voler riprendere altrove.
		 */
		const { count: rules, error: rulesError } = await supabase
			.from("recurring_rules")
			.select("id", { count: "exact", head: true })
			.eq("user_id", user.id)
			.eq("account_id", id)
			.eq("active", true);

		if (rulesError) return { error: rulesError.message };
		if ((rules ?? 0) > 0) {
			return { error: plural(t.accounts.errors.hasRecurring, rules ?? 0, locale) };
		}
	}

	const { data, error } = await supabase
		.from("accounts")
		.update({ archived })
		.eq("id", id)
		.eq("user_id", user.id)
		.select("id")
		.maybeSingle();

	if (error) return { error: error.message };
	if (!data) return { error: t.accounts.errors.notFound };

	revalidatePath("/", "layout");
	return { success: true as const };
}

/**
 * UN conto, con il saldo — per la pagina di dettaglio `/conti/[id]` (issue #62).
 *
 * ⚠️ Stessa vista di `getAccounts()`, filtrata su un id: nessun numero nuovo,
 * nessuna somma rifatta qui. È il vincolo che la issue pone esplicitamente per
 * questa pagina — saldo, saldo iniziale e tipo vengono da `account_balances`,
 * i movimenti da `getTransactions({ conto })`, il segno da `amountSign()`, che
 * con un conto selezionato è già relativo a QUEL conto (20b).
 */
export async function getAccount(
	id: string,
): Promise<{ data: AccountWithBalance } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	// ⚠️ L'id arriva da un SEGMENTO DI URL: è input dell'utente quanto
	// `?conto=` lo è per `getTransactions`. Un valore non-UUID farebbe fallire
	// la query con un 22P02 invece di un "non trovato" pulito — si scarta
	// prima, come fa `isAccountId()` altrove.
	if (!isAccountId(id)) return { error: t.accounts.errors.notFound };

	const { data, error } = await supabase
		.from("account_balances")
		.select("*")
		.eq("id", id)
		.eq("user_id", user.id)
		.maybeSingle();

	// ⚠️ Le due cause restano SEPARATE, e non per pignoleria: la 20a aveva già
	// pagato il difetto di `assertOwnAccount()`, che rispondeva "Conto non
	// trovato" anche a un guasto di rete. Un errore di lettura vero e un id
	// che non esiste sono fatti diversi e non possono avere lo stesso testo
	// solo perché arrivano dallo stesso `if`.
	if (error) return { error: error.message };
	if (!data) return { error: t.accounts.errors.notFound };

	const account: AccountWithBalance = {
		...data,
		initial_balance: Number(data.initial_balance),
		balance: Number(data.balance),
	};

	return { data: account };
}

/**
 * Se un conto ha almeno un movimento agganciato — in uno qualunque dei
 * QUATTRO modi in cui questo schema può riferirlo.
 *
 * ⚠️ Non basta guardare `transactions.account_id`: `to_account_id`
 * (destinazione di un trasferimento), `recurring_rules.account_id` e
 * `imports.account_id` hanno TUTTI una FK `on delete no action` verso
 * `accounts` — vedi le Fasi 20b, 20a e 21 nello schema. Un conto referenziato
 * SOLO da una di queste resterebbe comunque bloccato al DELETE: guardarne una
 * sola direbbe "sì, puoi eliminarlo" e poi fallirebbe in silenzio sul vincolo.
 *
 * ⚠️ `imports` è il caso facile da dimenticare, perché non è un "movimento"
 * nel senso ovvio: è il LOTTO da cui un import proviene, non le transazioni
 * stesse. `deleteTransaction()` non tocca quella riga — solo `undoImport()`
 * lo fa, cancellandola e facendo cascare le sue transazioni — quindi un conto
 * può restare a zero transazioni pur avendo ancora un `imports.account_id`
 * che lo referenzia, se le righe sono state tolte una per una invece che con
 * "annulla import".
 *
 * ⚠️ Quattro query `count: "exact", head: true`, non `select("*")`: si chiede
 * solo l'header con il conteggio, senza trasferire una riga — il costo non
 * dipende da QUANTI movimenti ci siano, solo dal fatto che ce ne sia almeno
 * uno. Stesso accorgimento già usato in `setAccountArchived()`.
 */
async function hasAnyMovement(
	supabase: SupabaseServerClient,
	userId: string,
	accountId: string,
): Promise<{ data: boolean } | { error: string }> {
	const [asOrigin, asDestination, asRule, asImport] = await Promise.all([
		supabase
			.from("transactions")
			.select("id", { count: "exact", head: true })
			.eq("user_id", userId)
			.eq("account_id", accountId),
		supabase
			.from("transactions")
			.select("id", { count: "exact", head: true })
			.eq("user_id", userId)
			.eq("to_account_id", accountId),
		supabase
			.from("recurring_rules")
			.select("id", { count: "exact", head: true })
			.eq("user_id", userId)
			.eq("account_id", accountId),
		supabase
			.from("imports")
			.select("id", { count: "exact", head: true })
			.eq("user_id", userId)
			.eq("account_id", accountId),
	]);

	if (asOrigin.error) return { error: asOrigin.error.message };
	if (asDestination.error) return { error: asDestination.error.message };
	if (asRule.error) return { error: asRule.error.message };
	if (asImport.error) return { error: asImport.error.message };

	return {
		data:
			(asOrigin.count ?? 0) > 0 ||
			(asDestination.count ?? 0) > 0 ||
			(asRule.count ?? 0) > 0 ||
			(asImport.count ?? 0) > 0,
	};
}

/**
 * Quanti conti ATTIVI ha l'utente — il numero su cui poggia "non si può
 * restare a zero conti attivi", condiviso da `canDeleteAccount()` e
 * `deleteAccount()`. Scritta una volta per non farla divergere fra le due,
 * che è esattamente la classe di difetto per cui l'issue #62 nasce nel primo
 * finding: due punti che decidono la stessa cosa devono decidere la STESSA
 * cosa.
 */
async function countActiveAccounts(
	supabase: SupabaseServerClient,
	userId: string,
): Promise<{ data: number } | { error: string }> {
	const { count, error } = await supabase
		.from("accounts")
		.select("id", { count: "exact", head: true })
		.eq("user_id", userId)
		.eq("archived", false);

	if (error) return { error: error.message };
	return { data: count ?? 0 };
}

/**
 * Se QUESTO conto è eliminabile — cioè se `deleteAccount()` ha qualche
 * speranza di riuscire. Serve solo a decidere se MOSTRARE il comando: la
 * riverifica vera sta in `deleteAccount()`, che non si fida di questa lettura.
 *
 * ⚠️ Controlla ENTRAMBE le ragioni per cui `deleteAccount()` può rifiutare —
 * i movimenti E l'essere l'ultimo conto attivo — non solo la prima. Senza il
 * secondo controllo, un utente con un conto solo e zero movimenti (il caso
 * normale appena finito l'onboarding) vedrebbe comparire "Elimina", lo
 * toccherebbe, confermerebbe, e riceverebbe un rifiuto per un motivo diverso
 * da quello per cui il comando era comparso: un "Elimina" che il foglio ha
 * appena promesso di mostrare solo quando è vero.
 *
 * ⚠️ Chiamata UNA VOLTA, quando si apre il foglio "Modifica" — non a ogni
 * riga della lista `/conti`. Farlo per ogni riga costerebbe 4×N query a ogni
 * apertura della pagina (N conti attivi), sulla stessa pagina per cui questo
 * progetto ha già dimezzato le richieste della home (vedi "Costo delle
 * richieste a Supabase"). Il vassoio dello swipe mostra sempre "Archivia"; se
 * il conto risulta eliminabile, "Elimina" compare DENTRO il foglio.
 */
export async function canDeleteAccount(
	id: string,
): Promise<{ data: boolean } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };
	if (!isAccountId(id)) return { error: t.accounts.errors.notFound };

	const { data: account, error: accountError } = await supabase
		.from("accounts")
		.select("archived")
		.eq("id", id)
		.eq("user_id", user.id)
		.maybeSingle();

	if (accountError) return { error: accountError.message };
	if (!account) return { error: t.accounts.errors.notFound };

	if (!account.archived) {
		const activeCount = await countActiveAccounts(supabase, user.id);
		if ("error" in activeCount) return activeCount;
		if (activeCount.data <= 1) return { data: false };
	}

	const result = await hasAnyMovement(supabase, user.id, id);
	if ("error" in result) return result;
	return { data: !result.data };
}

/**
 * Elimina DAVVERO un conto — l'unico posto in questo file che lo fa.
 *
 * ⚠️ Possibile SOLO a zero movimenti, ed è per questo che è una funzione a sé
 * e non un terzo stato di `setAccountArchived()`: quella lascia sempre una
 * riga leggibile — "un conto chiuso in banca non fa sparire ciò che ci hai
 * speso" — questa la toglie. Le due convivono solo perché `on delete no
 * action` rende la prima impraticabile quando c'è qualcosa da proteggere, e
 * innocua — quindi permessa — quando non c'è niente da perdere.
 *
 * Il conteggio si VERIFICA PRIMA di tentare il DELETE, non ci si appoggia
 * all'errore della FK: un `23503` mostrato all'utente è un messaggio Postgres
 * grezzo, la stessa correzione già fatta una volta nella Fase 21.
 *
 * ⚠️ Rifiutato sull'ULTIMO conto ATTIVO, come `setAccountArchived()`: senza
 * conti attivi il form movimento non avrebbe nulla da proporre. Un conto già
 * archiviato non tocca quel conteggio — è già fuori dagli attivi — quindi
 * eliminarlo non ha bisogno dello stesso controllo.
 */
export async function deleteAccount(id: string): Promise<{ success: true } | { error: string }> {
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };
	if (!isAccountId(id)) return { error: t.accounts.errors.notFound };

	const { data: account, error: accountError } = await supabase
		.from("accounts")
		.select("archived")
		.eq("id", id)
		.eq("user_id", user.id)
		.maybeSingle();

	if (accountError) return { error: accountError.message };
	if (!account) return { error: t.accounts.errors.notFound };

	if (!account.archived) {
		const activeCount = await countActiveAccounts(supabase, user.id);
		if ("error" in activeCount) return { error: activeCount.error };
		if (activeCount.data <= 1) return { error: t.accounts.errors.lastAccount };
	}

	const movement = await hasAnyMovement(supabase, user.id, id);
	if ("error" in movement) return { error: movement.error };
	// ⚠️ Il messaggio è diverso da `lastAccount`: due cause diverse, due frasi
	// diverse, o l'utente cerca il rimedio sbagliato per l'una o per l'altra.
	if (movement.data) return { error: t.accounts.errors.hasMovements };

	const { error } = await supabase
		.from("accounts")
		.delete()
		.eq("id", id)
		.eq("user_id", user.id);

	if (error) {
		console.error("[conti] deleteAccount:", error.message);
		return { error: t.accounts.errors.saveFailed };
	}

	revalidatePath("/", "layout");
	return { success: true as const };
}
