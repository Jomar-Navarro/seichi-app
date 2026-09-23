"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Archive, Pencil, Plus, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import AccountSheet from "./AccountSheet";
import EmptyState from "@/components/UI/EmptyState";
import DashedAddButton from "@/components/UI/DashedAddButton";
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
			<div className="flex items-start justify-between mb-1.5 lg:items-center lg:mb-0">
				<div>
					<h1 className="text-[26px] font-semibold leading-tight lg:text-[30px] lg:tracking-[-0.6px]">
						{t.accounts.title}
					</h1>
					<p className="text-[12.5px] text-muted mt-1 lg:text-[13px] lg:mt-1.5">
						{plural(t.accounts.activeCount, active.length, locale)}
					</p>
				</div>
				<button
					onClick={openCreate}
					// issue #69 — py-3.5 invece di py-2.5: ~44px, isolato a fine header.
					//
					// lg: il bottone PRIMARIO del mockup desktop (#108), lo stesso
					// `btn-primary` di "Aggiungi transazione" nella sidebar — alto 44,
					// raggio 16, niente ombra. ⚠️ Il fondo mobile è passato dallo
					// `style` inline alla classe `bg-surface-elevated` (stesso valore,
					// stessa resa): una dichiarazione inline batte qualunque classe, e
					// `lg:btn-primary` non avrebbe mai potuto sostituirla.
					className="flex items-center gap-1.5 px-4 py-3.5 rounded-full text-[12.5px] font-semibold card-shadow-ring shrink-0 bg-surface-elevated lg:btn-primary lg:shadow-none lg:h-11 lg:py-0 lg:px-5 lg:gap-2 lg:rounded-2xl lg:text-[13.5px] lg:cursor-pointer"
				>
					{/* `size` scrive gli attributi dell'SVG; le classi li scavalcano da lg (16px). */}
					<Plus size={13} strokeWidth={2.2} className="lg:w-4 lg:h-4" />
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
				/*
				 * Sotto lg: una colonna, saldo sopra e conti sotto — com'è sempre stata.
				 * lg (contenuto largo ≈688px): lo stesso ordine, con le righe del
				 * mockup desktop. xl: due colonne `1fr 1.6fr` (#108), il saldo fermo a
				 * sinistra e l'elenco a destra.
				 *
				 * ⚠️ È una revisione DELIBERATA della 28b, che qui aveva messo i conti
				 * in griglia a 2/3 colonne con il saldo a tutta larghezza sopra. Il
				 * mockup desktop della #108 va nel verso opposto — una colonna sola di
				 * righe larghe accanto al saldo — e ha ragione: una riga conto si
				 * legge da sinistra a destra (icona, nome, saldo), e spezzata in
				 * tessere strette il saldo finiva a ridosso del nome.
				 */
				<div className="relative flex flex-col gap-3 mt-5 lg:mt-7 lg:gap-5 xl:grid xl:grid-cols-[1fr_1.6fr] xl:items-start">
					{/*
						⚠️ Copre l'INTERO viewport, non solo la lista: "il tap altrove lo
						chiude" (issue #62) vale anche per la card del saldo e per lo
						spazio vuoto, non solo per le altre righe — quelle si chiudono da
						sole (vedi `handleTap` nelle righe), qui serve per il resto.
						z-20, sotto le righe (z-30) e ben sotto i fogli modali (z-40/50):
						sparisce prima che "Modifica" possa aprirne uno.
						`fixed`, quindi fuori dal flusso della griglia di xl: non occupa
						una cella.
					*/}
					{openId !== null && (
						<div className="fixed inset-0 z-20" onClick={() => setOpenId(null)} />
					)}

					{/* Il saldo complessivo dei soli conti attivi. */}
					{/* ⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto. */}
					<div className="relative rounded-3xl card-shadow-ring overflow-hidden lg:rounded-[28px]">
						<div className="absolute inset-0 bg-surface backdrop-blur-md" />
						<div className="relative p-5 lg:pt-6.5 lg:px-7 lg:pb-6">
						<p className="text-sm text-muted mb-2 lg:text-[12.5px] lg:mb-2.5">{t.accounts.balanceHeading}</p>
						{/*
							⚠️ NEUTRO anche a 46px (Fase 20): una giacenza non è né buona né
							cattiva, semplicemente è. Il verde lo porta il flusso, non questo.
						*/}
						<p className="font-semibold tracking-tight flex items-baseline gap-0.5">
							<span className="text-2xl font-semibold mr-1 lg:text-[28px]">
								{currencySymbol(DISPLAY_CURRENCY, locale)}
							</span>
							<span className="text-4xl lg:text-[46px]">{sign}{integer}</span>
							<span className="text-2xl font-medium text-muted lg:text-[28px]">{decimal}</span>
						</p>
						{/*
							lg: la didascalia del mockup. Dice cosa somma — e soprattutto
							cosa NON somma — con la stessa frase della card saldo della home,
							così lo stesso numero ha la stessa spiegazione nei due posti.
							Su mobile manca, com'è sempre mancata: là il sottotitolo
							"N conti attivi" sta a un dito di distanza.
						*/}
						<p className="hidden lg:block text-[12px] text-muted leading-snug mt-3">
							{t.accounts.balanceExplainAll}
						</p>
						</div>
					</div>

					{/*
						L'elenco. ⚠️ `overflow-x: clip` da lg, ed è ciò che tiene il vassoio
						dentro la propria colonna.

						Il vassoio si rivela TRASLANDO la riga di `TRAY_WIDTH` a sinistra
						(vedi `ActiveAccountRow`). Su mobile quella parte finisce oltre il
						bordo dello schermo, e la ritaglia il contenitore di `(main)`. Su
						desktop a sinistra non c'è il bordo dello schermo: a xl c'è la card
						del saldo, a lg la sidebar — e la riga, che è `z-30`, ci passava
						SOPRA. Succedeva già con la griglia della 28b, dove le righe della
						prima colonna scivolavano sulla sidebar.

						`clip` e non `hidden`: un asse `hidden` rende non-visibile anche
						l'altro (la trappola già pagata col carosello della home), e le
						ombre sotto le righe sparirebbero; `clip` con `overflow-y: visible`
						resta visibile in verticale. E niente contesto di impilamento: lo
						z-20 del velo e lo z-30 delle righe restano confrontabili.

						`-mx-3 px-3` sposta il bordo del ritaglio 12px fuori dalle righe,
						così l'alone laterale della loro ombra (`0 8px 24px`) non viene
						tagliato a riposo. Il prezzo: una riga aperta mostra 12px oltre il
						proprio bordo — a xl dentro i 20px di distacco dal saldo.
					*/}
					<div className="flex flex-col gap-3 min-w-0 lg:overflow-x-clip lg:-mx-3 lg:px-3">
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

						{/*
							lg: la riga tratteggiata che chiude l'elenco nel mockup (#108) —
							lo stesso foglio del bottone in alto. Su mobile non c'è: il
							bottone dell'intestazione è a un pollice, e un secondo ingresso
							allungherebbe una lista che si scorre.
						*/}
						<div className="hidden lg:block">
							<DashedAddButton variant="row" label={t.accounts.newTitle} onClick={openCreate} />
						</div>

						{archived.length > 0 && (
							<>
								{/*
									Il mockup desktop non mostra gli archiviati, ma l'app li ha
									(Fase 20a): restano in coda all'elenco, sotto la riga
									"Nuovo conto" — che chiude la lista dei conti ATTIVI, cioè
									quelli a cui si aggiunge.
								*/}
								<p className="text-xs text-muted font-medium mt-1 mb-0.5 ml-1 tracking-wide lg:mt-3">
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
													// issue #69 — area toccabile allargata (il massimo che i
												// 4px verso l'importo sopra permettono): -m-3 p-3 con
												// -mt-1 pt-1 sul solo lato in alto, dove lo spazio è
												// stretto.
												className="-mx-3 -mb-3 -mt-1 px-3 pb-3 pt-1 flex items-center gap-1 text-[11.5px] font-semibold text-ao-ink lg:cursor-pointer"
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

	/*
	 * ⚠️ Il mouse non sa fare lo swipe — su desktop (Fase 28b) il vassoio si
	 * rivela al passaggio del mouse, invece che con un drag che non ha un
	 * gesto naturale equivalente. `hovered` è locale alla riga (mai passato
	 * al genitore): a differenza di `isOpen`, che vive nell'`openId`
	 * condiviso apposta per garantire "un vassoio aperto per volta"
	 * (issue #62), l'hover di per sé è già esclusivo — il mouse sta sopra
	 * una riga sola alla volta, per costruzione.
	 *
	 * ⚠️⚠️ Ma quell'esclusività vale SOLO fra righe in hover fra loro, non
	 * contro una riga aperta con lo swipe: `hovered` non passa mai da
	 * `openId`, quindi senza guardia una riga trascinata aperta (`isOpen`
	 * vero, backdrop a schermo) e una riga SOTTO IL MOUSE in quel momento
	 * (`hovered` vero, riga diversa) avrebbero mostrato **due vassoi aperti
	 * insieme** — l'invariante che l'`openId` condiviso esiste apposta per
	 * impedire, aggirato dal canale nuovo. `!anyOpen` chiude il buco: se
	 * QUALUNQUE riga è aperta via swipe, l'hover sulle altre non rivela
	 * finché quella non si richiude — `isOpen` copre comunque il caso in
	 * cui sia la riga aperta stessa a essere anche sotto il mouse.
	 */
	const [hovered, setHovered] = useState(false);
	const revealed = isOpen || (hovered && !anyOpen);

	const offset = dragOffset ?? (revealed ? -TRAY_WIDTH : 0);

	function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		// ⚠️ Azzerato a ogni NUOVO gesto, non solo in `handleTap`: senza, un
		// drag il cui click di chiusura il browser non sintetizza (capita su
		// alcuni browser mobili dopo un pan) lascerebbe il flag acceso per
		// sempre, e il primo tap genuino dopo quello swipe verrebbe ignorato
		// in silenzio invece di navigare.
		suppressClick.current = false;
		drag.current = { x: e.clientX, y: e.clientY, axis: null, base: revealed ? -TRAY_WIDTH : 0 };
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
	 *
	 * ⚠️ Vale anche per l'hover: un vassoio disegnato sotto una riga a
	 * riposo (non rivelata) sarebbe visibile in trasparenza esattamente
	 * come nel caso dello swipe — `revealed`, non `isOpen`, decide se
	 * montarlo.
	 */
	const traySmontato = !revealed && dragOffset === null;

	/*
	 * ⚠️ Eventi POINTER, non `onMouseEnter`/`onMouseLeave`. Un tap spinge
	 * `mouseenter` fino alla radice del documento — verificato con l'emulazione
	 * touch di Chromium (`hasTouch: true` + `page.touchscreen.tap()`, non un
	 * dispositivo fisico: resta da confermare da un telefono vero, come ogni
	 * altra API di questo tipo in questo progetto): il browser sintetizza
	 * l'intera catena mouseover → mouseenter, RISALENDO ogni antenato, per
	 * compatibilità con siti che ascoltano solo eventi mouse. Con
	 * `onMouseEnter` nudo, lo stesso tap che naviga a `/conti/[id]` avrebbe
	 * anche rivelato il vassoio per l'istante prima della navigazione — un
	 * lampo, non un blocco (la navigazione non dipende da `hovered`), ma
	 * comunque un tocco che dice "sto passando il mouse" mentre non c'è
	 * alcun mouse.
	 *
	 * ⚠️⚠️ Filtrato su `pressure === 0`, non su `pointerType`. Il primo
	 * tentativo escludeva `pointerType === "touch"` (poi allargato a
	 * `!== "touch"` per non perdere le penne con hover reale) — ma un
	 * NOME di dispositivo non è la domanda giusta: la domanda è "questo
	 * pointer sta davvero sopra, o è già in contatto?", e quella la
	 * `pressure` la dice direttamente. Una penna SENZA hardware di hover
	 * (un Apple Pencil di prima generazione, per dire) tocca lo schermo
	 * senza una fase di avvicinamento — genera un `pointerenter` nativo
	 * identico a quello del touch, con `pointerType: "pen"`: un filtro per
	 * nome l'avrebbe lasciato passare, riaprendo lo stesso lampo per una
	 * platea diversa. `pressure` non pretende di sapere COSA sta toccando,
	 * solo SE sta toccando — la stessa domanda in una forma che nessun
	 * elenco di stringhe di dispositivo può esaurire.
	 *
	 * Verificato con la stessa emulazione: il `pointerenter` che arriva a
	 * questo wrapper riporta `pressure: 1` per un tap (in contatto) e
	 * `pressure: 0` per un mouse o una penna in hover, senza alcun bottone
	 * premuto — nessuno dei due è stato confermato su un dispositivo fisico.
	 */
	function onRowPointerEnter(e: PointerEvent<HTMLDivElement>) {
		if (e.pressure === 0) setHovered(true);
	}
	function onRowPointerLeave(e: PointerEvent<HTMLDivElement>) {
		if (e.pressure === 0) setHovered(false);
	}

	return (
		/*
		 * `group`: da lg il vetro della riga schiarisce al passaggio del mouse
		 * (mockup #108). Sul contenitore e non sul `<button>`, per la stessa
		 * ragione per cui `hovered` si ascolta qui — il mouse può stare sul
		 * vassoio appena rivelato, e la riga deve restare "sotto il mouse".
		 * ⚠️ Solo aspetto: l'hover-reveal resta quello di `onRowPointerEnter`,
		 * e `hover:` in Tailwind v4 vive dentro `@media (hover: hover)`, quindi
		 * un tap non lo accende.
		 */
		<div
			className="group relative z-30"
			onPointerEnter={onRowPointerEnter}
			onPointerLeave={onRowPointerLeave}
		>
			{!traySmontato && (
				<div className="absolute inset-0 flex items-center justify-end gap-2 px-3 rounded-3xl lg:rounded-[22px]">
					<button
						onClick={(e) => {
							e.stopPropagation();
							onClose();
							onEdit();
						}}
						aria-label={t.common.edit}
						className="w-11 h-11 rounded-2xl flex items-center justify-center bg-control ring-border shrink-0 lg:cursor-pointer"
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
						className="w-11 h-11 rounded-2xl flex items-center justify-center bg-control ring-border shrink-0 lg:cursor-pointer"
					>
						<Archive size={17} style={{ color: "var(--ink-aka)" }} />
					</button>
				</div>
			)}

			{/*
				⚠️ TRE livelli sulla riga — issue #81. `overflow-hidden` da solo
				non basta (verificato da Firefox). Guscio (il `<button>`: arrotonda,
				ritaglia, trasla) → vetro (assoluto, riempie, sfoca) → contenuto
				(`p-4`, ciò che si vede).
			*/}
			<button
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onPointerCancel={onPointerUp}
				onClick={handleTap}
				// `revealed`, non `isOpen`: da questa fase il vassoio si vede anche
				// sotto hover del mouse, non solo a swipe completato. `aria-expanded`
				// deve seguire ciò che è VISIBILE, o direbbe "chiuso" a chi usa
				// l'accessibilità mentre le pastiglie Modifica/Archivia sono a
				// schermo e già montate nel DOM.
				aria-expanded={revealed}
				style={{ transform: `translateX(${offset}px)`, touchAction: "pan-y" }}
				// lg: la riga del mockup desktop (#108) — raggio 22, 18/20 di
				// margine interno, tessera 44 a raggio 15. Il vassoio da 120px ci sta
				// con largo avanzo: la riga più stretta è quella di lg, ≈688px.
				className={`relative w-full rounded-3xl card-shadow-ring overflow-hidden text-left lg:rounded-[22px] lg:cursor-pointer ${
					dragOffset === null ? "transition-transform duration-200" : ""
				}`}
			>
				<span className="absolute inset-0 bg-surface backdrop-blur-md lg:transition-colors lg:group-hover:bg-surface-elevated" />
				<span className="relative flex items-center gap-3 p-4 lg:gap-3.75 lg:py-4.5 lg:px-5">
					<span
						className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 lg:rounded-[15px]"
						style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
					>
						<Icon size={19} style={{ color }} />
					</span>

					<span className="flex-1 min-w-0">
						<span className="block text-[14.5px] font-medium text-foreground truncate lg:text-[15px] lg:font-semibold">
							{account.name}
						</span>
						<span className="block text-[11.5px] text-muted lg:text-[12px] lg:mt-0.5">
							{accountTypeLabel(account.type, t)}
						</span>
					</span>

					<span className="text-[14.5px] font-semibold text-foreground shrink-0 lg:text-[16px]">
						{formatMoney(account.balance, { locale, currency: DISPLAY_CURRENCY, decimals: 2 })}
					</span>
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
		/* ⚠️ TRE livelli — issue #81. Guscio (opacità, ritaglio) → vetro → contenuto. */
		/* lg: la stessa geometria delle righe attive (#108), o i due elenchi uno
		   sotto l'altro avrebbero raggi e margini diversi. */
		<div className="group relative z-30 w-full rounded-3xl card-shadow-ring overflow-hidden opacity-55 lg:rounded-[22px]">
			<div className="absolute inset-0 bg-surface backdrop-blur-md lg:transition-colors lg:group-hover:bg-surface-elevated" />
			<div className="relative flex items-center gap-3 p-4 lg:gap-3.75 lg:py-4.5 lg:px-5">
			<button onClick={handleTap} className="flex items-center gap-3 flex-1 min-w-0 text-left lg:gap-3.75 lg:cursor-pointer">
				<span
					className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 lg:rounded-[15px]"
					style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
				>
					<Icon size={19} style={{ color }} />
				</span>

				<span className="flex-1 min-w-0">
					<span className="block text-[14.5px] font-medium text-foreground truncate lg:text-[15px] lg:font-semibold">
						{account.name}
					</span>
					<span className="block text-[11.5px] text-muted lg:text-[12px] lg:mt-0.5">
						{t.accounts.archivedNote}
					</span>
				</span>
			</button>

			<div className="flex flex-col items-end gap-1 shrink-0">
				<span className="text-[14.5px] font-semibold text-foreground lg:text-[16px]">
					{formatMoney(account.balance, { locale, currency: DISPLAY_CURRENCY, decimals: 2 })}
				</span>
				{action}
			</div>
			</div>
		</div>
	);
}
