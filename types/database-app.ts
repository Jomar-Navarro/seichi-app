/**
 * Il database come lo usa l'app: i tipi GENERATI (`types/database.ts`), più ciò
 * che il generatore non può sapere (#157). È il tipo che ricevono i client
 * Supabase (`createClient<AppDatabase>()`).
 *
 * Qui sta solo ciò che il catalogo di Postgres non dichiara, e ogni voce dice
 * da quale fatto del database viene:
 *
 *   - un CHECK che restringe un testo a pochi valori: il generatore traduce gli
 *     enum, non i CHECK;
 *   - gli argomenti di una funzione che possono essere NULL: Postgres non
 *     dichiara la nullabilità degli argomenti, e il generatore li vuole tutti
 *     non nulli;
 *   - le colonne di un `RETURNS TABLE` che possono essere NULL: stessa ragione.
 *
 * ⚠️ Mai una colonna che il database lascia NULL dichiarata qui non nulla:
 * sarebbe l'affermazione falsa che la #157 è nata per togliere. Se l'app conta
 * su un fatto che il database non garantisce, il posto giusto è una migration
 * (vedi `20261116_categories_not_null`), non questo file.
 *
 * ⚠️ Una migration che cambia uno di questi CHECK o di queste funzioni va
 * riletta qui: il generatore aggiorna `database.ts`, questo file no.
 */
import type { Database } from "./database";
import type { AccountTypeId } from "./index";

/** `T` con i campi di `U` sostituiti; un campo che `T` non ha è un errore. */
type Override<T, U extends { [K in keyof U]: K extends keyof T ? unknown : never }> = Omit<T, keyof U> & U;

type Public = Database["public"];
type Tables = Public["Tables"];
type Views = Public["Views"];
type Functions = Public["Functions"];

/** `accounts_type_check`: `corrente`, `contanti`, `risparmio`, `investimento` o NULL. */
type AccountsTable = Override<
	Tables["accounts"],
	{
		Row: Override<Tables["accounts"]["Row"], { type: AccountTypeId | null }>;
		Insert: Override<Tables["accounts"]["Insert"], { type?: AccountTypeId | null }>;
		Update: Override<Tables["accounts"]["Update"], { type?: AccountTypeId | null }>;
	}
>;

/**
 * La vista porta le colonne di `accounts`, con lo stesso CHECK sul tipo. Il
 * generatore dà ogni colonna calcolata di una vista come nullable; `balance` è
 * `initial_balance` (NOT NULL) + `coalesce(sum(…), 0)`, quindi non lo è mai.
 */
type AccountBalancesView = Override<
	Views["account_balances"],
	{ Row: Override<Views["account_balances"]["Row"], { type: AccountTypeId | null; balance: number }> }
>;

type AppFunctions = Override<
	Functions,
	{
		/** `p_account_id` NULL = tutti i conti. Obbligatorio anche così: vedi `getDashboardData`. */
		dashboard_totals: Override<
			Functions["dashboard_totals"],
			{ Args: Override<Functions["dashboard_totals"]["Args"], { p_account_id: string | null }> }
		>;
		/** `p_category_id` NULL = il budget globale; `p_amount` NULL = la lapide. */
		set_budget: Override<
			Functions["set_budget"],
			{ Args: Override<Functions["set_budget"]["Args"], { p_category_id: string | null; p_amount: number | null }> }
		>;
		/** Le righe di `budgets`: `category_id` NULL = il globale, `amount` NULL = la lapide. */
		budgets_at: Override<
			Functions["budgets_at"],
			{
				Returns: Override<
					Functions["budgets_at"]["Returns"][number],
					{ category_id: string | null; amount: number | null }
				>[];
			}
		>;
		/** `max`/`min` su `job_runs`: NULL finché il job non ha mai girato. */
		daily_job_health: Override<
			Functions["daily_job_health"],
			{
				Returns: Override<
					Functions["daily_job_health"]["Returns"][number],
					{ last_run_at: string | null; last_ok_at: string | null; watching_since: string | null }
				>[];
			}
		>;
	}
>;

export type AppDatabase = Override<
	Database,
	{
		public: Override<
			Public,
			{
				Tables: Override<Tables, { accounts: AccountsTable }>;
				Views: Override<Views, { account_balances: AccountBalancesView }>;
				Functions: AppFunctions;
			}
		>;
	}
>;

type AppPublic = AppDatabase["public"];

/** Una riga di una tabella o di una vista, come la vede l'app. */
export type Row<T extends keyof AppPublic["Tables"] | keyof AppPublic["Views"]> =
	T extends keyof AppPublic["Tables"]
		? AppPublic["Tables"][T]["Row"]
		: T extends keyof AppPublic["Views"]
			? AppPublic["Views"][T]["Row"]
			: never;

/** Ciò che si può scrivere in un `update` di una tabella. */
export type RowUpdate<T extends keyof AppPublic["Tables"]> = AppPublic["Tables"][T]["Update"];
