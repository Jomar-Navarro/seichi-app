import type { ElementType } from "react";
import {
	LandmarkIcon,
	BanknoteIcon,
	PiggyBankIcon,
	TrendingUpIcon,
	WalletIcon,
} from "@/lib/seichi-icons";
import { lookup } from "@/lib/i18n/format";
import type { Dictionary } from "@/lib/i18n/dictionaries/it";
import type { AccountTypeId } from "@/types";

/**
 * La meccanica dei conti: icone e colori. **Le parole stanno nel dizionario**
 * (`t.accounts.types`), come per `TIPO_COLOR`, `BUDGET_PERIODS` e ogni altro
 * modulo di `lib/` dopo la Fase 19.
 *
 * ⚠️ Tutto ciò che sta qui è DECORATIVO, e non è un dettaglio: `accounts.type`
 * sceglie un'icona e un'etichetta, e nient'altro. Se da questo file uscisse mai
 * una decisione — "sul conto investimento i movimenti sono investimenti" — la
 * domanda *"questo movimento è un investimento?"* avrebbe due risposte, quella
 * di `transactions.type` e quella del conto. È la classe di difetto già pagata
 * tre volte in questo progetto (vedi CLAUDE.md, Fase 20).
 */
export const ACCOUNT_TYPE_ICON: Record<AccountTypeId, ElementType> = {
	corrente: LandmarkIcon,
	contanti: BanknoteIcon,
	risparmio: PiggyBankIcon,
	investimento: TrendingUpIcon,
};

/**
 * ⚠️ I colori qui NON seguono la semantica finanziaria dei tipi di transazione.
 * `--color-ao` significa "investimento" su un movimento; su un conto significa
 * soltanto "questa pastiglia è blu". Riusare la stessa scala era la tentazione
 * ovvia, ed è precisamente ciò che rimetterebbe in comunicazione due dimensioni
 * che la fase esiste per tenere separate.
 *
 * Restano vicini per riconoscibilità, ma l'utente può sovrascriverli
 * (`accounts.color`), che è la prova che non significano nulla.
 */
export const ACCOUNT_TYPE_COLOR: Record<AccountTypeId, string> = {
	corrente: "var(--color-ao)",
	contanti: "var(--color-midori)",
	risparmio: "var(--color-kin)",
	investimento: "var(--color-murasaki)",
};

/**
 * Ripiego per `type` NULL: la colonna è nullable, non ogni conto ha un tipo.
 *
 * ⚠️ Esportato apposta, perché nei componenti l'icona si prende indicizzando la
 * mappa (`ACCOUNT_TYPE_ICON[x] ?? ACCOUNT_ICON_FALLBACK`) e non chiamando una
 * funzione. La regola `react-hooks/static-components` segnala un componente
 * assegnato a una variabile maiuscola quando arriva da una CHIAMATA: non può
 * dimostrare che il valore sia stabile, e un componente ricreato a ogni render
 * perderebbe il proprio stato. Un accesso a mappa lo lascia passare, ed è la
 * forma già usata da `GoalCard` e `InvestimentiTab`.
 */
export const ACCOUNT_ICON_FALLBACK: ElementType = WalletIcon;
const FALLBACK_COLOR = "var(--color-kiri)";

/**
 * L'id di un conto ha la forma di un UUID?
 *
 * ⚠️ Serve in DUE punti che sembrano non avere niente in comune, e in entrambi
 * l'assenza del controllo produce un guasto diverso:
 *
 * - la **home** (`app/(main)/page.tsx`) passa `?conto=` a `dashboard_totals()`,
 *   che con `abc` solleva `22P02 invalid input syntax for type uuid`: il ramo
 *   d'errore sostituisce l'intera dashboard con "Errore", senza via d'uscita se
 *   non modificare l'URL a mano. Basta un link troncato.
 * - `getTransactions()` (Fase 20b) interpola il conto in una **stringa** di
 *   filtro PostgREST — `.or("account_id.eq.X,to_account_id.eq.X")` — e lì `.eq()`
 *   non fa da parametro: una virgola o un punto dentro il valore aggiunge
 *   condizioni al gruppo OR. Il danno è limitato (la RLS e il `.eq("user_id")`
 *   restano ANDed sopra, quindi si vedrebbero al più righe proprie filtrate
 *   male), ma è l'unico punto dell'app dove un valore dell'utente diventa
 *   SINTASSI invece che dato, e merita di essere chiuso dove nasce.
 *
 * Era una regex copiata dentro `page.tsx`: qui è una sola, e il secondo
 * chiamante non ha dovuto reinventarla — che è il modo in cui la prima volta si
 * dimentica.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAccountId(value: string | null | undefined): value is string {
	return typeof value === "string" && UUID_RE.test(value);
}

export function accountColor(type: string | null, custom?: string | null): string {
	if (custom) return custom;
	if (!type) return FALLBACK_COLOR;
	return ACCOUNT_TYPE_COLOR[type as AccountTypeId] ?? FALLBACK_COLOR;
}

/**
 * ⚠️ Passa da `lookup()` e non da `t.accounts.types[type]`.
 *
 * Il tipo dice cosa il database *dovrebbe* contenere, non cosa contiene: una
 * riga inattesa — scritta a mano dal SQL Editor, o rimasta dopo un allargamento
 * del CHECK — farebbe schiantare la pagina invece di mostrare un'etichetta
 * generica. `lookup()` il ripiego lo impone (regola emersa dal code-review
 * della Fase 19).
 */
export function accountTypeLabel(type: string | null, t: Dictionary): string {
	if (!type) return t.accounts.typeless;
	return lookup(t.accounts.types, type, (label) => label, t.accounts.typeless);
}
