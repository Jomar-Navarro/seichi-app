"use client";

import { useSyncExternalStore } from "react";
import { MailCheck, TriangleAlert } from "lucide-react";
import StatusScreen from "@/components/UI/StatusScreen";
import SubmitButton from "@/components/UI/SubmitButton";
import { useI18n } from "@/components/features/I18nProvider";

/** Il fragment non cambia dopo l'atterraggio: non c'è nulla a cui iscriversi. */
const subscribe = () => () => {};

/**
 * Esito della conferma cambio email.
 *
 * L'errore va letto dal FRAGMENT (`#error=...`), non dalla query string: il
 * cambio email non è un flusso PKCE, e GoTrue restituisce gli errori dopo il
 * `#`. Il fragment non viene mai inviato al server, quindi un controllo lato
 * server vedrebbe sempre "nessun errore" e mostrerebbe "email confermata" anche
 * per un link scaduto — cioè la bugia peggiore possibile su un'operazione di
 * sicurezza.
 *
 * useSyncExternalStore e non useState+useEffect: l'URL è uno stato esterno a
 * React, e questo è l'hook fatto per leggerlo senza innescare render a cascata.
 */
export default function EmailConfirmedStatus() {
	const { t } = useI18n();
	const hash = useSyncExternalStore(
		subscribe,
		() => window.location.hash,
		() => null, // lato server il fragment non esiste
	);

	// Primo render (server e idratazione): non sappiamo ancora l'esito
	if (hash === null) {
		return <div className="flex-1" aria-busy="true" />;
	}

	const failed = new URLSearchParams(hash.slice(1)).has("error");

	if (failed) {
		return (
			<StatusScreen
				icon={<TriangleAlert size={30} style={{ color: "var(--color-aka)" }} strokeWidth={1.6} />}
				title={t.auth.emailConfirmed.failedTitle}
				// Messaggio nostro, non `error_description` dall'URL: quel testo è
				// controllabile da chi costruisce il link e verrebbe mostrato sotto il
				// marchio dell'app — un veicolo di phishing pronto all'uso.
				description={t.auth.emailConfirmed.failedDescription}
				tone="var(--color-aka)"
			>
				<SubmitButton label={t.auth.emailConfirmed.goToSettings} href="/impostazioni" />
			</StatusScreen>
		);
	}

	return (
		<StatusScreen
			icon={<MailCheck size={30} style={{ color: "var(--color-midori)" }} strokeWidth={1.6} />}
			title={t.auth.emailConfirmed.title}
			description={t.auth.emailConfirmed.description}
		>
			<SubmitButton label={t.auth.emailConfirmed.backToSettings} href="/impostazioni" />
		</StatusScreen>
	);
}
