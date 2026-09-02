"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Archive, Pencil, Plus, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import AccountSheet from "./AccountSheet";
import EmptyState from "@/components/UI/EmptyState";
import { useI18n } from "./I18nProvider";
import {
	DISPLAY_CURRENCY,
	currencySymbol,
	formatMoney,
	plural,
	splitAmount,
} from "@/lib/i18n/format";
import {
	ACCOUNT_ICON_FALLBACK,
	ACCOUNT_TYPE_ICON,
	accountColor,
	accountTypeLabel,
} from "@/lib/accounts";
import { setAccountArchived } from "@/app/(main)/conti/actions";
import type { AccountWithBalance } from "@/types";

interface AccountsPageClientProps {
	accounts: AccountWithBalance[];
}

/**
 * Quanto scoperto lascia il vassoio: due bottoni da 44×44 (checklist Fase 27),
 * `gap-2` (8px) fra loro, `pr-3` (12px) di margine dal bordo destro della
 * card e `pl-3` (12px) di margine dal bordo che la riga trascina via — senza
 * quest'ultimo la matita risultava incollata al bordo rivelato: la riga
 * trasla di esattamente `TRAY_WIDTH`, quindi il primo bottone comincia dove
 * finisce la riga, a meno di riservargli uno spazio vuoto prima.
 */
const TRAY_WIDTH = 44 * 2 + 8 + 12 + 12;

