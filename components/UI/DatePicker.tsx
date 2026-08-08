"use client";

import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/components/features/I18nProvider";
import { formatDate, weekdayInitials } from "@/lib/i18n/format";

/**
 * Selettore di data custom.
 *
 * ⚠️ ESISTE PER CHIUDERE UN DEBITO DELLA FASE 18, non per gusto estetico.
 * `<input type="date">` rende la data secondo la lingua del BROWSER, non quella
 * della pagina: con Chrome in inglese e l'app in italiano mostrava `mm/dd/yyyy`,
 * e `lang="it"` su `<html>` non ci poteva niente. È l'unico pezzo di interfaccia
 * che la Fase 19 non poteva tradurre, perché il testo non è nostro — lo disegna
 * il browser. L'unica chiusura possibile è non usare quel controllo.
 *
 * Il calendario viveva già dentro `TransactionForm`, dove era stato scritto per
 * il design del modale. Qui è lo stesso, estratto: `GoalSheet` e
 * `RecurringSheet` usavano ancora il controllo nativo, quindi nella stessa app
 * convivevano due modi di scegliere una data, uno dei quali in una lingua a caso.
 *
 * I nomi di mesi e giorni vengono da `Intl`, quindi il picker parla la lingua
 * dell'app in entrambe le direzioni: quella che mostra e quella che nomina.
 */

function daysInMonth(year: number, month: number) {
	return new Date(year, month + 1, 0).getDate();
}

/** Indice del primo giorno del mese, con la settimana che parte da LUNEDÌ. */
function firstWeekdayMondayFirst(year: number, month: number) {
	const day = new Date(year, month, 1).getDay();
	return day === 0 ? 6 : day - 1;
}

interface DatePickerProps {
	/** Data selezionata, in formato ISO "YYYY-MM-DD" — vuota se non scelta. */
	value: string;
	onChange: (isoDate: string) => void;
	/** Data minima selezionabile, ISO. I giorni prima restano visibili ma spenti. */
	min?: string;
	/**
	 * Testo quando `value` è vuoto, e etichetta del comando che la svuota.
	 *
	 * ⚠️ Valorizzarlo è ciò che rende la data OPZIONALE, e senza il comando il
	 * picker era una trappola: `<input type="date">` si poteva cancellare, questo
	 * emetteva solo giorni concreti. Chi metteva una scadenza a un obiettivo non
	 * poteva più tornare a "nessuna scadenza" — uno stato raggiungibile dalla UI
	 * solo in una direzione.
	 */
	placeholder?: string;
	className?: string;
}

/** ISO locale "YYYY-MM-DD" — `toISOString()` slitterebbe di fuso. */
function toISO(d: Date): string {
	return d.toLocaleDateString("sv-SE");
}

export default function DatePicker({
	value,
	onChange,
	min,
	placeholder,
	className = "rounded-2xl px-4 py-3 bg-card border border-subtle",
}: DatePickerProps) {
	const { locale } = useI18n();
	const selected = value ? new Date(`${value}T12:00:00`) : null;
	const [open, setOpen] = useState(false);
	const [viewDate, setViewDate] = useState(() => selected ?? new Date());

	const year = viewDate.getFullYear();
	const month = viewDate.getMonth();
	const totalDays = daysInMonth(year, month);
	const firstWeekday = firstWeekdayMondayFirst(year, month);
	const today = new Date();
	const weekdays = weekdayInitials(locale);

	function navigateMonth(delta: number) {
		setViewDate((prev) => {
			const d = new Date(prev);
			d.setMonth(d.getMonth() + delta);
			return d;
		});
	}

	function selectDay(day: number) {
		// Mezzogiorno, non mezzanotte: attorno al cambio ora legale una data
		// costruita a mezzanotte può ricadere nel giorno precedente.
		onChange(toISO(new Date(year, month, day, 12)));
		setOpen(false);
	}

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => {
					setViewDate(selected ?? new Date());
					setOpen((p) => !p);
				}}
				className={`w-full flex items-center gap-3 ${className}`}
			>
				<Calendar size={14} className="text-muted shrink-0" />
				<span className={`text-sm flex-1 text-left ${selected ? "" : "text-muted"}`}>
					{selected
						? formatDate(selected, locale, {
								day: "numeric",
								month: "long",
								year: "numeric",
							})
						: (placeholder ?? "—")}
				</span>
				<ChevronRight size={14} className="text-muted" />
			</button>

			{open && (
				<div className="absolute top-full mt-1 left-0 right-0 z-20 rounded-2xl bg-deep border border-subtle p-3">
					<div className="flex items-center justify-between mb-2">
						<button
							type="button"
							onClick={() => navigateMonth(-1)}
							className="w-7 h-7 flex items-center justify-center rounded-xl bg-card border border-subtle"
						>
							<ChevronLeft size={14} />
						</button>
						<span className="text-sm font-medium capitalize">
							{formatDate(viewDate, locale, { month: "long", year: "numeric" })}
						</span>
						<button
							type="button"
							onClick={() => navigateMonth(1)}
							className="w-7 h-7 flex items-center justify-center rounded-xl bg-card border border-subtle"
						>
							<ChevronRight size={14} />
						</button>
					</div>

					<div className="grid grid-cols-7 mb-1">
						{weekdays.map((d) => (
							<span key={d} className="text-center text-[10px] text-muted py-1">
								{d}
							</span>
						))}
					</div>

					<div className="grid grid-cols-7 gap-0.5">
						{Array.from({ length: firstWeekday }).map((_, i) => (
							<div key={`e${i}`} />
						))}
						{Array.from({ length: totalDays }).map((_, i) => {
							const day = i + 1;
							const iso = toISO(new Date(year, month, day, 12));
							const disabled = min !== undefined && iso < min;
							const isSelected = selected !== null && iso === value;
							const isToday =
								today.getDate() === day &&
								today.getMonth() === month &&
								today.getFullYear() === year;
							return (
								<button
									key={day}
									type="button"
									disabled={disabled}
									onClick={() => selectDay(day)}
									className={`h-8 w-full rounded-xl text-xs flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
										isSelected
											? "btn-primary font-semibold"
											: isToday
												? "border border-subtle font-medium"
												: "hover:bg-card"
									}`}
								>
									{day}
								</button>
							);
						})}
					</div>

					{/* Il comando che riporta la data a "non impostata". Compare solo
					    quando `placeholder` dice che la data è opzionale. */}
					{placeholder !== undefined && value !== "" && (
						<button
							type="button"
							onClick={() => {
								onChange("");
								setOpen(false);
							}}
							className="w-full mt-2 pt-2 border-t border-subtle text-[11px] text-muted active:opacity-60"
						>
							{placeholder}
						</button>
					)}
				</div>
			)}
		</div>
	);
}
