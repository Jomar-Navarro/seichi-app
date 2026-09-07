"use client";

import { ChevronLeft, ChevronRight, X, Check, Delete } from "lucide-react";
import { useState, useEffect } from "react";
import { useUIStore } from "@/store/useUIStore";
import { TRANSACTION_TYPES } from "@/types";
import TransactionForm from "./TransactionForm";
import { useI18n } from "@/components/features/I18nProvider";
import { useCloseOnBack } from "./useCloseOnBack";
import { DISPLAY_CURRENCY, currencySymbol, formatMoney } from "@/lib/i18n/format";

/*
 * issue #86 — pillole di importo rapido, sul modello di Revolut ma con
 * valori fissi (deciso: non dipendono dal tipo di movimento, altrimenti
 * servirebbe una tabella di taglie diverse per sette tipi senza un criterio
 * ovvio). Modulo, non dentro il componente: sono una costante, non uno
 * stato — ricalcolarle a ogni render non avrebbe senso.
 */
const QUICK_AMOUNTS = [5, 10, 20, 50, 100];

/**
 * ⚠️ Diviso in due, e il guscio esiste solo per decidere il MONTAGGIO.
 *
 * Questo componente lo rende il layout di `(main)`, quindi non c'è un genitore
 * che possa montarlo e smontarlo come fanno `GoalSheet`, `CategorySheet` e
 * `RecurringSheet`. Prima restava perciò montato per sempre e si nascondeva da
 * sé, con `step` che sopravviveva alla chiusura e andava riportato al valore
 * giusto in un `useLayoutEffect` — un render a cascata a ogni apertura.
 *
 * Ora il guscio legge lo store e monta il contenuto solo da aperto. La `key`
 * distingue "modifica questa transazione" da "nuova": passando dall'una all'altra
 * senza chiudere, React rimonta invece di riusare `step`.
 */
export default function TransactionModal() {
	const { isTransactionModalOpen, editingTransaction } = useUIStore();

	if (!isTransactionModalOpen) return null;

	return <TransactionModalContent key={editingTransaction?.id ?? "new"} />;
}