export default function AccountsPageClient({ accounts }: AccountsPageClientProps) {
	const { locale, t } = useI18n();
	const router = useRouter();
	const [sheetOpen, setSheetOpen] = useState(false);
	const [editing, setEditing] = useState<AccountWithBalance | null>(null);
	const [rowError, setRowError] = useState<string | null>(null);
	/**
	 * L'id del conto il cui vassoio è aperto — un solo vassoio per volta, come
	 * chiede la issue #62. `null` = nessuno aperto.
	 */
	const [openId, setOpenId] = useState<string | null>(null);

	const active = accounts.filter((a) => !a.archived);
	const archived = accounts.filter((a) => a.archived);

	/*
	 * ⚠️ Gli archiviati restano FUORI dalla somma, e per questo il numero si
	 * chiama "Saldo" e non "Saldo totale".
	 *
	 * Il mockup scriveva "Saldo totale · 4 conti attivi" su una cifra che
	 * escludeva il conto archiviato: una parola falsa in grande, corretta a voce
	 * bassa nel sottotitolo. È il difetto già elevato a regola nella 17a — "spese
	 * variabili", mai "spese totali". Un numero sbagliato che sembra giusto è
	 * peggio di un numero assente.
	 */
	const total = active.reduce((sum, a) => sum + a.balance, 0);
	const { sign, integer, decimal } = splitAmount(total, locale);

	function openCreate() {
		setEditing(null);
		setSheetOpen(true);
	}

	function openEdit(account: AccountWithBalance) {
		setEditing(account);
		setSheetOpen(true);
	}

	/*
	 * ⚠️ L'esito si guarda. Prima veniva scartato, quindi un fallimento —
	 * conto rimosso in un'altra scheda, sessione scaduta, `notFound` — era
	 * indistinguibile da un successo: l'utente toccava "riattiva", la riga
	 * restava archiviata e nessun messaggio spiegava perché. Ogni altro
	 * chiamante di questo file (`AccountSheet`) mostra `result.error`.
	 */
	async function reactivate(id: string) {
		setRowError(null);
		const result = await setAccountArchived(id, false);
		if ("error" in result && result.error) {
			setRowError(result.error);
			return;
		}
		router.refresh();
	}

	/**
	 * Archiviare dal vassoio dello swipe — stessa `setAccountArchived()` del
	 * foglio "Modifica", solo raggiunta con un gesto più corto. Non disabilita
	 * il bottone in base a `active.length`: se questo è l'ultimo conto attivo,
	 * il server risponde con `errors.lastAccount` e lo si mostra come per
	 * "riattiva" — un messaggio letto è meglio di un bottone spento senza
	 * spiegazione, e qui il vassoio non ha spazio per scriverla accanto.
	 */
	async function archiveFromTray(id: string) {
		setRowError(null);
		const result = await setAccountArchived(id, true);
		if ("error" in result && result.error) {
			setRowError(result.error);
			return;
		}
		router.refresh();
	}

	return (
		<div className="flex flex-col flex-1">
			<div className="flex items-start justify-between mb-1.5">
				<div>
					<h1 className="text-[26px] font-semibold leading-tight">{t.accounts.title}</h1>
					<p className="text-[12.5px] text-muted mt-1">
						{plural(t.accounts.activeCount, active.length, locale)}
					</p>
				</div>
				<button
					onClick={openCreate}
					className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[12.5px] font-semibold card-shadow border border-subtle shrink-0"
					style={{ background: "var(--surface-elevated)" }}
				>
					<Plus size={13} strokeWidth={2.2} />
					{t.accounts.newTitle}
				</button>
			</div>

			{accounts.length === 0 ? (
				<div className="flex-1 flex items-center justify-center">
					<EmptyState
						title={t.accounts.emptyTitle}
						description={t.accounts.emptyDescription}
						actionLabel={t.accounts.newTitle}
						onAction={openCreate}
					/>
				</div>
			) : (
				<div className="relative flex flex-col gap-3 mt-5">
					{/*
						⚠️ Copre l'INTERO viewport, non solo la lista: "il tap altrove lo
						chiude" (issue #62) vale anche per la card del saldo e per lo
						spazio vuoto, non solo per le altre righe — quelle si chiudono da
						sole (vedi `handleTap` nelle righe), qui serve per il resto.
						z-20, sotto le righe (z-30) e ben sotto i fogli modali (z-40/50):
						sparisce prima che "Modifica" possa aprirne uno.
					*/}
					{openId !== null && (
						<div className="fixed inset-0 z-20" onClick={() => setOpenId(null)} />
					)}

					{/* Il saldo complessivo dei soli conti attivi. */}
					<div className="rounded-3xl p-5 border border-subtle card-shadow bg-surface backdrop-blur-md">
						<p className="text-sm text-muted mb-2">{t.accounts.balanceHeading}</p>
						<p className="font-semibold tracking-tight flex items-baseline gap-0.5">
							<span className="text-2xl font-semibold mr-1">
								{currencySymbol(DISPLAY_CURRENCY, locale)}
							</span>
							<span className="text-4xl">{sign}{integer}</span>
							<span className="text-2xl font-medium text-muted">{decimal}</span>
						</p>
					</div>

					{rowError && (
						<p className="text-xs ml-1" style={{ color: "var(--ink-aka)" }}>
							{rowError}
						</p>
					)}

					{active.map((a) => (
						<ActiveAccountRow
							key={a.id}
							account={a}
							locale={locale}
							isOpen={openId === a.id}
							anyOpen={openId !== null}
							onOpen={() => setOpenId(a.id)}
							onClose={() => setOpenId(null)}
							onEdit={() => openEdit(a)}
							onArchive={() => void archiveFromTray(a.id)}
						/>
					))}

					{archived.length > 0 && (
						<>
							<p className="text-xs text-muted font-medium mt-1 mb-0.5 ml-1 tracking-wide">
								{plural(t.accounts.archivedSection, archived.length, locale)}
							</p>
							{archived.map((a) => (
								<ArchivedAccountRow
									key={a.id}
									account={a}
									locale={locale}
									anyOpen={openId !== null}
									onCloseOthers={() => setOpenId(null)}
									action={
										/*
											⚠️ `text-ao-ink` e non `--color-ao`: il mockup usava
											l'accento pieno come colore del testo a 11,5px, cioè
											~3,2:1 su fondo chiaro, sotto il 4,5:1 di WCAG AA. È
											l'unico punto del mockup che sbaglia, quindi è una
											svista isolata e non un pattern.
										*/
										<button
											onClick={(e) => {
												e.stopPropagation();
												void reactivate(a.id);
											}}
											className="flex items-center gap-1 text-[11.5px] font-semibold text-ao-ink"
										>
											<RotateCcw size={11} />
											{t.accounts.reactivate}
										</button>
									}
								/>
							))}
						</>
					)}
				</div>
			)}

			{sheetOpen && (
				<AccountSheet
					key={editing?.id ?? "new"}
					account={editing}
					canArchive={active.length > 1}
					onClose={() => {
						setSheetOpen(false);
						setEditing(null);
					}}
				/>
			)}
		</div>
	);
}

