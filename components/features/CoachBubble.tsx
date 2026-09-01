"use client";

import { useEffect, useState } from "react";
import { Compass, X } from "lucide-react";
import { getCoachSnapshot } from "@/app/(main)/coach-actions";
import { useI18n } from "@/components/features/I18nProvider";
import { clientClock } from "@/lib/dates";
import { coachOpening, coachReplies } from "@/lib/coach";
import { fill } from "@/lib/i18n/format";
import type { CoachReply, CoachTopic } from "@/lib/coach";
import type { CoachSnapshot } from "@/types";

/**
 * Il coach in home (Fase 24b).
 *
 * ⚠️ **La bolla è sorella della griglia 2×2, non figlia di una card.** Due
 * ragioni, ed entrambe questo progetto le ha già pagate:
 *
 *   · dentro `HomeHero` verrebbe RITAGLIATA: quello è `overflow-x-auto`, e per
 *     specifica CSS un asse non `visible` ritaglia anche l'altro — è ciò che
 *     tagliava il `box-shadow` del carosello e le tendine della barra filtri;
 *   · dentro una card con `backdrop-filter` non potrebbe uscirne: quello crea
 *     un **contesto di impilamento**, e nessuno z-index scritto dentro lo
 *     scavalca. È la ragione per cui `Select` da solo non ce la faceva (Fase 21).
 *
 * ⚠️ L'icona è una **bussola**, non un fumetto di chat: in 24b si tocca, non si
 * scrive. Un fumetto prometterebbe una conversazione che il campo di testo —
 * che arriva con la 24c — ancora non offre. Quando arriverà, l'icona va
 * cambiata nello stesso commit.
 */
export default function CoachBubble() {
	const { t } = useI18n();
	const [aperto, setAperto] = useState(false);

	return (
		<>
			<button
				type="button"
				onClick={() => setAperto(true)}
				aria-label={t.coach.bubbleLabel}
				/*
				 * ⚠️ 48×48 e non meno: sopra i 44px di area toccabile della checklist
				 * mobile (Fase 27). La posizione orizzontale è stata scelta GUARDANDO
				 * lo schermo a 375px — galleggia sul bordo alto della card
				 * Investimenti, dove non copre né l'importo né l'etichetta.
				 */
				className="absolute z-20 left-[42%] top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center bg-deep border border-subtle modal-shadow"
			>
				<Compass size={20} className="text-secondary" />
			</button>

			{/*
				⚠️ Il pannello si MONTA, non si nasconde: niente `isOpen` con dentro
				`if (!isOpen) return null`. Montare È l'azzeramento, quindi lo stato
				interno non sopravvive alla chiusura e non va ripulito a mano in un
				effetto — regola del progetto, vale per ogni sheet dell'app.
			*/}
			{aperto && <CoachPanel onClose={() => setAperto(false)} />}
		</>
	);
}

function CoachPanel({ onClose }: { onClose: () => void }) {
	const { locale, t } = useI18n();
	const [snapshot, setSnapshot] = useState<CoachSnapshot | null>(null);
	const [errore, setErrore] = useState<string | null>(null);
	const [scelto, setScelto] = useState<CoachTopic | null>(null);

	/*
	 * ⚠️ I dati si leggono all'APERTURA, non al montaggio della home: chi non
	 * apre mai il coach non paga una query in più su una pagina che ne fa già
	 * sei (vedi "Costo delle richieste a Supabase").
	 *
	 * E l'orologio arriva da qui, dal browser: `getCoachSnapshot` vive sui
	 * confini di mese e sul server sarebbe UTC.
	 */
	useEffect(() => {
		let annullato = false;
		getCoachSnapshot(clientClock())
			.then((res) => {
				if (annullato) return;
				if ("error" in res) setErrore(res.error);
				else setSnapshot(res.data);
			})
			/*
			 * Una promise rifiutata senza questo ramo lascerebbe il pannello sul
			 * messaggio di attesa per sempre: un'attesa che non finisce e non si
			 * spiega, la classe corretta tre volte nella 24a.
			 */
			.catch((e) => {
				if (annullato) return;
				setErrore(e instanceof Error ? e.message : String(e));
			});
		return () => { annullato = true; };
	}, []);

	const righe = snapshot ? coachOpening(snapshot, locale, t) : [];
	const risposte: CoachReply[] = snapshot ? coachReplies(snapshot, locale, t) : [];
	const risposta = risposte.find((r) => r.topic === scelto) ?? null;

	return (
		<div className="fixed inset-0 z-50 flex items-end">
			<div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

			<div
				role="dialog"
				aria-modal="true"
				aria-label={t.coach.title}
				className="relative w-full flex flex-col rounded-t-4xl pt-3.5 px-6 pb-8 modal-shadow border-t border-l border-r border-subtle bg-modal backdrop-blur-2xl"
				style={{ maxHeight: "90dvh", overflowY: "auto" }}
			>
				<div className="w-10 h-1 rounded-full mx-auto mb-1 bg-modal-handle shrink-0" />

				<div className="flex items-start justify-between mt-4 mb-5 shrink-0">
					<div className="min-w-0">
						<h2 className="text-xl font-semibold">{t.coach.title}</h2>
						<p className="text-xs text-muted mt-0.5">{t.coach.subtitle}</p>
					</div>
					<button
						onClick={onClose}
						aria-label={t.coach.close}
						className="w-8 h-8 flex items-center justify-center rounded-xl bg-control border border-subtle shrink-0"
					>
						<X size={15} />
					</button>
				</div>

				{errore !== null ? (
					<p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-aka)" }}>
						{fill(t.coach.readFailed, { reason: errore })}
					</p>
				) : snapshot === null ? (
					<p className="text-[13px] text-muted">{t.coach.loading}</p>
				) : (
					<>
						{/* Il consiglio d'apertura: si legge senza toccare niente. */}
						<div className="flex flex-col gap-2.5">
							{righe.map((riga, i) => (
								<p key={i} className="text-[13.5px] leading-relaxed">
									{riga}
								</p>
							))}
						</div>

						<p className="text-[11px] uppercase tracking-wider text-muted mt-6 mb-2.5">
							{t.coach.hint}
						</p>

						{/*
							⚠️ `flex-wrap` e NON `overflow-x-auto`: la stessa regola della
							barra filtri (#9). Qui non ci sono tendine da ritagliare, ma lo
							scorrimento orizzontale nasconderebbe metà delle domande a chi
							non sa che il gesto esiste.
						*/}
						<div className="flex flex-wrap gap-2">
							{risposte.map((r) => {
								const attiva = r.topic === scelto;
								return (
									<button
										key={r.topic}
										type="button"
										onClick={() => setScelto(attiva ? null : r.topic)}
										aria-pressed={attiva}
										className={`px-3.5 py-2.5 rounded-2xl text-[12.5px] border transition-colors ${
											attiva
												? "bg-tab border-subtle font-medium"
												: "bg-control border-subtle text-secondary"
										}`}
									>
										{r.question}
									</button>
								);
							})}
						</div>

						{/*
							La risposta compare SOTTO le pastiglie, che restano a schermo: si
							passa da una domanda all'altra senza tornare indietro, e nessun
							comando "indietro" deve esistere per una cosa che non è mai
							sparita.
						*/}
						{risposta && (
							<div className="mt-4 rounded-2xl bg-card border border-subtle p-4">
								<p className="text-[13.5px] leading-relaxed">{risposta.answer}</p>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
