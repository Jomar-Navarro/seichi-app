"use client";

import { useState, useRef, useEffect, useId } from "react";
import Link from "next/link";
import { Settings, LogOut, ChevronDown } from "lucide-react";
import Avatar from "@/components/UI/Avatar";
import ThemeToggle from "./ThemeToggle";
import { signOut } from "@/app/(main)/impostazioni/actions";
import { useI18n } from "./I18nProvider";

interface ProfileMenuProps {
	initials: string;
	/** Foto profilo, se caricata — altrimenti si mostrano le iniziali */
	avatarUrl?: string | null;
	/** Nome accanto all'avatar. */
	name: string;
	/** Riga sopra il nome — solo `header` ("Bentornato"). */
	greeting?: string;
	/** Riga sotto il nome — solo `sidebar` ("3 conti attivi"). */
	subtitle?: string;
	/**
	 * Dove sta il menu, e quindi verso dove si apre.
	 *
	 * - `header` (default): il gruppo avatar+saluto+nome in cima alla home,
	 *   pannello che si apre SOTTO, ancorato a sinistra.
	 * - `sidebar` (issue #108): la card in fondo alla rail desktop, pannello
	 *   che si apre SOPRA — sotto non c'è spazio, è il fondo dello schermo.
	 *
	 * ⚠️ Una variante e non un secondo menu: il contenuto (tema, impostazioni,
	 * esci) è lo stesso, e con due copie la prossima voce aggiunta ne
	 * raggiungerebbe una sola — la "migrazione a campione" che CLAUDE.md
	 * registra dalla Fase 18.
	 */
	variant?: "header" | "sidebar";
}