/**
 * La riga di un conto ATTIVO — swipeabile.
 *
 * ⚠️ **Il vassoio si fa con `transform: translateX()`, non con
 * `overflow-x`.** La riga ha `card-shadow` (`0 8px 24px`), e per specifica
 * CSS un asse non `visible` ritaglia ANCHE l'altro: la riga perderebbe l'ombra
 * su tutti e quattro i lati, sembrando piatta pur avendo le stesse classi. È
 * la stessa trappola già pagata due volte in questo progetto — il carosello
 * della home e la `FilterBar` della 21c.
 *
 * ⚠️ **La riga È un `button`**, non un `div` con un `button` dentro: qui non
 * c'è nessun elemento interattivo annidato, perché i comandi del vassoio sono
 * FRATELLI (un `div` assoluto a fianco), non figli. È lo stesso vincolo che
 * regge `ArchivedAccountRow` — markup interattivo dentro markup interattivo
 * è HTML non valido, con un comportamento da tastiera indefinito.
 *
 * ⚠️ **`touch-action: pan-y`, non `preventDefault` sul verticale.** Dice al
 * browser di gestire lo scorrimento verticale per conto proprio; l'orizzontale
 * lo intercetta questo componente. Senza, o si perde lo swipe orizzontale
 * (il browser vince sempre lo scroll) o si perde lo scroll verticale
 * dell'elenco (se si chiama `preventDefault` a occhi chiusi).
 */
