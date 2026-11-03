import MovimentiClient from "@/components/features/MovimentiClient";
import { getSelectedAccount } from "@/lib/accounts-server";
import { getSessionUser } from "@/lib/auth";

/**
 * Movimenti (#148): un server component sottilissimo davanti alla lista.
 *
 * Fa due cose sole, nessuna delle quali tocca la rete:
 *
 * - legge il **conto ricordato** con `getSelectedAccount()`, la stessa funzione
 *   della home e con le stesse regole (`?conto=` è un'istruzione e vince, il
 *   cookie è una memoria). Fino alla #148 Movimenti non ereditava la memoria
 *   per scelta (Fase 20b, "la lista ha già la sua barra filtri"), e usando
 *   l'app si è visto che il filtro andava rimesso a ogni visita. La condizione
 *   che la 20b pone per un filtro che si ricorda resta rispettata: il chip del
 *   conto è sempre a schermo e la sua prima voce è "Tutti i conti";
 * - passa l'**id dell'utente**, a cui il client lega la copia ricordata della
 *   lista: vedi `MovimentiClient`.
 *
 * ⚠️ Niente letture qui: questo componente si rende a ogni navigazione verso la
 * pagina, e tutto ciò che aspetta ritarda il tocco sulla bottom nav. Le claims
 * si verificano in locale (`getSessionUser`), il cookie è nella richiesta. I
 * dati li chiede il client, in una richiesta sola (`getMovimentiData`), e
 * rientrando mostra subito quelli che aveva.
 *
 * ⚠️ Nessuna `key` su `MovimentiClient`: un `revalidatePath` dopo un
 * salvataggio rende di nuovo questo componente, e con una `key` legata al conto
 * la lista si rimonterebbe perdendo i filtri appena scelti.
 */
export default async function MovimentiPage({
	searchParams,
}: {
	searchParams: Promise<{ conto?: string }>;
}) {
	const { conto } = await searchParams;
	const [user, selected] = await Promise.all([getSessionUser(), getSelectedAccount(conto)]);

	return (
		<MovimentiClient
			userId={user?.id ?? ""}
			initialConto={selected.id ?? ""}
			contoFromUrl={selected.fromUrl}
		/>
	);
}
