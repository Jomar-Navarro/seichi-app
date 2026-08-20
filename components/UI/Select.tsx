"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useI18n } from "@/components/features/I18nProvider";
import { fill } from "@/lib/i18n/format";

export interface Option {
	icon: React.ReactNode;
	label: string;
	value: string;
}

export interface DropdownProps {
	title: string;
	options: Option[];
	selected: string;
	onChange: (value: string) => void;
	variant?: "default" | "compact";
	/**
	 * Avvisa il chiamante quando la tendina si apre o si chiude.
	 *
	 * ⚠️ Serve a chi sta dentro un CONTESTO DI IMPILAMENTO che questo componente
	 * non può scavalcare da solo. Una card con `backdrop-filter` o uno `z-index`
	 * proprio confina il menu al proprio livello: per quanto alto sia lo z-index
	 * *interno*, resta sotto tutto ciò che nel documento sta più in alto della
	 * card — per esempio la `BottomNav`, che è `fixed` a z-40. L'unico che può
	 * alzare la card è il chiamante, e per farlo deve sapere quando.
	 */
	onOpenChange?: (open: boolean) => void;
}

/**
 * Quanto spazio si tiene libero in fondo alla finestra quando si decide da che
 * parte aprire la tendina: la pastiglia della `BottomNav` è alta 64px e la
 * fascia sfocata sopra di lei 112px.
 */
const NAV_CLEARANCE = 112;

/** Sotto questa altezza utile non vale la pena aprire verso il basso. */
const MIN_ROOM = 180;