function ActiveAccountRow({
	account,
	locale,
	isOpen,
	anyOpen,
	onOpen,
	onClose,
	onEdit,
	onArchive,
}: {
	account: AccountWithBalance;
	locale: Parameters<typeof formatMoney>[1]["locale"];
	isOpen: boolean;
	anyOpen: boolean;
	onOpen: () => void;
	onClose: () => void;
	onEdit: () => void;
	onArchive: () => void;
}) {
	const { t } = useI18n();
	const router = useRouter();
	const Icon = (account.type && ACCOUNT_TYPE_ICON[account.type]) || ACCOUNT_ICON_FALLBACK;
	const color = accountColor(account.type, account.color);

	// Non-null SOLO durante un drag attivo: fuori da un drag, la posizione è
	// interamente derivata da `isOpen`, non da uno stato locale che potrebbe
	// disallinearsi se un'altra riga si apre e chiude questa da fuori.
	const [dragOffset, setDragOffset] = useState<number | null>(null);
	const drag = useRef<{ x: number; y: number; axis: "x" | "y" | null; base: number } | null>(null);
	const suppressClick = useRef(false);

	const offset = dragOffset ?? (isOpen ? -TRAY_WIDTH : 0);

	function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		// ⚠️ Azzerato a ogni NUOVO gesto, non solo in `handleTap`: senza, un
		// drag il cui click di chiusura il browser non sintetizza (capita su
		// alcuni browser mobili dopo un pan) lascerebbe il flag acceso per
		// sempre, e il primo tap genuino dopo quello swipe verrebbe ignorato
		// in silenzio invece di navigare.
		suppressClick.current = false;
		drag.current = { x: e.clientX, y: e.clientY, axis: null, base: isOpen ? -TRAY_WIDTH : 0 };
		/*
		 * ⚠️ Senza la CATTURA, un dito che esce dai confini della riga prima di
		 * sollevarsi (finisce sulla riga sotto, per esempio) può far perdere gli
		 * eventi `pointermove`/`pointerup` successivi: `drag.current` resta
		 * valorizzato, la riga si blocca a metà corsa e la transizione di
		 * chiusura — soppressa finché `dragOffset !== null` — non parte mai.
		 * `setPointerCapture` fissa il bersaglio di ogni evento successivo a
		 * QUESTO bottone, indipendentemente da dove va il dito.
		 */
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {
			// Alcuni browser rifiutano la cattura su un pointer già rilasciato:
			// il drag funziona comunque per il caso comune, si ignora.
		}
	}

	function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
		if (!drag.current) return;
		const dx = e.clientX - drag.current.x;
		const dy = e.clientY - drag.current.y;

		if (drag.current.axis === null) {
			// Soglia di 6px prima di impegnarsi su un asse: sotto, un tremolio
			// del dito verrebbe letto come una direzione a caso.
			if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
			drag.current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
			if (drag.current.axis === "x") suppressClick.current = true;
		}

		if (drag.current.axis !== "x") return;
		const next = Math.min(0, Math.max(-TRAY_WIDTH, drag.current.base + dx));
		setDragOffset(next);
	}

	function onPointerUp(e: PointerEvent<HTMLButtonElement>) {
		if (!drag.current) return;
		try {
			e.currentTarget.releasePointerCapture(e.pointerId);
		} catch {
			// Già rilasciata dal browser in alcuni casi (es. pointercancel): non
			// c'è nulla da fare, e non è un errore da mostrare.
		}
		if (drag.current.axis === "x") {
			const final = dragOffset ?? drag.current.base;
			// Oltre il 40% dello scoperto si scatta aperto, altrimenti si richiude.
			if (final < -TRAY_WIDTH * 0.4) onOpen();
			else onClose();
		}
		setDragOffset(null);
		drag.current = null;
	}

	function handleTap() {
		if (suppressClick.current) {
			suppressClick.current = false;
			return;
		}
		// Un vassoio aperto — questo o un altro — assorbe il primo tap per
		// chiudersi, e non naviga: è il gemello del backdrop per le righe.
		if (anyOpen) {
			onClose();
			return;
		}
		router.push(`/conti/${account.id}`);
	}

	/*
	 * ⚠️ Il vassoio si disegna SOLO quando serve — aperto o mentre lo si sta
	 * trascinando — non sempre "dietro, in attesa di essere rivelato".
	 *
	 * Le card di questo progetto sono vetro traslucido (`bg-surface` +
	 * `backdrop-blur`, il linguaggio "Zen Glass"): la riga sopra NON è opaca
	 * per disegno, quindi un vassoio disegnato in permanenza sotto una riga
	 * CHIUSA resta visibile in trasparenza — le pastiglie di Modifica e
	 * Archivia si vedevano "attraverso" il saldo su ogni riga a riposo, più
	 * marcato in Firefox che rende il blur in modo diverso da Chrome. Alzare
	 * l'opacità della riga avrebbe rotto la coerenza con ogni altra card
	 * dell'app, che è vetro ovunque: la correzione giusta è non disegnare ciò
	 * che deve restare nascosto, non nasconderlo meglio.
	 */
	const traySmontato = !isOpen && dragOffset === null;

	return (
		<div className="relative z-30">
			{!traySmontato && (
				<div className="absolute inset-0 flex items-center justify-end gap-2 px-3 rounded-3xl">
					<button
						onClick={(e) => {
							e.stopPropagation();
							onClose();
							onEdit();
						}}
						aria-label={t.common.edit}
						className="w-11 h-11 rounded-2xl flex items-center justify-center bg-control border border-subtle shrink-0"
					>
						<Pencil size={17} className="text-secondary" />
					</button>
					<button
						onClick={(e) => {
							e.stopPropagation();
							onClose();
							onArchive();
						}}
						aria-label={t.accounts.archive}
						className="w-11 h-11 rounded-2xl flex items-center justify-center bg-control border border-subtle shrink-0"
					>
						<Archive size={17} style={{ color: "var(--ink-aka)" }} />
					</button>
				</div>
			)}

			<button
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
				onClick={handleTap}
				aria-expanded={isOpen}
				style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
				className={`relative w-full flex items-center gap-3 p-4 rounded-3xl border border-subtle card-shadow bg-surface backdrop-blur-md text-left ${
					dragOffset === null ? "transition-transform duration-200" : ""
				}`}
			>
				<span
					className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
					style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
				>
					<Icon size={19} style={{ color }} />
				</span>

				<span className="flex-1 min-w-0">
					<span className="block text-[14.5px] font-medium text-foreground truncate">
						{account.name}
					</span>
					<span className="block text-[11.5px] text-muted">
						{accountTypeLabel(account.type, t)}
					</span>
				</span>

				<span className="text-[14.5px] font-semibold text-foreground shrink-0">
					{formatMoney(account.balance, { locale, currency: DISPLAY_CURRENCY, decimals: 2 })}
				</span>
			</button>
		</div>
	);
}

