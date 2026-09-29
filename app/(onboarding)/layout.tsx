import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

/**
 * Chi ha già finito l'onboarding non ci rientra (#116).
 *
 * ⚠️ **Il segnale non è la sola `profiles.currency`**, malgrado sia il flag
 * dell'onboarding usato al login. La valuta si scrive al passo 2
 * (`savePreferences`), quindi "valuta presente" è vero anche per chi sta andando
 * da `/preference` a `/category`: con quel solo segnale l'ultimo passo
 * rimanderebbe in home a metà strada. Un onboarding è finito quando c'è la
 * valuta **e** almeno una categoria.
 *
 * Residuo voluto: chi ha finito scegliendo zero categorie può rientrare. Non ha
 * niente da perdere, e `saveCategories` può solo aggiungere.
 *
 * ⚠️ **Non è la stessa regola di login e `/callback`, e non deve esserlo.** Loro
 * rispondono a "l'onboarding va FATTO?" — valuta NULL → `/start`; questo layout
 * a "si può ANCORA fare?". Chi ha la valuta e zero categorie non viene spedito
 * nell'onboarding ma può entrarci: le due risposte non si contraddicono.
 * Allinearle a una sola definizione vorrebbe dire o rimandare in home a metà
 * strada (sopra), o costringere nell'onboarding chi l'ha finito senza categorie.
 *
 * ⚠️ **Questa NON è la protezione dei dati**, ed è scritto qui perché la
 * tentazione di trattarla così c'è. Un layout non si riesegue sulle navigazioni
 * interne né su indietro/avanti restaurati dalla cache del router (guida
 * autenticazione di Next 16, "Layouts and auth checks"): serve a non mostrare
 * l'onboarding a chi l'ha finito quando ci arriva da un URL o da un'altra
 * sezione. La garanzia è `saveCategories`, che dalla #116 non cancella più
 * niente.
 *
 * ⚠️ **Una lettura fallita non è "onboarding da fare".** Si solleva: la pagina
 * d'errore è sgradevole ma vera e ricaricabile, mentre mostrare l'onboarding a
 * chi l'ha finito sarebbe un'affermazione falsa sul suo account.
 */
export default async function OnboardingLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const user = await getSessionUser();
	if (!user) redirect("/sign");

	const supabase = await createClient();
	const [profile, categories] = await Promise.all([
		supabase.from("profiles").select("currency").eq("id", user.id).maybeSingle(),
		supabase
			.from("categories")
			.select("id", { count: "exact", head: true })
			.eq("user_id", user.id),
	]);

	if (profile.error || categories.error) {
		console.error(
			"[onboarding] controllo di accesso:",
			profile.error?.message ?? categories.error?.message,
		);
		throw new Error("onboarding: lettura del profilo non riuscita");
	}

	if (profile.data?.currency && (categories.count ?? 0) > 0) redirect("/");

	return children;
}
