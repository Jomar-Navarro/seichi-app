"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/features/I18nProvider";

interface LoadErrorProps {
	/** Cosa NON si è riusciti a leggere, già tradotto: "Non è stato possibile caricare i movimenti." */
	message: string;
	/**
	 * Come riprovare. Assente = `router.refresh()`, cioè rifare il render del
	 * server: è il caso delle pagine server, che non possono passare una funzione
	 * a un client component (l'errore RSC che né `tsc` né la build vedono).
	 */
	onRetry?: () => void;
	/**
	 * `block` (predefinito) prende il posto di un'intera lista o pagina.
	 * `inline` sta sotto un campo di un modulo (#150): frase e «Riprova» sulla
	 * stessa riga, perché il resto del modulo resta usabile e non deve sparire
	 * sotto un blocco alto quanto mezzo schermo.
	 */
	variant?: "block" | "inline";
	className?: string;
}

/**
 * Una lettura fallita, detta come tale (issue #124).
 *
 * ⚠️ **Esiste per non somigliare a uno stato vuoto.** Una lettura fallita
 * passata come lista vuota diventava "Nessun investimento ancora — aggiungi una
 * transazione", o l'invito a creare una categoria: un'affermazione falsa sui
 * propri dati, con accanto un comando che porta a duplicarli. È la classe che
 * questo progetto insegue dalla 23a — *una lettura fallita travestita da fatto*.
 * Qui niente icona zen e niente invito: una frase che dice cosa non è arrivato,
 * e il comando che lo richiede di nuovo.
 */
export default function LoadError({
	message,
	onRetry,
	variant = "block",
	className = "",
}: LoadErrorProps) {
	const { t } = useI18n();
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	function retry() {
		if (onRetry) onRetry();
		else startTransition(() => router.refresh());
	}

	if (variant === "inline") {
		return (
			<div role="alert" className={`flex items-center gap-3 mt-1.5 ml-1 ${className}`}>
				<p className="flex-1 text-[12px] leading-relaxed text-secondary">{message}</p>
				<button
					type="button"
					onClick={retry}
					disabled={pending}
					// issue #69 — 44px di bersaglio anche nella forma compatta.
					className="shrink-0 min-h-11 px-4 rounded-full text-[12.5px] font-medium bg-surface card-shadow-ring text-secondary active:opacity-80 disabled:opacity-50 cursor-pointer"
				>
					{pending ? t.common.loading : t.common.retry}
				</button>
			</div>
		);
	}

	return (
		<div role="alert" className={`flex flex-col items-center text-center gap-4 px-6 py-10 ${className}`}>
			<p className="text-[13.5px] leading-relaxed text-secondary max-w-[300px]">{message}</p>
			<button
				type="button"
				onClick={retry}
				disabled={pending}
				// issue #69 — ~44px di altezza, come il comando di EmptyState.
				className="px-5.5 py-3.5 rounded-full text-[13px] font-medium bg-surface card-shadow-ring text-secondary active:opacity-80 disabled:opacity-50 cursor-pointer"
			>
				{pending ? t.common.loading : t.common.retry}
			</button>
		</div>
	);
}