/**
 * La riga di un conto ARCHIVIATO — niente swipe, deliberatamente.
 *
 * ⚠️ Decisione della issue #62: gli archiviati non diventano swipeabili. Il
 * bottone "riattiva" resta SEMPRE VISIBILE — è l'unico gesto su questa riga,
 * senza bisogno di scoprirlo — perché aggiungere anche lo swipe qui vorrebbe
 * dire due modelli di interazione sulla stessa riga, che la issue chiede
 * esplicitamente di non lasciare accadere. Il tap continua a portare a
 * `/conti/[id]`, dove "Modifica" resta raggiungibile anche per un conto
 * archiviato.
 *
 * ⚠️ La riga è un `div` con un `button` dentro, e "riattiva" è un secondo
 * `button` FRATELLO: è la stessa forma di `AccountRow` prima di questa fase,
 * perché il vincolo — niente markup interattivo annidato — non è cambiato.
 */
function ArchivedAccountRow({
	account,
	locale,
	anyOpen,
	onCloseOthers,
	action,
}: {
	account: AccountWithBalance;
	locale: Parameters<typeof formatMoney>[1]["locale"];
	anyOpen: boolean;
	onCloseOthers: () => void;
	action?: ReactNode;
}) {
	const { t } = useI18n();
	const router = useRouter();
	const Icon = (account.type && ACCOUNT_TYPE_ICON[account.type]) || ACCOUNT_ICON_FALLBACK;
	const color = accountColor(account.type, account.color);

	function handleTap() {
		if (anyOpen) {
			onCloseOthers();
			return;
		}
		router.push(`/conti/${account.id}`);
	}

	return (
		<div className="relative z-30 w-full flex items-center gap-3 p-4 rounded-3xl border border-subtle card-shadow bg-surface backdrop-blur-md opacity-55">
			<button onClick={handleTap} className="flex items-center gap-3 flex-1 min-w-0 text-left">
				<span
					className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
					style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
				>
					<Icon size={19} style={{ color }} />
				</span>

				<span className="flex-1 min-w-0">
					<span className="block text-[14.5px] font-medium text-foreground truncate">
						{account.name}
					</span>
					<span className="block text-[11.5px] text-muted">
						{t.accounts.archivedNote}
					</span>
				</span>
			</button>

			<div className="flex flex-col items-end gap-1 shrink-0">
				<span className="text-[14.5px] font-semibold text-foreground">
					{formatMoney(account.balance, { locale, currency: DISPLAY_CURRENCY, decimals: 2 })}
				</span>
				{action}
			</div>
		</div>
	);
}
