"use client";
import { useEffect, useRef, useState } from "react";
import { TransactionType, Category, Transaction, Frequency, Account } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Delete, Check, Trash2, Repeat } from "lucide-react";
import Select, { type Option } from "@/components/UI/Select";
import { ACCOUNT_ICON_FALLBACK, ACCOUNT_TYPE_ICON, accountColor } from "@/lib/accounts";
import FrequencySelector from "@/components/UI/FrequencySelector";
import { SwitchVisual } from "@/components/UI/Switch";
import { categoryTypeFor } from "@/lib/transaction-utils";
import AttachmentPicker, {
	type AttachmentPickerHandle,
} from "@/components/features/AttachmentPicker";
import { buildCategoryOptions } from "@/lib/category-options";
import {
	saveTransaction,
	updateTransaction,
	deleteTransaction,
	createRecurringRule,
} from "@/app/(main)/action";
import { useUIStore } from "@/store/useUIStore";
import DatePicker from "@/components/UI/DatePicker";
import { useI18n } from "@/components/features/I18nProvider";
import { DISPLAY_CURRENCY, currencySymbol } from "@/lib/i18n/format";

/**
 * ⚠️ Il calendario NON sta più qui.
 *
 * Questo file conteneva un picker inline completo — griglia dei giorni,
 * navigazione dei mesi, intestazione della settimana — che nella Fase 19 è stato
 * spostato in `components/UI/DatePicker.tsx` per darlo anche a `GoalSheet` e
 * `RecurringSheet`, che usavano ancora `<input type="date">`. Per un po' le due
 * copie sono coesistite: sbagliato, e già stavano divergendo (`min` e il comando
 * "svuota" esistevano solo nella nuova). Ora il picker è uno solo.
 */
interface TransactionFormProps {
	selectedType: TransactionType;
	transaction?: Transaction;
}

