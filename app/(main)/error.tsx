"use client";

import { useEffect } from "react";
import LoadError from "@/components/UI/LoadError";
import { useI18n } from "@/components/features/I18nProvider";

/**
 * Una pagina dell'app che non si è potuta costruire (issue #124).
 *
 * Ci arriva ciò che SOLLEVA durante il render: un servizio di autenticazione che
 * non risponde (`getSessionUser()`, `getAccountContext()`) e le letture che non
 * hanno un ripiego onesto. Prima di questo file c'era la pagina di errore di
 * Next, in inglese e senza un comando; dopo la #124 è la scelta GIUSTA per quei
 * guasti — "non lo so" non deve diventare un logout o un numero inventato — e
 * meritava una frase tradotta e un "Riprova".
 *
 * ⚠️ `retry` e non `reset`: in Next 16 la prop si chiama così, e rifà il render
 * dei figli dal server (node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/error.md). Non avvolge il layout di `(main)`, quindi
 * sidebar e bottom nav restano: si può anche andare altrove.
 *
 * Il testo dell'errore non si mostra: in produzione Next lo sostituisce con un
 * messaggio generico, e in sviluppo sarebbe quello grezzo del server. Va nella
 * console, col `digest` che lo lega al log del server.
 */
export default function MainError({
	error,
	retry,
}: {
	error: Error & { digest?: string };
	retry: () => void;
}) {
	const { t } = useI18n();

	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div className="flex flex-col flex-1 min-h-dvh justify-center px-5 pb-34 lg:pb-12">
			<LoadError message={t.common.pageLoadFailed} onRetry={retry} />
		</div>
	);
}
