import { WifiOff } from "lucide-react";
import StatusScreen from "@/components/UI/StatusScreen";
import SubmitButton from "@/components/UI/SubmitButton";
import { getI18n } from "@/lib/i18n/server";

/**
 * Fallback offline (Fase 25). Registrata in `app/sw.ts` come pagina servita
 * dal service worker quando una NAVIGAZIONE (non una fetch di dati) fallisce
 * per mancanza di rete — è la parte "onesta" della scelta lasciata aperta
 * dall'issue #68 ("una schermata onesta, o niente"), possibile ora che il
 * service worker esiste comunque per l'installabilità.
 *
 * ⚠️ Zero dati, deliberatamente: qui non arriva né un saldo né un totale,
 * niente che possa essere letto come "l'ultimo numero visto" — è la stessa
 * regola per cui questo service worker non mette in cache nessuna pagina
 * applicativa. Un numero vecchio spacciato per attuale è il difetto che
 * l'intera fase esiste per evitare.
 *
 * Server component: `SubmitButton` con `href` renderizza un <Link> di Next,
 * che emette un <a> vero anche prima di qualunque idratazione — il link
 * "torna alla home" funziona anche se il JS della pagina non dovesse mai
 * caricarsi, che è precisamente lo scenario peggiore per cui questa pagina
 * esiste.
 */
export default async function OfflinePage() {
	const { t } = await getI18n();

	return (
		<div className="flex-1 flex flex-col justify-center px-5 pb-14">
			<StatusScreen
				icon={<WifiOff size={30} style={{ color: "var(--color-aka)" }} strokeWidth={1.6} />}
				title={t.pwa.offlineTitle}
				description={t.pwa.offlineDescription}
				tone="var(--color-aka)"
			>
				<SubmitButton label={t.pwa.offlineBack} href="/" />
			</StatusScreen>
		</div>
	);
}
