import { cookies } from "next/headers";
import { ACCOUNT_COOKIE, isAccountId } from "@/lib/accounts";

/**
 * Qual è il conto selezionato, e da dove viene.
 *
 * ⚠️ Sta in un file SEPARATO da `lib/accounts.ts` perché importa `next/headers`:
 * quel modulo è inutilizzabile da un client component, e `lib/accounts.ts` lo
 * importano `AccountSheet`, `TransactionForm`, `RecurringSheet`. È la stessa
 * divisione di `lib/i18n/config.ts` (client-safe) e `lib/i18n/server.ts`, ed è
 * anche la guardia che rende impossibile usarlo dalla parte sbagliata — per
 * questo non serve il pacchetto `server-only`.
 *
 * **L'URL è un'ISTRUZIONE, il cookie è una MEMORIA**, e la distinzione non è
 * filosofica: decide cosa fare quando il conto non esiste più (archiviato
 * altrove, cancellato, id inventato).
 *
 * - `?conto=` vince sempre: è una richiesta esplicita, magari da un link, e se
 *   punta a un conto che non è tuo la pagina deve **correggersi** — la home fa
 *   `redirect("/")`, o il chip direbbe "Tutti i conti" sopra dati filtrati su un
 *   id fantasma.
 * - il cookie invece si **dimentica**: se non è più valido si ignora e si mostra
 *   tutto. ⚠️ Ed è obbligatorio che sia così, non una gentilezza: col redirect
 *   si tornerebbe su `/`, dove il cookie verrebbe riletto, e da lì di nuovo su
 *   `/` — un ciclo infinito innescato dall'archiviazione di un conto.
 *
 * `fromUrl` è ciò che permette al chiamante di distinguere i due casi senza
 * riscoprire questo ragionamento.
 */
export async function getSelectedAccount(
	param?: string,
): Promise<{ id: string | null; fromUrl: boolean }> {
	if (isAccountId(param)) return { id: param, fromUrl: true };

	// ⚠️ Solo quando il parametro è ASSENTE. Un `?conto=` presente ma malformato
	// non deve far scattare la memoria: chi ha scritto quell'URL voleva un conto
	// preciso, e servirgliene un altro sarebbe più confondente che ignorarlo.
	if (param !== undefined) return { id: null, fromUrl: true };

	const stored = (await cookies()).get(ACCOUNT_COOKIE)?.value;
	return isAccountId(stored) ? { id: stored, fromUrl: false } : { id: null, fromUrl: false };
}
