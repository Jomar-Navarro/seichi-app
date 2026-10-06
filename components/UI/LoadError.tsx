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
export default function LoadError({ message, onRetry, className = "" }: LoadErrorProps) {
	const { t } = useI18n();
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	function retry() {
		if (onRetry) onRetry();
		else startTransition(() => router.refresh());
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