export default function Select({
	options,
	selected,
	onChange,
	title,
	variant = "default",
	onOpenChange,
}: DropdownProps) {
	const { t } = useI18n();
	const [isOpen, setIsOpen] = useState(false);
	const [openUp, setOpenUp] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const selectedOption = options.find((o) => o.value === selected);

	/**
	 * Apre la tendina dalla parte dove c'è spazio.
	 *
	 * ⚠️ Il calcolo si fa al momento del tocco e non al render: la posizione del
	 * bottone dipende da quanto si è scorso, e in una lista di quattordici gruppi
	 * cambia in continuazione. Deciderlo una volta sola darebbe la risposta
	 * giusta per il primo gruppo e sbagliata per tutti gli altri.
	 */
	/*
	 * ⚠️ Se questo componente si SMONTA con la tendina aperta, `onOpenChange`
	 * non verrebbe mai chiamato con `false` — e chi tiene un contatore delle
	 * tendine aperte resterebbe sbilanciato per sempre. Nell'import succede
	 * davvero: cambiando il tipo di un gruppo da `trasferimento` a qualcos'altro,
	 * il selettore della controparte sparisce mentre è aperto, e la card
	 * resterebbe alzata sopra la bottom nav per tutto il resto della sessione.
	 *
	 * Lo stato viaggia in un ref perché la pulizia gira una volta sola, allo
	 * smontaggio, e leggerebbe altrimenti i valori del primo render.
	 */
	const latest = useRef({ open: false, notify: onOpenChange });
	useEffect(() => {
		latest.current = { open: isOpen, notify: onOpenChange };
	});
	useEffect(
		() => () => {
			if (latest.current.open) latest.current.notify?.(false);
		},
		[],
	);

	function toggle() {
		const next = !isOpen;
		if (next && triggerRef.current) {
			const rect = triggerRef.current.getBoundingClientRect();
			const below = window.innerHeight - rect.bottom - NAV_CLEARANCE;
			const above = rect.top - 8;
			setOpenUp(below < MIN_ROOM && above > below);
		}
		setIsOpen(next);
		onOpenChange?.(next);
	}

	/**
	 * Segnaposto quando non c'è ancora una scelta: "Seleziona categoria".
	 *
	 * ⚠️ Era `` `Seleziona ${title.toLowerCase()}` ``: un verbo CABLATO
	 * concatenato a un titolo tradotto, che in inglese produceva la mezza frase
	 * "Seleziona category". Ora è una voce di dizionario con segnaposto, così
	 * ogni lingua può ricomporre la frase a modo suo invece di ereditare
	 * l'ordine delle parole dell'italiano.
	 */
	const placeholder = fill(t.common.selectPlaceholder, {
		field: title.toLowerCase(),
	});

	if (variant === "compact") {
		return (
			<div className="relative">
				<p className="text-xs text-muted mb-1.5">{title}</p>
				<button
					ref={triggerRef}
					onClick={toggle}
					className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-subtle"
				>
					{selectedOption?.icon && (
						<span className="shrink-0">{selectedOption.icon}</span>
					)}
					<span className="text-sm flex-1 text-left">
						{selectedOption ? selectedOption.label : placeholder}
					</span>
					<ChevronDown size={14} className="text-muted" />
				</button>
				{isOpen && (
					/*
					 * ⚠️ Tre difese, e servono tutte e tre perché falliscono in modi
					 * diversi:
					 *
					 *   · `bottom-full` quando sotto non c'è spazio — altrimenti la
					 *     tendina di un campo in fondo alla pagina nasce già coperta;
					 *   · `max-h` + scorrimento — perché una lista lunga esce dalla
					 *     finestra qualunque sia la direzione, e le ultime voci
					 *     diventano irraggiungibili;
					 *   · lo `z-index` alzato dal chiamante (`onOpenChange`) — perché
					 *     dentro una card con `backdrop-filter` nessuno z-index scritto
					 *     qui può superare la `BottomNav`.
					 *
					 * Le prime due si vedono con una lista di otto categorie; la terza
					 * solo dentro le card dell'import.
					 */
					<div
						className={`absolute ${openUp ? "bottom-full mb-1" : "top-full mt-1"} left-0 right-0 z-10 rounded-2xl bg-deep border border-subtle max-h-[min(320px,45vh)] overflow-y-auto`}
					>
						{options.map((option) => (
							<button
								key={option.value}
								onClick={() => {
									onChange(option.value);
									setIsOpen(false);
									onOpenChange?.(false);
								}}
								className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-card"
							>
								{option.icon && <span className="shrink-0">{option.icon}</span>}
								<span className="flex-1 text-left">{option.label}</span>
								{option.value === selected && <Check size={14} className="text-midori" />}
							</button>
						))}
					</div>
				)}
			</div>
		);
	}

	return (
		<div className={`relative mb-4.5 ${isOpen ? "z-30" : "z-20"}`}>
			<div className="text-xs tracking-[1.8px] uppercase text-muted mb-2.5 ms-1">
				{title}
			</div>
			<button
				ref={triggerRef}
				onClick={toggle}
				className="w-full flex items-center justify-between py-3.5 px-4 rounded-[20px] cursor-pointer text-inherit bg-input border border-subtle backdrop-blur-[20px] box-shadow"
			>
				<span className="flex items-center gap-3">
					<span className="w-10 h-10 rounded-xl bg-input flex items-center justify-center text-lg text-foreground">
						{selectedOption?.icon}
					</span>
					<span className="flex flex-col gap-1 text-start">
						<span className="text-sm font-semibold">
							{selectedOption?.label}
						</span>
						<span className="text-xs text-muted uppercase">
							{selectedOption?.value}
						</span>
					</span>
				</span>
				<ChevronDown size={17} className="text-muted" />
			</button>

			{isOpen && (
				/*
				 * Stessa protezione della variante compatta: una lista lunga deve poter
				 * scorrere invece di uscire dalla finestra. Qui NON si ribalta verso
				 * l'alto — questa variante vive nelle pagine di onboarding, che non
				 * hanno la bottom nav e tengono il campo in alto.
				 */
				<div className="absolute top-full mt-2 left-0 right-0 z-30 p-2 rounded-[20px] bg-deep border border-subtle backdrop-blur-[30px] input-shadow max-h-[min(340px,50vh)] overflow-y-auto">
					{options.map((option) => (
						<div
							onClick={() => {
								onChange(option.value);
								setIsOpen(false);
								onOpenChange?.(false);
							}}
							key={option.value}
							className="flex items-center justify-between py-2.5 px-3 cursor-pointer"
						>
							<span className="flex items-center gap-3">
								<span className="w-6 text-center text-sm text-foreground">
									{option?.icon}
								</span>
								<span className="text-sm text-foreground">{option.label}</span>
							</span>
							{option.value === selected && (
								<Check size={17} className="text-midori" />
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
