"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useDismissLayer } from "./useDialog";

/**
 * Una riga delle impostazioni che apre un menu di scelte: valuta, lingua,
 * «richiedi il PIN dopo».
 *
 * ⚠️ Non una `<select>` nativa invisibile sopra la riga (#171, richiesta di
 * Jomar). Era la soluzione di `PreferencesSection`: il campo era nostro, ma il
 * menu che si apriva era quello del SISTEMA OPERATIVO — grigio e piatto sopra
 * una card di vetro, e diverso in ogni browser. Il blocco con PIN l'aveva già
 * scartata e disegnato un menu a mano; questo è quel menu, in un posto solo,
 * perché tre copie dello stesso menu divergono alla prima modifica.
 *
 * ⚠️ `position: fixed`, con le coordinate prese al tocco, e non `absolute`:
 * `SettingsGroup` e la card delle preferenze hanno `overflow-hidden` per
 * ritagliare gli angoli, e un menu `absolute` verrebbe tagliato via. Si chiude
 * allo scorrimento: un menu `fixed` resterebbe sospeso mentre la riga se ne va.
 *
 * Il menu si apre verso l'alto quando sotto non c'è spazio, con la stessa regola
 * di `Select.tsx`: la `BottomNav` occupa il fondo della finestra.
 */
export interface RowMenuOption {
	value: string;
	label: string;
}

/** Lo spazio della `BottomNav` in fondo alla finestra, come in `Select.tsx`. */
const NAV_CLEARANCE = 112;
/** Altezza di una voce (py-3 + testo) e dei margini del menu. */
const OPTION_HEIGHT = 44;
const MENU_PADDING = 12;

export default function RowMenu({
	label,
	icon,
	valueText,
	options,
	selected,
	onSelect,
	disabled = false,
	describedBy,
	className = "",
}: {
	/** Il nome della riga: «Valuta». Nomina anche l'elenco per i lettori di schermo. */
	label: string;
	/** Il contenuto della pastiglia a sinistra. Decorativo: il nome lo dice `label`. */
	icon: React.ReactNode;
	/** La scelta attuale, come la riga la mostra a destra. */
	valueText: React.ReactNode;
	options: RowMenuOption[];
	selected: string;
	onSelect: (value: string) => void;
	disabled?: boolean;
	/** L'id di un testo che spiega la scelta (l'avviso sotto la valuta). */
	describedBy?: string;
	className?: string;
}) {
	const triggerRef = useRef<HTMLButtonElement>(null);
	const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
	const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
	const open = place !== null;

	function openMenu() {
		const rect = triggerRef.current?.getBoundingClientRect();
		if (!rect) return;
		const needed = options.length * OPTION_HEIGHT + MENU_PADDING;
		const below = window.innerHeight - rect.bottom - NAV_CLEARANCE;
		const above = rect.top - 8;
		setPlace(
			below < needed && above > below
				? { left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 6 }
				: { left: rect.left, width: rect.width, top: rect.bottom + 6 },
		);
	}

	function close(refocus: boolean) {
		setPlace(null);
		if (refocus) triggerRef.current?.focus();
	}

	// #165 — Esc chiude il menu e riporta il fuoco alla riga.
	useDismissLayer(open, () => close(true));

	// All'apertura il fuoco va sulla scelta attuale: da tastiera si parte da lì.
	// E il menu si chiude se la pagina scorre: resterebbe sospeso nel vuoto.
	useEffect(() => {
		if (!open) return;
		const current = Math.max(0, options.findIndex((o) => o.value === selected));
		optionRefs.current[current]?.focus();
		const onScroll = () => close(false);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
		// Si ricalcola solo all'apertura: le opzioni non cambiano a menu aperto.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	function onOptionKey(e: React.KeyboardEvent, index: number) {
		const last = options.length - 1;
		const to =
			e.key === "ArrowDown" ? Math.min(last, index + 1)
			: e.key === "ArrowUp" ? Math.max(0, index - 1)
			: e.key === "Home" ? 0
			: e.key === "End" ? last
			: null;
		if (to === null) return;
		e.preventDefault();
		optionRefs.current[to]?.focus();
	}

	return (
		<>
			<button
				ref={triggerRef}
				type="button"
				disabled={disabled}
				onClick={() => (open ? close(false) : openMenu())}
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-describedby={describedBy}
				className={`flex items-center gap-3 h-15.5 px-4 w-full text-left active:opacity-80 disabled:opacity-60 ${className}`}
			>
				<span aria-hidden="true" className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-control">
					{icon}
				</span>
				<span className="flex-1 text-sm font-medium">{label}</span>
				<span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
					{valueText}
					{/* La freccia gira in 150ms; col movimento ridotto scatta e basta. */}
					<ChevronDown
						size={12}
						className={`transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
					/>
				</span>
			</button>

			{open && (
				<>
					{/* Backdrop trasparente a schermo intero: chiude il menu al tocco
					    fuori, stesso meccanismo del pannello conti (Fase 20b). */}
					<div className="fixed inset-0 z-45" onClick={() => close(false)} />
					{/* issue #81 — anello (`box-shadow-ring`), mai un `border` vero su
					    un elemento arrotondato. Guscio → vetro → contenuto: il guscio
					    ritaglia e fa l'ombra, il vetro sfoca SENZA un proprio raggio. */}
					<div
						className="fixed z-46 rounded-2xl overflow-hidden box-shadow-ring"
						style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom }}
					>
						<div className="absolute inset-0 bg-deep backdrop-blur-[30px]" />
						<div role="listbox" aria-label={label} className="relative p-1.5">
							{options.map((option, i) => {
								const isSelected = option.value === selected;
								return (
									<button
										key={option.value}
										ref={(el) => {
											optionRefs.current[i] = el;
										}}
										type="button"
										role="option"
										aria-selected={isSelected}
										onKeyDown={(e) => onOptionKey(e, i)}
										onClick={() => {
											close(true);
											if (!isSelected) onSelect(option.value);
										}}
										// issue #69 — py-3: righe impilate senza vicini laterali,
										// alte almeno 44px.
										className="w-full flex items-center justify-between gap-3 py-3 px-3 rounded-xl text-sm text-left active:opacity-70 focus-visible:bg-control outline-none"
									>
										<span>{option.label}</span>
										{isSelected && <Check size={15} className="text-midori shrink-0" />}
									</button>
								);
							})}
						</div>
					</div>
				</>
			)}
		</>
	);
}
