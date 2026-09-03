import { TriangleAlert } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { fill, formatRelativeTime } from "@/lib/i18n/format";
import type { DailyJobHealth } from "@/lib/jobs";

/**
 * Avviso in cima alle pagine i cui dati dipendono dal job giornaliero (issue #47).
 *
 * ⚠️ **È un server component, e deve restarlo.** Legge la lingua con `getI18n()`
 * invece di `useI18n()`: marcandolo `"use client"` per usare l'hook, l'`icon`
 * passato da un genitore server diventerebbe una funzione attraverso il confine
 * RSC e la pagina si romperebbe a runtime — con i tipi corretti e la build verde.
 * È lo stesso inciampo già pagato da `SummaryCard` nella Fase 19.
 *
 * ⚠️ Ambra e non rosso. Nel design system il rosso ha un significato preso —
 * le uscite — e usarlo per un avviso di sistema confonderebbe i due. L'ambra è
 * già il livello "attenzione" delle barre budget all'80%.
 *
 * Non decide nulla: chi lo rende ha già stabilito che c'è un problema. Così la
 * soglia resta in un posto solo (`DAILY_JOB_STALE_HOURS`).
 */
export default async function JobHealthNotice({ health }: { health: DailyJobHealth }) {
	const { locale, t } = await getI18n();

	/**
	 * ⚠️ Titolo e suggerimento dipendono dall'AMBITO, non sono un testo solo.
	 * Con una frase unica un guasto delle sole notifiche faceva dichiarare che i
	 * movimenti ricorrenti non venivano registrati — mentre lo erano. La scelta
	 * la fa `getDailyJobHealth()`, dove sta anche la soglia.
	 */
	const scoped = t.jobHealth[health.scope];

	// L'ordine è per gravità decrescente: "mai girato" è peggio di "girato male",
	// che è peggio di "girato bene troppo tempo fa".
	//
	// ⚠️ `lastOkAt === null` con almeno un giro alle spalle significa "ha girato e
	// non è mai riuscito", che è un errore accertato: cade nello stesso ramo di
	// `hadError` invece di far ripiegare la frase su "non risulta alcuna
	// esecuzione", che sarebbe falsa.
	const detail =
		health.lastRunAt === null
			? t.jobHealth.never
			: health.hadError || health.lastOkAt === null
				? t.jobHealth.withError
				: fill(t.jobHealth.lastOk, {
						// `formatRelativeTime` vuole una stringa ISO, non una Date, e la
						// frase per "meno di un minuto" arriva dal dizionario: `Intl`
						// darebbe "ora", indistinguibile da un conteggio di ore troncato.
						//
						// ⚠️ L'anno va chiesto esplicitamente: oltre i 7 giorni la
						// funzione ripiega su una data assoluta, e il suo default non lo
						// porta. Questo avviso si vede SOLO da fermo, quindi "3 luglio"
						// senza anno non distinguerebbe cinque settimane da diciassette
						// mesi — cioè proprio l'informazione per cui esiste.
						when: formatRelativeTime(
							health.lastOkAt.toISOString(),
							locale,
							t.notifications.justNow,
							{ day: "numeric", month: "long", year: "numeric" },
						),
					})

	return (
		<div
			className="flex items-start gap-3 rounded-2xl px-4 py-3.5 mb-5"
			// issue #81 — anello (box-shadow) invece di bordo: il colore è
			// traslucido (32%), quindi non può passare da `card-shadow-ring`
			// (anello neutro) e va scritto per intero, drop compreso.
			style={{
				background: "color-mix(in srgb, var(--color-kin) 12%, transparent)",
				boxShadow:
					"var(--shadow-drop) 0px 8px 24px, var(--shadow-inset) 0px 1px 0px inset, color-mix(in srgb, var(--color-kin) 32%, transparent) 0px 0px 0px 1px inset",
			}}
			role="status"
		>
			{/* Le icone restano sull'accento pieno: per gli elementi grafici lo
			    standard chiede 3:1, che l'accento già rispetta. */}
			<TriangleAlert
				size={17}
				strokeWidth={1.5}
				className="shrink-0 mt-0.5"
				style={{ color: "var(--color-kin)" }}
			/>
			<div className="min-w-0">
				{/* Il testo prende l'INCHIOSTRO, non l'accento: su fondo chiaro
				    l'accento sta a ~3,2:1, sotto il 4,5:1 di WCAG AA. */}
				<p className="text-[13.5px] font-semibold text-kin-ink">{scoped.title}</p>
				<p className="text-[12.5px] text-muted mt-1 leading-relaxed">
					{detail} {scoped.hint}
				</p>
			</div>
		</div>
	);
}
