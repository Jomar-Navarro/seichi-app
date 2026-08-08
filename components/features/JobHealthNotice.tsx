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

	// L'ordine è per gravità decrescente: "mai girato" è peggio di "girato male",
	// che è peggio di "girato bene troppo tempo fa".
	const detail = health.lastRunAt === null
		? t.jobHealth.never
		: health.hadError
			? t.jobHealth.withError
			: health.lastOkAt
				? fill(t.jobHealth.lastOk, {
						// `formatRelativeTime` vuole una stringa ISO, non una Date, e la
						// frase per "meno di un minuto" arriva dal dizionario: `Intl`
						// darebbe "ora", indistinguibile da un conteggio di ore troncato.
						when: formatRelativeTime(
							health.lastOkAt.toISOString(),
							locale,
							t.notifications.justNow,
						),
					})
				: t.jobHealth.never;

	return (
		<div
			className="flex items-start gap-3 rounded-2xl px-4 py-3.5 mb-5 border card-shadow"
			style={{
				background: "color-mix(in srgb, var(--color-kin) 12%, transparent)",
				borderColor: "color-mix(in srgb, var(--color-kin) 32%, transparent)",
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
				<p className="text-[13.5px] font-semibold text-kin-ink">{t.jobHealth.title}</p>
				<p className="text-[12.5px] text-muted mt-1 leading-relaxed">
					{detail} {t.jobHealth.hint}
				</p>
			</div>
		</div>
	);
}
