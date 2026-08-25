"use client";
import { Printer } from "lucide-react";
import { useI18n } from "./I18nProvider";

/**
 * Il comando che apre la finestra di stampa (Fase 23b).
 *
 * ⚠️ È un client component per una riga sola — `window.print()` — e non c'era
 * alternativa: il report è un server component, e la stampa è un gesto del
 * browser. Tenerlo minuscolo è ciò che permette al resto della pagina di
 * restare sul server.
 *
 * ⚠️ `no-print` su di sé: un pulsante "Stampa" stampato sopra il proprio
 * documento è la definizione di rumore. Vale per tutto il guscio dell'app —
 * vedi la regola in `globals.css`.
 *
 * Su iOS non esiste una stampante ma il gesto è lo stesso: la finestra di
 * stampa offre "Salva su File" (o Condividi → Stampa → pizzica per aprire),
 * ed è così che si ottiene il PDF senza che Seichi generi un solo byte.
 */
export default function PrintButton() {
	const { t } = useI18n();

	return (
		<button
			onClick={() => window.print()}
			className="no-print inline-flex items-center gap-2 h-10 px-4 rounded-2xl bg-card border border-subtle text-[13.5px] font-medium active:opacity-80"
		>
			<Printer size={15} className="text-secondary" />
			{t.analytics.report.print}
		</button>
	);
}
