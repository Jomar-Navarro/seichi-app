import { createClient } from "@/lib/supabase/server";
import { getFirstStepsVisibility } from "@/lib/account";
import { firstStepsFromRow, type FirstStepsState } from "@/lib/first-steps";

/**
 * Lo stato della card «Primi passi» per la home (#163), o `null` se la card
 * non va mostrata.
 *
 * ⚠️ La RPC parte SOLO se la card è aperta: la home ha già pagato per le sue
 * richieste (storia: costo-richieste-supabase), e a card chiusa resta a sette.
 * Lo stato di chiusura arriva dalla lettura del profilo che la home fa
 * comunque (`cache()`), quindi saperlo non costa niente.
 *
 * ⚠️ `null` anche su un guasto, mai le voci a «non fatto». Una lettura fallita
 * trasformata in «crea un obiettivo» inviterebbe a rifare ciò che esiste già:
 * il difetto della #124 (una lettura fallita non è uno stato vuoto). E non è un
 * `LoadError`: la card è un aiuto facoltativo, non il contenuto della pagina.
 *
 * Non solleva mai: la home la avvia PRIMA di aspettare le sue letture, e una
 * promise che rifiuta senza che nessuno la aspetti (la home può fermarsi su un
 * `LoadError` o un `redirect`) sarebbe un rifiuto non gestito.
 */
export async function loadFirstSteps(): Promise<FirstStepsState | null> {
	try {
		if ((await getFirstStepsVisibility()) !== "open") return null;

		const supabase = await createClient();
		const { data, error } = await supabase.rpc("first_steps").single();
		if (error) {
			console.error("[home] first_steps:", error.message);
			return null;
		}
		return firstStepsFromRow(data);
	} catch (error) {
		console.error("[home] primi passi:", error);
		return null;
	}
}
