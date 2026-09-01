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
 * ⚠️ **Sta nell'header, accanto alla campanella**, e ci è arrivato dopo due
 * tentativi sbagliati che vale la pena registrare perché la ragione è la stessa:
 *
 *   · **nel varco fra le card** non era allineato a niente — era *presso* un
 *     angolo, spostato di qualche pixel. E quella strada non poteva funzionare:
 *     l'angolo in alto a destra della card Investimenti **è** il centro
 *     geometrico della griglia 2×2, quindi «sopra gli investimenti» e «non in
 *     mezzo» si contendono lo stesso punto;
 *   · **dentro la card Investimenti**, allineato al suo padding, sembrava un
 *     controllo di quella card — cioè di *un numero*, non dell'app.
 *
 * Un assistente parla di tutto il quadro, quindi sta dove stanno gli altri
 * comandi globali: in alto a destra, con la campanella. È anche l'unico posto in
 * cui non deve difendersi da un ritaglio o da un contesto di impilamento —
 * l'header non ha né `overflow` né `backdrop-filter`, mentre `HomeHero` è
 * `overflow-x-auto` (ritaglierebbe: un asse non `visible` ritaglia anche
 * l'altro) e le card hanno `backdrop-blur`, che diventa il blocco contenitore
 * perfino dei discendenti `position: fixed` — cioè il pannello.
 *
 * ⚠️ L'icona è una **bussola**, non un fumetto di chat: in 24b si tocca, non si
 * scrive. Un fumetto prometterebbe una conversazione che il campo di testo —
 * che arriva con la 24c — ancora non offre. Quando arriverà, l'icona va
 * cambiata nello stesso commit.
 */
export default function CoachBubble({ accountFiltered = false }: { accountFiltered?: boolean }) {
	const { t } = useI18n();
	const [aperto, setAperto] = useState(false);

	return (
		<>
			<button
				type="button"
				onClick={() => setAperto(true)}
				aria-label={t.coach.bubbleLabel}
				/*
				 * ⚠️ Stessa geometria ESATTA della campanella — `w-10.5 h-10.5`,
				 * `rounded-[14px]`, `bg-surface`, `card-shadow` — perché le due
				 * pastiglie stanno affiancate e due misure diverse a due pixel di
				 * distanza si notano subito. Se la campanella cambia, questa la
				 * segue.
				 *
				 * 42px è sotto i 44 della checklist mobile (Fase 27), e resta così
				 * di proposito: il bersaglio è quello che l'app usa già per la
				 * campanella, e farne uno più grande accanto sarebbe peggio che
				 * essere coerenti. Il giorno in cui si alza, si alzano entrambe.
				 */
				className="w-10.5 h-10.5 rounded-[14px] flex items-center justify-center bg-surface border border-subtle card-shadow active:opacity-80 cursor-pointer"
			>
				<Compass size={18} strokeWidth={1.6} className="text-secondary" />
			</button>

			{/*
				⚠️ Il pannello si MONTA, non si nasconde: niente `isOpen` con dentro
				`if (!isOpen) return null`. Montare È l'azzeramento, quindi lo stato
				interno non sopravvive alla chiusura e non va ripulito a mano in un
				effetto — regola del progetto, vale per ogni sheet dell'app.
			*/}
			{aperto && (
				<CoachPanel accountFiltered={accountFiltered} onClose={() => setAperto(false)} />
			)}
		</>
	);
}

function CoachPanel({
	accountFiltered,
	onClose,
}: {
	accountFiltered: boolean;
	onClose: () => void;
}) {
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

						{/*
							⚠️ La bolla galleggia su una home che può essere FILTRATA per
							conto, ma il coach guarda tutto — e deve: i budget valgono su
							tutti i conti per costruzione (17a), le uscite fisse vengono
							dalle regole ricorrenti, e il disponibile deve coincidere con
							quello della card in impostazioni. Filtrarlo spezzerebbe tutte
							e tre.

							Senza dirlo, però, la home direbbe "Flusso € 120" e il coach un
							altro numero sotto la stessa parola, a un tocco di distanza:
							esattamente il difetto che questo progetto ha pagato con
							"Flusso netto" su /analisi. Si dichiara, come già fanno i budget
							con `acrossAllAccounts`.
						*/}
						{accountFiltered && (
							<p className="text-[11.5px] text-muted mt-4 leading-relaxed">
								{t.coach.acrossAccounts}
							</p>
						)}

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