function TransactionModalContent() {
	const {
		selectedTransactionType,
		editingTransaction,
		closeTransactionModal,
		setTransactionType,
	} = useUIStore();
	const { t, locale } = useI18n();

	/*
	 * ⚠️ Terzo passo, non due — issue #86. Importo e tastierino stavano IN
	 * CIMA al form insieme a categoria, conto, descrizione, data, ricorrenza
	 * e ricevute: su qualunque telefono reale quell'insieme non ci sta mai
	 * tutto a schermo, e per digitare l'importo bisognava scorrere fino in
	 * fondo — mentre lo si scriveva, il totale non si vedeva più.
	 *
	 * Spostare SOLO il tastierino accanto all'importo (correzione
	 * precedente, stesso giro) risolveva "non vedo cosa scrivo" ma non "non
	 * ci sta tutto": categoria+conto+descrizione+data+ricorrenza+ricevute+
	 * salva insieme non ci stanno su nessuno schermo di telefono, per quanto
	 * si comprima.
	 *
	 * La forma che risolve DAVVERO è un passo a sé, sul modello già esistente
	 * di "che tipo": importo + tastierino occupano tutto lo schermo SENZA
	 * scorrere (ci stanno comodamente, è il resto che non entra), poi
	 * "Continua" porta al resto dei campi — che restano scorribili, com'è
	 * normale per un form con tanti campi opzionali.
	 */
	const [step, setStep] = useState<"type" | "amount" | "form">(
		editingTransaction ? "amount" : "type",
	);

	// Vive qui e non in TransactionForm: il passo "importo" ha bisogno di
	// leggerlo e scriverlo PRIMA che TransactionForm esista (monta solo al
	// passo "form"). Stessa inizializzazione che aveva TransactionForm.
	const [amount, setAmount] = useState(() =>
		editingTransaction
			? editingTransaction.amount.toFixed(2).replace(".", ",")
			: "",
	);
	const AMOUNT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"];
	function handleAmountKey(key: string) {
		if (key === "⌫") {
			setAmount((prev) => prev.slice(0, -1));
			return;
		}
		if (key === ",") {
			setAmount((prev) => (prev.includes(",") ? prev : prev + ","));
			return;
		}
		setAmount((prev) => prev + key);
	}
	const amountValid = amount !== "" && parseFloat(amount.replace(",", ".")) > 0;

	// Blocca lo scroll della pagina dietro il modale. Ora che il componente vive
	// solo da aperto, la guardia sullo stato del modale non serve: montaggio e
	// smontaggio SONO apertura e chiusura, e il ripristino torna a essere un
	// normale cleanup.
	useEffect(() => {
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, []);

	const selectedType = editingTransaction
		? TRANSACTION_TYPES.find((t) => t.id === editingTransaction.type) ?? TRANSACTION_TYPES[0]
		: TRANSACTION_TYPES.find((t) => t.id === selectedTransactionType);

	function handleTypeSelect(id: string) {
		setTransactionType(id);
		setStep("amount");
	}

	// Nessun `setStep("type")` qui: chiudere smonta, e con lo smontaggio `step`
	// se ne va da sé. Riportarlo a mano era la contropartita del componente che
	// restava vivo per sempre.
	function handleClose() {
		closeTransactionModal();
	}

	// issue #86 — vedi useCloseOnBack: neutralizza l'edge-swipe di WKWebView
	// che altrimenti naviga la pagina SOTTO invece di restare nel modale. È
	// il caso esplicitamente segnalato dall'issue: aggiungere un movimento.
	useCloseOnBack(handleClose);

	return (
		<div className="fixed inset-0 z-50 flex items-end">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={handleClose}
			/>

			{/*
				Sheet — TRE livelli (issue #81, i quadrati di Firefox).
				`overflow-hidden` da solo non basta (verificato da Firefox): guscio
				(arrotonda, ritaglia) → vetro (sfoca) → contenuto (`h-full flex
				flex-col`, il padding). Stesso schema di `BottomSheetShell`.
			*/}
			{/*
				⚠️ `modal-shadow`, non `modal-shadow-ring`: resta l'ombra a caduta
				più il filo di luce in alto, senza l'anello colorato — issue #86.

				⚠️⚠️ Nessun `rounded-t-*`: la richiesta era il RAGGIO, non l'anello
				(il primo giro aveva frainteso "bordi" come l'anello, non gli
				angoli). Con `h-dvh` il foglio tocca già cima e fondo reali dello
				schermo: un angolo arrotondato lì sopra sembrava una card che
				galleggia sotto la notch invece di uno schermo intero. Gli altri
				fogli (`BottomSheetShell`, `90dvh`, DAVVERO sospesi sopra il resto
				della pagina) restano arrotondati apposta — è un caso diverso.
			*/}
			<div className="relative w-full h-dvh overflow-hidden modal-shadow">
				<div className="absolute inset-0 bg-modal backdrop-blur-2xl" />
				<div
					className="relative w-full h-full flex flex-col px-6"
					// issue #86 — `h-dvh` fa toccare al foglio SIA il fondo sia la
					// cima reali dello schermo: a differenza di `BottomSheetShell`
					// (che si ferma a `90dvh`) serve l'inset anche in alto, o il
					// manico finisce sotto la notch. `max()` mantiene il respiro
					// originale (`pt-3.5`/`pb-6.5`) sui device senza notch, dove
					// l'inset è 0.
					style={{
						paddingTop: "max(0.875rem, env(safe-area-inset-top))",
						paddingBottom: "max(1.625rem, env(safe-area-inset-bottom))",
					}}
				>
				{/* Handle */}
				<div className="w-10 h-1 rounded-full mx-auto mb-1 bg-modal-handle" />

				{/* Header */}
				<div className="flex items-start justify-between mt-3 mb-4">
					<div className="flex items-center gap-2">
						{/*
							issue #86 — "indietro" ora ha due destinazioni possibili, non
							una: dal passo "importo" si torna al tipo (solo in creazione,
							editare non passa mai da lì); dal passo "dettagli" si torna
							all'importo — SEMPRE, anche editando, perché lì l'importo va
							corretto quanto gli altri campi.
						*/}
						{/*
							issue #86 — da w-8/32px a w-11/44px, il minimo di Apple HIG
							per un bersaglio toccabile: da telefono era piccolo e
							difficile da centrare col dito, swipe o no — il gesto è una
							SECONDA via, non sostituisce un bottone comodo.
						*/}
						{((step === "amount" && !editingTransaction) || step === "form") && (
							<button
								onClick={() => setStep(step === "form" ? "amount" : "type")}
								className="w-11 h-11 flex items-center justify-center rounded-xl shrink-0 bg-control ring-border"
							>
								<ChevronLeft size={19} />
							</button>
						)}
						<div>
							{step !== "type" && selectedType && (
								<p
									className="text-xs font-medium mb-0.5"
									style={{ color: selectedType.color }}
								>
									{t.transactionTypes[selectedType.id].label}
								</p>
							)}
							<h2 className="text-xl font-semibold">
								{editingTransaction ? t.transactions.modalEdit : t.transactions.modalNew}
							</h2>
							{step === "type" && (
								<p className="text-sm text-muted mt-1">
									{t.transactions.modalTypeQuestion}
								</p>
							)}
						</div>
					</div>
					<button
						onClick={handleClose}
						className="w-11 h-11 flex items-center justify-center rounded-xl shrink-0 bg-control ring-border"
					>
						<X size={18} />
					</button>
				</div>

				{/* Step: type selector */}
				{step === "type" && (
					/*
					 * ⚠️ Il numero di righe si CALCOLA, e prima era cablato a
					 * `grid-rows-3`.
					 *
					 * Con sei tipi la griglia 2×3 era esatta e il numero fisso
					 * coincideva; col settimo (`disinvestimento`, #52) servono quattro
					 * righe — tre coppie più la card larga — e le card in eccesso
					 * finivano in una riga IMPLICITA, dimensionata dal contenuto, dentro
					 * un contenitore `flex-1 min-h-0` che non può crescere: le tre righe
					 * esplicite si schiacciavano per farle posto.
					 *
					 * È lo stesso difetto di `spansFullRow` qui sotto — un numero scritto
					 * a mano che coincide con la realtà finché nessuno aggiunge un tipo —
					 * e si chiude allo stesso modo: derivandolo dall'array, che è
					 * l'unica fonte che non può divergere da sé.
					 *
					 * `gridTemplateRows` inline e non una classe Tailwind: le classi sono
					 * statiche, quindi `grid-rows-${n}` non verrebbe generata e
					 * fallirebbe in silenzio — la famiglia di difetti che
					 * `npm run audit:tokens` esiste per intercettare.
					 */
					<div
						className="flex-1 min-h-0 grid grid-cols-2 gap-2.25"
						style={{
							gridTemplateRows: `repeat(${Math.ceil(
								TRANSACTION_TYPES.length / 2,
							)}, minmax(0, 1fr))`,
						}}
					>
						{TRANSACTION_TYPES.map((type, i) => {
							const Icon = type.icon;
							/*
								⚠️ La card a tutta larghezza serve a RIEMPIRE una griglia
								dispari, non a dare risalto all'ultimo tipo.
								Era `i === length - 1`, e con cinque tipi coincideva: la
								quinta card chiudeva la terza riga da sola. Aggiungendo
								`trasferimento` i tipi sono sei — la griglia 2×3 è esatta — e
								quella stessa riga avrebbe messo la sesta card su una quarta
								riga inesistente, dentro un contenitore `flex-1 min-h-0` che
								non può crescere: le card si sarebbero schiacciate e l'ultima
								sarebbe uscita dal riquadro.
								Il difetto non lo vede né `tsc` né il lint. Si vede aprendo
								il modale — e solo dopo aver aggiunto un tipo, cioè una volta
								ogni due anni.
							*/
							const spansFullRow =
								TRANSACTION_TYPES.length % 2 === 1 && i === TRANSACTION_TYPES.length - 1;
							const isSelected = selectedTransactionType === type.id;

							const card = (
								<button
									key={type.id}
									onClick={() => handleTypeSelect(type.id)}
									className="transaction-type-card"
									// issue #81 — anello (box-shadow) invece di bordo: qui il
									// colore è traslucido (36%) come `.transaction-type-card`
									// già corregge in `globals.css`, ma la selezione lo
									// sovrascriveva con un `border` vero.
									style={
										isSelected
											? {
													background: `color-mix(in srgb, ${type.color} 14%, transparent)`,
													boxShadow: `color-mix(in srgb, ${type.color} 36%, transparent) 0px 0px 0px 1px inset`,
												}
											: {}
									}
								>
									{isSelected ? (
										<span
											className="absolute top-3 right-3.5 text-xs font-semibold"
											style={{ color: type.color }}
										>
											<Check size={18} />
										</span>
									) : (
										<ChevronRight
											size={14}
											className="absolute top-3 right-3 text-muted"
										/>
									)}

									<div
										className="w-11 h-11 rounded-xl flex items-center justify-center"
										style={{
											background: `color-mix(in srgb, ${type.color} 20%, transparent)`,
										}}
									>
										<Icon size={20} style={{ color: type.color }} />
									</div>

									<div>
										<p className="font-semibold text-sm">{t.transactionTypes[type.id].label}</p>
										<p className="text-[11px] text-muted mt-0.5 leading-tight">
											{t.transactionTypes[type.id].description}
										</p>
									</div>
								</button>
							);

							if (spansFullRow) {
								return (
									<div key={type.id} className="col-span-2">
										{card}
									</div>
								);
							}

							return card;
						})}
					</div>
				)}

				{/*
					Step: importo — issue #86. Occupa lo schermo da solo apposta: è
					la coppia (totale + tastierino) che deve restare visibile insieme
					SEMPRE, senza dipendere da quanti altri campi il tipo scelto porta
					con sé nel passo successivo.
				*/}
				{step === "amount" && selectedType && (
					/*
						⚠️⚠️⚠️ Terzo tentativo. I primi due, entrambi verificati e
						respinti a vista:
						1. righe della griglia fatte crescere (`1fr`) fino a riempire
						   TUTTO lo spazio avanzato: tasti allungati in rettangoli
						   verticali, "orribile";
						2. tasti alla dimensione fissa originale, blocco centrato: lo
						   spazio vuoto si divide sopra/sotto invece che ammassarsi in
						   fondo, ma "orribile" lo stesso — troppo piccolo per lo
						   schermo che c'è.

						Il punto che i primi due mancavano: la richiesta non era "non
						lasciare vuoto" né "non deformare i tasti" isolatamente, era un
						rapporto ESPLICITO fra le due zone — 60% alla tastiera, 40%
						all'importo (era 70/30: ridotto su richiesta, la tastiera
						occupava troppo). `flex-grow` (6 e 4) invece di un'altezza fissa
						o "riempi tutto": le due zone si dividono lo spazio VERO
						disponibile in quella proporzione, su qualunque schermo — e
						dentro la zona tastiera la griglia `1fr` produce celle vicine al
						quadrato invece che allungate, perché non sta crescendo senza un
						limite.
					*/
					<div className="flex-1 min-h-0 flex flex-col pb-19">
						<div className="flex flex-col items-center justify-center min-h-0" style={{ flex: 4 }}>
							<p className="text-muted text-base mb-2">{t.transactions.form.amount}</p>
							<div className="text-8xl font-bold tracking-tight">
								<span className="text-4xl mr-1">{currencySymbol(DISPLAY_CURRENCY, locale)}</span>
								{amount || "0"}
							</div>
						</div>

						{/*
							Pillole di importo rapido — issue #86. Toccarne una SOSTITUISCE
							l'importo (non lo somma a quanto già digitato): è una scorciatoia
							per l'importo intero, non un secondo modo di scrivere le cifre —
							i due si confonderebbero se convivessero sullo stesso gesto.

							⚠️ `grid grid-cols-5`, non più `flex` col contenuto che decide la
							propria larghezza: le cinque colonne sono UGUALI e coprono
							l'intera riga per costruzione, invece di raggrupparsi al centro
							lasciando margine ai lati. È anche ciò che permette di farle un
							po' più grandi senza tornare a traboccare (issue #86, giro
							precedente): lo spazio di ogni pillola non dipende più dal
							testo più largo del gruppo ("€ 100"), è fisso a 1/5 della riga.
						*/}
						<div className="grid grid-cols-5 gap-2 mb-3 shrink-0">
							{QUICK_AMOUNTS.map((v) => (
								<button
									key={v}
									type="button"
									onClick={() => setAmount(String(v))}
									className="px-1 py-2.5 rounded-full text-sm font-semibold card-shadow-ring"
								>
									{formatMoney(v, { locale, currency: DISPLAY_CURRENCY })}
								</button>
							))}
						</div>

						{/*
							Tastierino — issue #86. Due varianti tentate e scartate a vista
							(card con sfumatura "liquid glass", poi tasti nudi "stile
							Revolut"): questa è la card semplice del secondo tentativo
							(70/30), quella già approvata prima di iniziare a cambiarne
							l'aspetto — issue #81, anello invece di bordo.
						*/}
						<div
							className="grid grid-cols-3 gap-2.5 min-h-0"
							style={{ flex: 6, gridTemplateRows: "repeat(4, minmax(0, 1fr))" }}
						>
							{AMOUNT_KEYS.map((key, i) => (
								<button
									key={i}
									type="button"
									onPointerDown={(e) => {
										e.preventDefault();
										handleAmountKey(key);
									}}
									className="flex items-center justify-center rounded-2xl bg-card ring-border text-2xl font-medium"
								>
									{key === "⌫" ? <Delete size={20} /> : key}
								</button>
							))}
						</div>

						{/*
							⚠️ `fixed`, non più l'ultimo elemento del flex-col — issue #86.
							Prima la sua posizione era un RISULTATO del rapporto 40/60 sopra
							di lui; ora è un punto fisso indipendente, sempre alla stessa
							altezza sullo schermo qualunque cosa succeda al contenuto sopra.
							`left-6 right-6` ripete il `px-6` del foglio (qui non è dentro
							quel contenitore), e il fondo rispetta la stessa safe-area del
							padding generale. Il wrapper qui sopra riserva lo spazio con
							`pb-19`, o il tastierino finirebbe nascosto sotto.
						*/}
						<button
							onClick={() => setStep("form")}
							disabled={!amountValid}
							className="fixed left-6 right-6 py-4 rounded-2xl btn-primary font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
							style={{ bottom: "max(1.625rem, env(safe-area-inset-bottom))" }}
						>
							{t.common.continue}
						</button>
					</div>
				)}

				{/* Step: dettagli */}
				{step === "form" && selectedType && (
					<TransactionForm
						selectedType={selectedType}
						transaction={editingTransaction ?? undefined}
						amount={amount}
					/>
				)}
				</div>
			</div>
		</div>
	);
}