export default function TransactionForm({
	selectedType,
	transaction,
}: TransactionFormProps) {
	const { locale, t } = useI18n();
	const isEditing = !!transaction;

	const [amount, setAmount] = useState(() =>
		transaction ? transaction.amount.toFixed(2).replace(".", ",") : "",
	);
	const [categoryId, setCategoryId] = useState<string | null>(
		transaction?.category_id ?? null,
	);
	const [description, setDescription] = useState<string | null>(
		transaction?.notes ?? null,
	);
	const [date, setDate] = useState(() =>
		transaction ? new Date(transaction.date) : new Date(),
	);
	const [categoryList, setCategoryList] = useState<Category[]>([]);
	/*
	 * ⚠️ `accountId` parte da `null` anche in creazione, e viene riempito quando
	 * i conti arrivano — non con un valore inventato. `account_id` è NOT NULL nel
	 * database: un default sbagliato scriverebbe il movimento sul conto
	 * sbagliato, in silenzio, che è peggio di un salvataggio bloccato per un
	 * istante. Il bottone resta disabilitato finché un conto non c'è davvero.
	 */
	const [accountList, setAccountList] = useState<Account[]>([]);
	const [accountId, setAccountId] = useState<string | null>(
		transaction?.account_id ?? null,
	);
	const [toAccountId, setToAccountId] = useState<string | null>(
		transaction?.to_account_id ?? null,
	);
	const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	/*
	 * Le ricevute scelte prima che il movimento esista (Fase 22) vivono nel
	 * BROWSER finché non c'è un id a cui appenderle — e vivono dentro il picker,
	 * che è il loro unico proprietario.
	 *
	 * ⚠️ Qui c'era una copia derivata (`File[]` aggiornata da `onPendingChange`),
	 * e due proprietari per la stessa coda hanno prodotto un difetto vero:
	 * svuotando la copia dopo un caricamento fallito, il picker non lo sapeva e
	 * continuava a mostrare le miniature di file che nessuno avrebbe più
	 * caricato. Il form ora non tiene la coda: la CHIEDE.
	 */
	const pickerRef = useRef<AttachmentPickerHandle | null>(null);
	const [attachmentError, setAttachmentError] = useState<string | null>(null);
	/**
	 * L'id del movimento APPENA creato da questo form.
	 *
	 * ⚠️ Esiste per un caso solo, ed è quello che senza di lui produce dati
	 * sbagliati: il movimento è stato scritto ma il caricamento di una ricevuta è
	 * fallito, quindi il modale resta aperto. Da quel momento un secondo tocco su
	 * "Salva" deve AGGIORNARE quella riga, non crearne un'altra — altrimenti ogni
	 * tentativo lascerebbe un movimento duplicato, e il difetto si scoprirebbe
	 * contando i soldi invece che leggendo un errore.
	 */
	const [createdId, setCreatedId] = useState<string | null>(null);
	const { closeTransactionModal, notifyTransactionSaved, recurringDefault } =
		useUIStore();
	const [isRecurring, setIsRecurring] = useState(recurringDefault);
	const [frequency, setFrequency] = useState<Frequency>("mensile");

	/**
	 * Un trasferimento non ha categoria, un `risparmio` può avere una
	 * destinazione (Fase 20b).
	 *
	 * ⚠️ `isTransfer` è il punto in cui si rompe l'accoppiamento 1:1 fra tipo di
	 * transazione e tipo di categoria su cui questo form si è retto fino alla
	 * 20a. Non è una svista da sanare: è un CHECK del database
	 * (`transactions_transfer_category_check`), quindi mandare una categoria su
	 * un trasferimento non produce un dato strano, produce un errore.
	 */
	const isTransfer = selectedType.id === "trasferimento";
	/*
	 * ⚠️ La destinazione FACOLTATIVA su risparmio e investimento è ciò che rende
	 * il doppio conteggio impossibile invece che sconsigliato. Senza, mettere
	 * 200 € da parte sarebbe esprimibile due volte — un `risparmio` verso un
	 * obiettivo oppure un trasferimento verso il "Libretto" — e chi facesse
	 * entrambi vedrebbe uscire 400 € dal conto corrente.
	 */
	const canHaveDestination =
		isTransfer || selectedType.id === "risparmio" || selectedType.id === "investimento";

	useEffect(() => {
		/*
		 * Un trasferimento non ha categoria: la query non si fa proprio.
		 * `categories_type_check` non ammette `trasferimento`, quindi tornerebbe
		 * comunque vuota.
		 *
		 * ⚠️ Si esce SENZA azzerare `categoryList`: un `setState` sincrono nel
		 * corpo di un effetto è un render a cascata (`react-hooks/
		 * set-state-in-effect`). La lista resta quella del tipo precedente e non
		 * fa danno, perché il selettore categoria non viene renderizzato e
		 * `handleSave` manda `null` — la scelta di cosa scrivere non si appoggia a
		 * ciò che è rimasto in memoria.
		 */
		if (isTransfer) return;
		async function loadCategories() {
			const supabase = createClient();
			const { data } = await supabase
				.from("categories")
				.select("*")
				.eq("type", categoryTypeFor(selectedType.id));
			if (data) setCategoryList(data);
		}
		loadCategories();
	}, [selectedType.id, isTransfer]);

	/*
	 * I conti non dipendono dal tipo di movimento, quindi si caricano una volta
	 * sola — effetto separato invece che appeso a `selectedType.id`, o li
	 * ricaricherebbe a ogni cambio di tipo per niente.
	 *
	 * ⚠️ Si caricano TUTTI, archiviati compresi: la scelta di cosa è proponibile
	 * avviene più in basso (`effectiveAccountList`). Filtrare nella query
	 * lascerebbe senza opzione il conto di un movimento esistente poi archiviato.
	 */
	useEffect(() => {
		async function loadAccounts() {
			const supabase = createClient();
			const { data } = await supabase
				.from("accounts")
				.select("*")
				.order("created_at", { ascending: true });
			if (!data) return;
			setAccountList(data);
			// Il default per un movimento NUOVO è il primo conto ATTIVO: proporre
			// un archiviato significherebbe suggerire di scriverci sopra.
			setAccountId((current) => current ?? data.find((a) => !a.archived)?.id ?? null);
		}
		loadAccounts();
	}, []);

	const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"];

	const handleKey = (key: string) => {
		if (key === "⌫") {
			setAmount((prev) => prev.slice(0, -1));
			return;
		}
		if (key === ",") {
			setAmount((prev) => (prev.includes(",") ? prev : prev + ","));
			return;
		}
		setAmount((prev) => prev + key);
	};

	/*
	 * ⚠️ Le regole ricorrenti NON possono essere trasferimenti, e non basta
	 * ometterne il comando: `isRecurring` è uno stato che sopravvive al cambio di
	 * tipo (il form non si rimonta), quindi chi accende "Ripeti" su una spesa e
	 * poi passa a trasferimento salverebbe una regola che
	 * `recurring_rules_type_check` rifiuta. La riga sotto rende quella
	 * combinazione inesprimibile invece che vietata.
	 */
	const recurring = isRecurring && !isTransfer;

	/*
	 * Ciò che finisce davvero nel database, indipendentemente da cosa è rimasto
	 * negli stati dopo un cambio di tipo. I quattro CHECK della `20260815` non
	 * ammettono una categoria su un trasferimento né una destinazione su una
	 * spesa: derivare qui invece di sperare che gli stati siano coerenti è la
	 * differenza fra un form che non può sbagliare e uno che di solito non
	 * sbaglia.
	 */
	const effectiveCategoryId = isTransfer ? null : categoryId;
	const effectiveToAccountId = canHaveDestination ? toAccountId : null;

	// ⚠️ Il conto entra nella validità: `account_id` è NOT NULL, quindi senza un
	// conto il salvataggio fallirebbe comunque, ma dal database e con un
	// messaggio che parla di vincoli. Meglio un bottone spento.
	//
	// Per un trasferimento serve anche la destinazione, e diversa dall'origine:
	// sono i due CHECK `transactions_transfer_dest_check` e
	// `transactions_dest_distinct_check`.
	const isValid =
		amount !== "" &&
		parseFloat(amount.replace(",", ".")) > 0 &&
		accountId !== null &&
		(!isTransfer || (toAccountId !== null && toAccountId !== accountId));

	async function handleSave() {
		if (!isValid || isSaving || !accountId) return;
		setIsSaving(true);
		try {
			const importo = parseFloat(amount.replace(",", "."));
			/*
			 * ⚠️ `effectiveId` e non `isEditing`: dopo una creazione riuscita il
			 * movimento ESISTE anche se il modale è ancora aperto (una ricevuta non
			 * caricata lo tiene lì). Continuare a guardare `isEditing` — che dipende
			 * dalla prop e non cambia mai — manderebbe il secondo tentativo di nuovo
			 * su `saveTransaction`, cioè un movimento duplicato a ogni riprova.
			 */
			const effectiveId = transaction?.id ?? createdId;
			const result = effectiveId
				? await updateTransaction(
						effectiveId,
						importo,
						selectedType.id,
						effectiveCategoryId,
						description,
						date.toISOString(),
						accountId,
						effectiveToAccountId,
					)
				: recurring
					? await createRecurringRule(
							importo,
							selectedType.id,
							effectiveCategoryId,
							description,
							date.toLocaleDateString("sv-SE"), // YYYY-MM-DD in locale, no shift UTC
							frequency,
							accountId,
						)
					: await saveTransaction(
							importo,
							selectedType.id,
							effectiveCategoryId,
							description,
							date.toISOString(),
							accountId,
							effectiveToAccountId,
						);

			if (result?.error) return;

			/*
			 * Le ricevute scelte PRIMA del salvataggio si caricano adesso: solo ora
			 * esiste l'id a cui appenderle (Fase 22).
			 *
			 * ⚠️ `createdId` si ricorda, e non è un dettaglio: da questo momento il
			 * movimento ESISTE. Se un upload fallisce il modale resta aperto, e un
			 * secondo tocco su "Salva" deve AGGIORNARE quella riga, non crearne una
			 * seconda. Senza, un allegato che non passa produrrebbe un movimento
			 * duplicato a ogni tentativo — un difetto silenzioso che si scopre
			 * contando i soldi.
			 */
			const nuovoId =
				result && "id" in result ? (result as { id: string }).id : null;
			const targetId = transaction?.id ?? nuovoId ?? createdId;

			/*
			 * ⚠️ L'ordine conta, ed è tarato su due corse:
			 *
			 *  1. il caricamento PRIMA di `setCreatedId`. Impostare l'id fa passare
			 *     `transactionId` del picker da `null` a un valore, il che scatena la
			 *     sua rilettura degli allegati: partendo prima, quella rilettura
			 *     tornerebbe una lista vuota e potrebbe sovrascrivere le ricevute
			 *     appena caricate. Finito il caricamento, invece, rilegge la verità.
			 *  2. `setCreatedId` PRIMA dell'uscita anticipata, altrimenti una
			 *     ricevuta fallita lascerebbe il form convinto di dover ancora creare
			 *     il movimento — e ogni riprova ne scriverebbe uno nuovo.
			 */
			const attachmentFailure = targetId
				? await pickerRef.current?.uploadPending(targetId)
				: null;

			if (nuovoId) setCreatedId(nuovoId);

			if (attachmentFailure) {
				/*
				 * ⚠️ NON si chiude. Il movimento è salvato ma la ricevuta no, e
				 * chiudere lascerebbe l'utente convinto di avere una prova che non ha.
				 * Le ricevute non passate sono ancora in coda dentro il picker, che nel
				 * frattempo ha un id vero: il secondo "Salva" le riprende da lì, senza
				 * ricaricare quelle già andate a buon fine.
				 */
				setAttachmentError(attachmentFailure);
				return;
			}

			notifyTransactionSaved();
			closeTransactionModal();
		} finally {
			setIsSaving(false);
		}
	}

	async function handleDelete() {
		if (!transaction || isSaving) return;
		setIsSaving(true);
		try {
			const result = await deleteTransaction(transaction.id);
			if (!result?.error) {
				notifyTransactionSaved();
				closeTransactionModal();
			}
		} finally {
			setIsSaving(false);
		}
	}

	const effectiveCategoryList: Category[] =
		categoryList.length > 0
			? categoryList
			: isEditing && transaction.categories && transaction.category_id
				? [
						{
							id: transaction.category_id,
							user_id: "",
							name: transaction.categories.name,
							icon: transaction.categories.icon,
							color: transaction.categories.color,
							type: selectedType.id,
						},
					]
				: [];

	const categoryOptions = buildCategoryOptions(effectiveCategoryList);

	/*
	 * ⚠️ L'icona usa `accountColor`, che prende il colore CUSTOM del conto se c'è
	 * e ripiega su quello del tipo. Non si passa da `var(--color-${…})` come per
	 * le categorie: `accounts.color` contiene già una var() completa, mentre
	 * `categories.color` contiene il solo nome del token. Due colonne che si
	 * chiamano uguale e contengono cose diverse — vale la pena saperlo prima di
	 * unificarle.
	 */
	/*
	 * ⚠️ Un conto ARCHIVIATO collegato a una transazione esistente va aggiunto
	 * alle opzioni, o il campo appare vuoto.
	 *
	 * `loadAccounts` carica TUTTI i conti apposta e la selezione avviene qui:
	 * filtrando `archived = false` nella query, aprendo un vecchio movimento su
	 * un conto poi archiviato il `Select` non trovava l'opzione corrispondente e
	 * mostrava il segnaposto — un record CON un conto sembrava non averne, e
	 * l'utente veniva spinto a sceglierne un altro, spostando in silenzio un
	 * movimento storico. È lo stesso ripiego che `effectiveCategoryList` fa
	 * dodici righe più su per la categoria.
	 */
	const effectiveAccountList: Account[] = accountList.filter(
		(a) => !a.archived || a.id === accountId,
	);

	const toOption = (a: Account): Option => {
		const Icon = (a.type && ACCOUNT_TYPE_ICON[a.type]) || ACCOUNT_ICON_FALLBACK;
		const color = accountColor(a.type, a.color);
		return {
			value: a.id,
			label: a.name,
			icon: <Icon size={14} style={{ color }} />,
		};
	};

	const accountOptions: Option[] = effectiveAccountList.map(toOption);

	/*
	 * Le destinazioni proponibili.
	 *
	 * ⚠️ L'origine è esclusa, e non è cortesia: `transactions_dest_distinct_check`
	 * rifiuta un movimento verso se stesso. Toglierla dall'elenco è la forma
	 * corretta di quel vincolo per un umano — un'opzione che, scelta, produce un
	 * errore è un'opzione che non doveva esserci.
	 *
	 * ⚠️ Gli ARCHIVIATI restano fuori anche quando sono il valore corrente, al
	 * contrario dell'origine. La ragione è che le due colonne rispondono a domande
	 * diverse nel tempo: `account_id` racconta dove il movimento è AVVENUTO — un
	 * fatto storico che resta vero anche se il conto è stato chiuso — mentre
	 * scegliere una destinazione archiviata significa spedirci denaro adesso, in un
	 * conto che l'utente ha dichiarato di non usare più e che è escluso da "Saldo ·
	 * N conti attivi". Sarebbe denaro che sparisce da ogni numero mostrato.
	 */
	const destinationOptions: Option[] = accountList
		.filter((a) => a.id !== accountId && (!a.archived || a.id === toAccountId))
		.map(toOption);

	/*
	 * La voce "nessuna destinazione", solo dove la destinazione è facoltativa.
	 *
	 * ⚠️ Senza, la scelta sarebbe IRREVERSIBILE: `Select` non ha un comando per
	 * svuotarsi, quindi un risparmio a cui si assegna per sbaglio un conto non
	 * potrebbe più tornare senza. È lo stesso difetto già pagato nella Fase 19,
	 * quando il `DatePicker` custom aveva tolto lo svuotamento che
	 * `<input type="date">` aveva di serie.
	 */
	const destinationOptionsWithNone: Option[] = [
		{ value: "", label: t.transactions.form.noDestination, icon: null },
		...destinationOptions,
	];

	return (
		<div className="flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain">
			{/* Importo */}
			<div className="text-center pt-1 pb-3">
				<p className="text-muted text-base mb-2">{t.transactions.form.amount}</p>
				<div className="text-7xl font-bold tracking-tight">
					<span className="text-3xl mr-1">{currencySymbol(DISPLAY_CURRENCY, locale)}</span>
					{amount || "0"}
				</div>
			</div>

			<div className="flex flex-col gap-2 mb-3">
				{/*
					Categoria — assente sui trasferimenti, dove la posizione la prende
					il conto di destinazione. Era previsto fin dalla 20a: "che cosa" e
					"da dove" sono due domande vicine, e un trasferimento la prima non
					se la pone.
				*/}
				{!isTransfer && (
					<Select
						title={t.transactions.form.category}
						variant="compact"
						options={categoryOptions}
						selected={categoryId ?? ""}
						onChange={(val) => setCategoryId(val)}
					/>
				)}

				{/*
					⚠️ `fieldLabel` ("Conto"), NON `title` ("Conti").
					`Select` costruisce il segnaposto come `Seleziona {title minuscolo}`,
					quindi il titolo PLURALE della pagina produceva "Seleziona conti" su
					un campo a scelta singola — la trappola della Fase 19 ("Seleziona
					category", "Nuova investimento") reintrodotta riusando un titolo di
					pagina dove serve un'etichetta di campo.

					Su un trasferimento diventa "Dal conto": accanto a "Al conto" la
					parola "Conto" da sola non direbbe quale dei due.
				*/}
				<Select
					title={isTransfer ? t.transactions.form.fromAccount : t.accounts.fieldLabel}
					variant="compact"
					options={accountOptions}
					selected={accountId ?? ""}
					onChange={(val) => {
						setAccountId(val);
						// ⚠️ Cambiando origine, una destinazione ora identica va tolta.
						// Non in un effetto: sarebbe un render a cascata, e qui il punto
						// esatto in cui la collisione nasce è questo handler.
						if (val === toAccountId) setToAccountId(null);
					}}
				/>

				{/*
					Destinazione. Obbligatoria sui trasferimenti, facoltativa su
					risparmi e investimenti, assente altrove.
				*/}
				{canHaveDestination && (
					<div>
						<Select
							title={t.transactions.form.toAccount}
							variant="compact"
							options={isTransfer ? destinationOptions : destinationOptionsWithNone}
							selected={toAccountId ?? ""}
							onChange={(val) => setToAccountId(val || null)}
						/>
						{/*
							⚠️ La riga di spiegazione c'è solo dove la destinazione è
							FACOLTATIVA, ed è lì che serve: su un trasferimento il campo si
							spiega da sé, mentre su un risparmio "Al conto" non dice cosa
							cambia — e ciò che cambia è precisamente il motivo per cui il
							campo esiste. Senza, l'utente registrerebbe il risparmio E il
							trasferimento, cioè il doppio conteggio che la 20b esiste per
							rendere impossibile.
						*/}
						{!isTransfer && (
							<p className="mt-1.5 ml-1 text-[11px] text-disabled leading-relaxed">
								{t.transactions.form.destinationHint}
							</p>
						)}
					</div>
				)}

				{/* Descrizione */}
				<div>
					<p className="text-xs text-muted mb-1.5">{t.transactions.form.description}</p>
					<div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card ring-border">
						<Pencil size={14} className="text-muted shrink-0" />
						<input
							type="text"
							placeholder={t.transactions.form.descriptionPlaceholder}
							value={description ?? ""}
							onChange={(e) => setDescription(e.target.value)}
							className="bg-transparent text-sm flex-1 outline-none placeholder:text-muted"
						/>
					</div>
				</div>

				{/* Data */}
				<div>
					<p className="text-xs text-muted mb-1.5">{t.transactions.form.date}</p>
					{/* Lo stesso picker di GoalSheet e RecurringSheet: qui viveva la copia
					    originale, ora estratta in components/UI/DatePicker.tsx. */}
					<DatePicker
						value={date.toLocaleDateString("sv-SE")}
						// Mezzogiorno, non mezzanotte: attorno al cambio ora legale una
						// data costruita a mezzanotte può ricadere nel giorno prima.
						onChange={(iso) => setDate(new Date(`${iso}T12:00:00`))}
					/>
				</div>
			</div>

			{/*
				Ripeti — solo nuovi movimenti, e mai sui trasferimenti.
				⚠️ `recurring_rules_type_check` non ammette `trasferimento`, e la
				divergenza con `transactions_type_check` è deliberata (vedi la
				`20260815`): una ricorrente di trasferimento è una funzionalità nuova,
				non un allineamento dimenticato. Finché non c'è, il comando non deve
				esserci — offrirlo e poi far fallire il salvataggio sarebbe peggio che
				non offrirlo.
			*/}
			{!isEditing && !isTransfer && (
				<div className="mb-3">
					<p className="text-xs text-muted mb-1.5">{t.transactions.form.recurringSection}</p>
					<button
						type="button"
						onClick={() => setIsRecurring((v) => !v)}
						className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-card ring-border"
					>
						<Repeat size={14} className="text-muted shrink-0" />
						<span className="text-sm flex-1 text-left">{t.transactions.form.repeat}</span>
						{/*
							Il DISEGNO di <Switch> senza il suo comando: questa riga è già
							un <button>, e annidarci dentro il bottone role="switch" del
							componente sarebbe markup interattivo dentro markup interattivo.
							Il comando resta la riga.
							Acceso il binario è l'accento del tipo, non la CTA — quindi il
							pomello va su --on-accent: gli accenti invertono la luminosità
							fra i temi e un pomello fisso ci sparirebbe sopra da un lato.
						*/}
						<SwitchVisual
							checked={isRecurring}
							on={{ track: selectedType.color, knob: "var(--on-accent)" }}
						/>
					</button>
					{isRecurring && (
						<div className="mt-2">
							<FrequencySelector
								value={frequency}
								onChange={setFrequency}
								color={selectedType.color}
							/>
						</div>
					)}
				</div>
			)}

			{/*
				Ricevute (Fase 22, issue #36).

				⚠️ Funziona anche in CREAZIONE, e la prima stesura no. La foto scelta
				prima di salvare resta nel browser e viene caricata subito dopo, dentro
				lo stesso gesto: il caso reale è fotografare lo scontrino MENTRE si
				registra la spesa, quindi obbligare a salvare e riaprire metteva un
				ostacolo proprio sul percorso più frequente.

				Restano scartate le due alternative peggiori: un percorso temporaneo da
				spostare (due scritture, con un orfano se la seconda fallisce) e un
				salvataggio di nascosto per ottenere l'id (scrive un movimento che
				l'utente non ha confermato).

				⚠️ Niente ricevute su un TRASFERIMENTO: non c'è uno scontrino per
				aver spostato denaro fra due conti propri.
			*/}
			{!isTransfer && (
				<>
					<AttachmentPicker
						transactionId={transaction?.id ?? createdId}
						ref={pickerRef}
					/>
					{attachmentError && (
						<p className="mt-1.5 text-[11.5px] text-aka-ink">{attachmentError}</p>
					)}
				</>
			)}

			{/* Tastierino */}
			<div className="grid grid-cols-3 gap-2">
				{KEYS.map((key, i) => (
					<button
						key={i}
						type="button"
						onPointerDown={(e) => {
							e.preventDefault();
							handleKey(key);
						}}
						className={`flex items-center justify-center rounded-2xl bg-card ring-border text-lg font-medium ${recurring ? "h-12" : "h-14"}`}
					>
						{key === "⌫" ? <Delete size={18} /> : key}
					</button>
				))}
			</div>

			<button
				onClick={handleSave}
				disabled={!isValid || isSaving}
				className="w-full mt-3 py-4 rounded-2xl btn-primary font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
			>
				<Check size={18} />
				{isEditing
					? t.transactions.form.saveChanges
					: recurring
						? t.transactions.form.createRecurring
						: t.transactions.form.save}
			</button>

			{/*
				⚠️ Senza conti il bottone resta spento PER SEMPRE, e senza questa riga
				non lo dice nessuno.

				Capita a chi non ha una riga in `accounts` — registrato prima del
				backfill della `20260814` e mai ripassato dall'onboarding, oppure
				vittima di un errore transitorio di `ensureFirstAccount`. Digiti
				l'importo, la tastiera risponde, e il salvataggio non si accende mai.
				È lo stesso difetto corretto in `AccountSheet` per l'ultimo conto —
				bottone visibile ma spento **con la ragione scritta sotto** — e non
				era stato portato qui.
			*/}
			{accountList.length === 0 && (
				<p className="mt-2 text-[11.5px] text-center leading-relaxed" style={{ color: "var(--ink-aka)" }}>
					{t.accounts.errors.none}
				</p>
			)}

			{isEditing && (
				<div className="mt-2">
					{isDeleteConfirm ? (
						<div className="flex gap-2">
							<button
								onClick={() => setIsDeleteConfirm(false)}
								className="flex-1 py-3.5 rounded-2xl bg-card ring-border text-sm font-semibold"
							>
								{t.common.cancel}
							</button>
							<button
								onClick={handleDelete}
								className="flex-1 py-3.5 rounded-2xl text-sm font-semibold"
								// `--on-accent`, non "#fff": vedi CLAUDE.md, Fase 18.
								style={{ background: "var(--color-aka)", color: "var(--on-accent)" }}
							>
								{t.transactions.form.deleteConfirm}
							</button>
						</div>
					) : (
						<button
							onClick={() => setIsDeleteConfirm(true)}
							className="w-full py-3.5 rounded-2xl border text-sm font-semibold flex items-center justify-center gap-2"
							style={{
								borderColor:
									"color-mix(in srgb, var(--color-aka) 40%, transparent)",
								color: "var(--ink-aka)",
							}}
						>
							<Trash2 size={15} />
							{t.transactions.form.delete}
						</button>
					)}
				</div>
			)}
		</div>
	);
}
