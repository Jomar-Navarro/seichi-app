"use server";

import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ACCOUNT_TYPES, type Account, type AccountWithBalance } from "@/types";

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
	const { supabase, user, t } = await requireUser();
	if (!user) return { error: t.errors.notAuthenticated };

	if (archived) {
		const { count, error: countError } = await supabase
			.from("accounts")
			.select("id", { count: "exact", head: true })
			.eq("user_id", user.id)
			.eq("archived", false);

		if (countError) return { error: countError.message };
		if ((count ?? 0) <= 1) return { error: t.accounts.errors.lastAccount };
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