export default function ProfileMenu({
	initials,
	avatarUrl,
	name,
	greeting,
	subtitle,
	variant = "header",
}: ProfileMenuProps) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const panelId = useId();
	const sidebar = variant === "sidebar";

	// Gli ascoltatori esistono SOLO a menu aperto: chiuso non c'è niente da
	// intercettare, e un `keydown` globale sempre acceso ruberebbe l'Esc a chi
	// ne ha davvero bisogno.
	useEffect(() => {
		if (!open) return;
		function onClick(e: MouseEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		}
		// Esc chiude e riporta il fuoco sul bottone che l'ha aperto: senza, chi
		// naviga da tastiera resterebbe con il fuoco su una voce appena smontata,
		// cioè sul `<body>`, a ricominciare il giro dall'inizio della pagina.
		function onKey(e: KeyboardEvent) {
			if (e.key !== "Escape") return;
			setOpen(false);
			triggerRef.current?.focus();
		}
		document.addEventListener("mousedown", onClick);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onClick);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	// Il passaggio del mouse evidenzia le voci solo nella rail, che esiste solo
	// da `lg:` in su, dove il puntatore è quasi sempre un mouse. La variante
	// della home resta com'era: l'issue #108 non la ridisegna, la sostituisce
	// con la rail sugli schermi larghi. (Sul touch non ci sarebbe comunque un
	// `:hover` appiccicato al dito: in Tailwind v4 `hover:` è già dentro
	// `@media (hover: hover)`.)
	// ⚠️ `bg-surface`, non `bg-control`: in chiaro `--icon-btn-bg` è inchiostro
	// al 7% e SCURISCE la voce sul pannello color carta — uno stato scavato, che
	// si legge come disabilitato. `--surface` schiarisce in entrambi i temi,
	// come l'hover delle voci della nav nella stessa rail (review post-merge #108).
	const itemHover = sidebar ? " hover:bg-surface transition-colors" : "";

	const items = (
		<>
			<ThemeToggle />
			<Link
				href="/impostazioni"
				onClick={() => setOpen(false)}
				className={`flex items-center gap-3 px-4 h-12 border-b border-subtle active:opacity-80${itemHover}`}
			>
				<Settings size={16} className="text-secondary" />
				<span className="text-sm font-medium">{t.profileMenu.settings}</span>
			</Link>
			<form action={signOut}>
				<button
					type="submit"
					className={`flex items-center gap-3 px-4 h-12 w-full text-left active:opacity-80${itemHover}`}
				>
					<LogOut size={16} style={{ color: "var(--color-aka)" }} />
					<span className="text-sm font-medium" style={{ color: "var(--ink-aka)" }}>
						{t.profileMenu.signOut}
					</span>
				</button>
			</form>
		</>
	);

	if (sidebar) {
		return (
			<div className="relative" ref={ref}>
				{/* Come sulla home è la card INTERA ad aprire il menu, non il solo
				    avatar. NIENTE aria-label, per la stessa ragione: il bottone
				    contiene già nome e conteggio, e un'etichetta li sovrascriverebbe.
				    ⚠️ issue #81 — anello (`ring-border`), non `border`: la card è
				    arrotondata e `--border` è traslucido. Nessun `backdrop-filter`
				    qui (la sfocatura è già della rail), quindi basta un livello. */}
				<button
					ref={triggerRef}
					type="button"
					onClick={() => setOpen((o) => !o)}
					aria-haspopup="menu"
					aria-expanded={open}
					aria-controls={open ? panelId : undefined}
					className="flex items-center gap-2.75 w-full px-3 py-2.75 rounded-2xl bg-surface ring-border text-left cursor-pointer transition-colors hover:bg-surface-elevated active:opacity-80"
				>
					<Avatar src={avatarUrl} initials={initials} size={32} rounded="rounded-[11px]" />
					{/* `leading-tight` su entrambe le righe: con l'interlinea di
					    default la colonna di testo supera i 32px dell'avatar e la
					    card crescerebbe di tre pixel rispetto al segnaposto che la
					    precede (`ProfileFooterSkeleton` in Sidebar.tsx) — un salto
					    visibile a ogni caricamento a freddo. */}
					<span className="min-w-0 flex-1">
						<span className="block text-[12.5px] font-semibold leading-tight truncate">{name}</span>
						{subtitle && (
							<span className="block text-[10.5px] leading-tight text-disabled mt-px truncate">
								{subtitle}
							</span>
						)}
					</span>
					<ChevronDown size={13} strokeWidth={1.8} className="text-disabled shrink-0" />
				</button>

				{open && (
					// SOPRA la card e largo quanto lei, cioè quanto il contenuto della
					// rail. `box-shadow-ring` e non `modal-shadow-ring`: quella è
					// un'ombra verso l'ALTO, tarata per un foglio il cui fondo è fuori
					// schermo (vedi la 28d); un pannello che galleggia libero la vuole
					// a caduta, che qui si posa sulla card da cui è uscito.
					// ⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto.
					// ⚠️ z-index: `z-50` vale DENTRO la rail, che è `fixed z-30` con
					// `backdrop-filter` — un contesto di impilamento a sé. Verso il
					// resto dell'app il pannello conta quindi come z-30: il modale
					// transazione e i fogli (`z-50` alla radice) gli restano sopra.
					<div
						id={panelId}
						className="absolute left-0 right-0 bottom-full mb-2 z-50 rounded-2xl overflow-hidden box-shadow-ring"
					>
						<div className="absolute inset-0 bg-modal backdrop-blur-2xl" />
						<div className="relative">{items}</div>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className="relative" ref={ref}>
			{/* Nel mockup è l'intero gruppo avatar+nome ad aprire il menu, non il
			    solo avatar: il chevron accanto al nome è ciò che lo annuncia. */}
			<button
				ref={triggerRef}
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="flex items-center gap-3 p-1 -m-1 cursor-pointer active:opacity-80 rounded-2xl"
				// NIENTE aria-label: il bottone contiene già nome e saluto, e un
				// label lo sovrascriverebbe — uno screen reader leggerebbe "Profilo"
				// al posto di "Bentornato, <nome>".
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
			>
				<Avatar src={avatarUrl} initials={initials} size={42} className="card-shadow" />
				<span className="text-left min-w-0">
					{greeting && (
						<span className="block text-xs text-muted leading-none">{greeting}</span>
					)}
					<span className="flex items-center gap-1.5 mt-1">
						<span className="text-base font-semibold leading-none truncate max-w-36">
							{name}
						</span>
						<ChevronDown size={11} className="text-muted shrink-0" />
					</span>
				</span>
			</button>

			{open && (
				// Ancorato a sinistra, il lato da cui parte il trigger: altrimenti
				// sulla Home il pannello uscirebbe dallo schermo.
				// ⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto.
				<div
					id={panelId}
					className="absolute left-0 top-13 z-50 w-56 rounded-2xl overflow-hidden modal-shadow-ring"
				>
					<div className="absolute inset-0 bg-modal backdrop-blur-2xl" />
					<div className="relative">{items}</div>
				</div>
			)}
		</div>
	);
}
