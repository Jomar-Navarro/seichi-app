"use client";
import { useEffect, useRef, useState } from "react";
import { TransactionType, Category, Transaction, Frequency, Account } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Check, Trash2, Repeat } from "lucide-react";
import Select, { type Option } from "@/components/UI/Select";
import { ACCOUNT_ICON_FALLBACK, ACCOUNT_TYPE_ICON, accountColor } from "@/lib/accounts";
import FrequencySelector from "@/components/UI/FrequencySelector";
import { SwitchVisual } from "@/components/UI/Switch";
import { categoryTypeFor, TIPO_INK } from "@/lib/transaction-utils";
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
import { useScrollFocusedIntoView } from "@/components/UI/useScrollFocusedIntoView";
import { parseAmountInput } from "@/lib/amount";
import { canRepeat } from "@/lib/recurring";

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
/*
 * Fase 28d — condivisa con `TransactionModal.tsx` (che importa già questo
 * file per il componente stesso). Il bottone "Continua" del passo "importo"
 * e il "Salva movimento" del passo "dettagli" sono lo STESSO bottone di
 * chiusura del wizard, ripetuto in due punti: `fixed` sotto `lg:` (ancorato
 * al viewport, comportamento mobile), `absolute` sopra (dentro la card
 * centrata — l'antenato posizionato più vicino è sempre il div "contenuto"
 * `relative` del passo). Una costante sola evita che i due bottoni
 * divergano alla prossima modifica fatta su un solo file.
 */
export const WIZARD_FOOTER_BUTTON_CLASS =
	"fixed lg:absolute left-6 right-6 py-4 rounded-2xl btn-primary font-semibold flex items-center justify-center gap-2 disabled:opacity-40";
export const WIZARD_FOOTER_BUTTON_STYLE = {
	bottom: "max(1.625rem, env(safe-area-inset-bottom))",
} as const;

interface TransactionFormProps {
	selectedType: TransactionType;
	transaction?: Transaction;
	/*
	 * issue #86 — l'importo non è più stato locale di questo form: vive in
	 * `TransactionModal`, che lo mostra nel passo "importo" — montato PRIMA
	 * che questo componente esista, che monta solo al passo "dettagli". Un
	 * unico stato, sollevato al genitore comune, invece di due copie che il
	 * passaggio fra i due passi potrebbe far divergere. Sola lettura qui:
	 * modificarlo si fa tornando al passo precedente (bottone "indietro"
	 * nell'header di `TransactionModal`), non da questo form.
	 */
	amount: string;
	/**
	 * L'id del movimento che QUESTO modale ha già creato (vedi `onWrite`).
	 *
	 * ⚠️ Vive nel modale e non qui (#122). Stava in questo form, e il wizard lo
	 * smontava a ogni "indietro": un salvataggio riuscito con una ricevuta
	 * fallita, poi indietro → Continua → Salva, creava un secondo movimento.
	 * Ora il form resta montato, ma l'id sta comunque dove si decide la
	 * chiusura: è il modale a dover sapere che qualcosa è stato scritto.
	 */
	createdId: string | null;
	/**
	 * Qualcosa è stato scritto: il movimento (con l'id, se appena creato) o una
	 * ricevuta. Da quel momento chiudere deve aggiornare le liste anche se il
	 * gesto non è finito — vedi `handleClose` in `TransactionModal`.
	 */
	onWrite: (createdId?: string | null) => void;
}

export default function TransactionForm({
	selectedType,
	transaction,
	amount,
	createdId,
	onWrite,
}: TransactionFormProps) {
	const { t, locale } = useI18n();
	const isEditing = !!transaction;
	/*
	 * Il movimento ESISTE: aperto in modifica, oppure creato da questo modale e
	 * rimasto aperto per una ricevuta non passata. Da qui in poi il form si
	 * comporta come in modifica — niente "Ripeti", che trasformerebbe un
	 * aggiornamento in una regola nuova.
	 */
	const exists = isEditing || createdId !== null;
	/*
	 * ⚠️ La categoria si ricorda PER TIPO di categoria (#122). Il form ora
	 * sopravvive al ritorno alla griglia dei tipi, e una sola `categoryId`
	 * avrebbe portato "Alimentari" dentro un'entrata: il selettore non l'avrebbe
	 * mostrata, ma il salvataggio l'avrebbe spedita. Con una voce per tipo la
	 * scelta di un tipo non può finire sull'altro, e tornando indietro ritrova
	 * la propria. La chiave è `categoryTypeFor`: vendita e acquisto pescano
	 * dalle stesse categorie (#52), quindi condividono la scelta.
	 */
	const categoryKey = categoryTypeFor(selectedType.id);
	const [categoryByType, setCategoryByType] = useState<Record<string, string | null>>(() =>
		transaction ? { [categoryTypeFor(transaction.type)]: transaction.category_id ?? null } : {},
	);
	const categoryId = categoryByType[categoryKey] ?? null;
	const setCategoryId = (id: string | null) =>
		setCategoryByType((prev) => ({ ...prev, [categoryKey]: id }));
	const [description, setDescription] = useState<string | null>(
		transaction?.notes ?? null,
	);
	const [date, setDate] = useState(() =>
		transaction ? new Date(transaction.date) : new Date(),
	);
	/*
	 * Le categorie arrivate, con il tipo per cui sono state chieste: dopo un
	 * cambio di tipo l'elenco vecchio resta in memoria finché arriva il nuovo, e
	 * senza l'etichetta il selettore offrirebbe per un istante le categorie
	 * dell'altro tipo.
	 */
	const [loadedCategories, setLoadedCategories] = useState<{
		type: string;
		list: Category[];
	} | null>(null);
	const categoryList = loadedCategories?.type === categoryKey ? loadedCategories.list : [];
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
	/*
	 * ⚠️ La destinazione si ricorda PER TIPO, come la categoria (#122). Il form
	 * sopravvive al ritorno alla griglia dei tipi, e la destinazione OBBLIGATORIA
	 * di un trasferimento sarebbe passata intatta a un risparmio, dove è
	 * facoltativa: il denaro si sarebbe spostato su un conto che per quel
	 * risparmio nessuno aveva scelto.
	 */
	const [destinationByType, setDestinationByType] = useState<Record<string, string | null>>(
		() => (transaction ? { [transaction.type]: transaction.to_account_id ?? null } : {}),
	);
	/*
	 * Una destinazione uguale all'origine non è una destinazione
	 * (`transactions_dest_distinct_check`): si deriva qui invece di cancellarla
	 * quando l'origine cambia, perché con una voce per tipo la collisione può
	 * nascere anche su un tipo che non è quello a schermo.
	 */
	const storedDestination = destinationByType[selectedType.id] ?? null;
	const toAccountId = storedDestination === accountId ? null : storedDestination;
	const setToAccountId = (id: string | null) =>
		setDestinationByType((prev) => ({ ...prev, [selectedType.id]: id }));
	const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	/*
	 * Il salvataggio o l'eliminazione rifiutati. Prima `if (result?.error)
	 * return` riaccendeva il bottone e basta: il testo di `contoError()` non
	 * arrivava mai all'utente, e una server action che SOLLEVA (#122) usciva dal
	 * `try/finally` senza dire niente.
	 */
	const [saveErrorState, setSaveErrorState] = useState<{ type: string; text: string } | null>(
		null,
	);
	/*
	 * L'errore vale per il TIPO con cui è nato: il form sopravvive al ritorno ai
	 * tipi, e "Conto non trovato" sotto un movimento ormai diverso descriverebbe
	 * un tentativo che non è quello a schermo.
	 */
	const saveError = saveErrorState?.type === selectedType.id ? saveErrorState.text : null;
	const setSaveError = (text: string | null) =>
		setSaveErrorState(text === null ? null : { type: selectedType.id, text });
	const saveErrorRef = useRef<HTMLParagraphElement>(null);
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
	/*
	 * issue #69 — questo form vive dentro il foglio `fixed` di
	 * `TransactionModal` (non `BottomSheetShell`: ha markup suo, vedi
	 * quel file), e il suo scroll è quindi lo stesso caso — un campo a
	 * fuoco (la descrizione) non finisce da solo sopra la tastiera.
	 * Vedi useScrollFocusedIntoView.
	 */
	const scrollRef = useRef<HTMLDivElement>(null);
	useScrollFocusedIntoView(scrollRef);
	/*
	 * La frase d'errore sta in fondo al contenuto che scorre, e il bottone che
	 * l'ha provocata è fisso: su un form lungo resterebbe sotto la piega, e il
	 * tocco sembrerebbe di nuovo non aver fatto niente.
	 */
	useEffect(() => {
		if (saveError) saveErrorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
	}, [saveError]);
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
		 * Nessun azzeramento da fare: l'elenco porta il tipo per cui è stato
		 * chiesto, e `categoryList` lo ignora quando non è quello di adesso.
		 */
		if (isTransfer) return;
		// ⚠️ Due cambi di tipo ravvicinati (#122): la risposta del primo può
		// arrivare dopo quella del secondo. L'etichetta la renderebbe innocua,
		// ma non c'è motivo di scriverla.
		let cancelled = false;
		async function loadCategories() {
			const supabase = createClient();
			const { data } = await supabase
				.from("categories")
				.select("*")
				.eq("type", categoryKey);
			if (data && !cancelled) setLoadedCategories({ type: categoryKey, list: data });
		}
		loadCategories();
		return () => {
			cancelled = true;
		};
	}, [categoryKey, isTransfer]);

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
			/*
			 * Il default per un movimento NUOVO: il conto che la pagina sotto sta
			 * guardando (#112), altrimenti il primo ATTIVO. In modifica `current`
			 * è già il conto del movimento, e il `??` lo lascia dov'è.
			 *
			 * ⚠️ Il conto guardato passa dallo stesso filtro `!archived` del
			 * ripiego: una pagina può guardare un conto archiviato (la sua storia
			 * resta consultabile), ma proporlo significherebbe suggerire di
			 * scriverci sopra. E deve essere fra i conti appena caricati, così un
			 * id che non è (più) dell'utente ricade sul primo attivo invece di
			 * lasciare il form senza conto.
			 *
			 * Letto con `getState()` e non sottoscritto: serve il valore al
			 * momento dell'apertura, non un form che cambia conto da solo se la
			 * pagina sotto cambiasse mentre è aperto.
			 */
			const viewed = useUIStore.getState().viewedAccountId;
			const proposed =
				data.find((a) => a.id === viewed && !a.archived) ?? data.find((a) => !a.archived);
			setAccountId((current) => current ?? proposed?.id ?? null);
		}
		loadAccounts();
	}, []);

	/*
	 * ⚠️ Le regole ricorrenti NON possono essere trasferimenti, e non basta
	 * ometterne il comando: `isRecurring` è uno stato che sopravvive al cambio di
	 * tipo — il form resta montato mentre si torna alla griglia dei tipi (#122;
	 * prima questo commento lo affermava e non era vero) — quindi chi accende
	 * "Ripeti" su una spesa e poi passa a trasferimento salverebbe una regola che
	 * `recurring_rules_type_check` rifiuta. La riga sotto rende quella
	 * combinazione inesprimibile invece che vietata — per il trasferimento e per
	 * il disinvestimento, i due tipi che il CHECK esclude (`canRepeat`). Lo
	 * stesso vale per un movimento che esiste già: "Salva" lo aggiorna, non crea
	 * una regola.
	 */
	const repeatable = canRepeat(selectedType.id);
	const recurring = isRecurring && repeatable && !exists;
	/*
	 * Le ricevute appartengono a un MOVIMENTO. Un trasferimento non ha scontrino;
	 * una regola ricorrente non è un movimento, e `createRecurringRule` non
	 * restituisce un id a cui appenderle: prima la foto scelta con "Ripeti"
	 * acceso spariva al salvataggio senza dirlo (#122). In entrambi i casi il
	 * picker resta montato ma nascosto (`hidden`), così tornando indietro le foto
	 * scelte ci sono ancora; e su un trasferimento, se ce ne sono in coda, lo
	 * dice (`hiddenNote`) — su una regola lo dice già la frase sotto.
	 */
	const receiptsOffered = !isTransfer && !recurring;

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
	// L'importo arriva dal tastierino, già vincolato a due decimali e a
	// `DECIMAL(10,2)`: lo si legge con lo stesso parser dei fogli (issue #119).
	const parsedAmount = parseAmountInput(amount, locale);
	const isValid =
		parsedAmount.status === "ok" &&
		parsedAmount.value > 0 &&
		accountId !== null &&
		(!isTransfer || (toAccountId !== null && toAccountId !== accountId));

	async function handleSave() {
		if (!isValid || isSaving || !accountId || parsedAmount.status !== "ok") return;
		setIsSaving(true);
		setSaveError(null);
		setAttachmentError(null);
		/*
		 * ⚠️ Che cosa è stato scritto, registrato nel `finally` (#122).
		 *
		 * Prima `setCreatedId` stava DOPO l'await dei caricamenti: se uno di
		 * questi sollevava un'eccezione invece di restituire `{ error }` — un corpo
		 * oltre `bodySizeLimit`, un guasto di `getClaims()` sul server — si usciva
		 * prima di registrare l'id, e il secondo "Salva" creava un altro
		 * movimento, ricaricando la ricevuta già passata. Il `finally` gira su
		 * ogni uscita: un movimento scritto non può più essere dimenticato.
		 *
		 * Perché non subito dopo il salvataggio: dare l'id al picker fa partire la
		 * sua rilettura degli allegati, che correrebbe contro i caricamenti appena
		 * cominciati e potrebbe sovrascriverli con un elenco vuoto. Finché i
		 * caricamenti girano il bottone è spento (`isSaving`), quindi nel frattempo
		 * un secondo "Salva" non può partire.
		 */
		let saved = false;
		let newId: string | null = null;
		try {
			const importo = parsedAmount.value;
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

			if (result?.error) {
				setSaveError(result.error);
				return;
			}
			saved = true;

			/*
			 * Le ricevute scelte PRIMA del salvataggio si caricano adesso: solo ora
			 * esiste l'id a cui appenderle (Fase 22).
			 *
			 * ⚠️ Da questo momento il movimento ESISTE. Se un upload fallisce il
			 * modale resta aperto, e un secondo tocco su "Salva" deve AGGIORNARE
			 * quella riga, non crearne una seconda: è ciò che `createdId` ricorda,
			 * scritto nel `finally` qui sotto.
			 */
			newId = result && "id" in result ? (result as { id: string }).id : null;
			const targetId = transaction?.id ?? newId ?? createdId;

			const attachmentFailure =
				targetId && receiptsOffered
					? await pickerRef.current?.uploadPending(targetId)
					: null;

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
		} catch (e) {
			/*
			 * Una server action che SOLLEVA invece di restituire `{ error }`: un 500,
			 * un deploy che ha cambiato l'id dell'azione. Una rete caduta no — con
			 * `useOffline` (Fase 25) resta in sospeso e riparte da sola.
			 *
			 * Se il movimento era già scritto, a fallire è stata una ricevuta: la
			 * frase lo dice, e le ricevute non passate restano in coda nel picker.
			 */
			console.error("[movimento] salvataggio:", e);
			if (saved) setAttachmentError(t.attachments.errors.notSaved);
			else setSaveError(t.common.genericError);
		} finally {
			if (saved) onWrite(newId);
			setIsSaving(false);
		}
	}

	async function handleDelete() {
		if (!transaction || isSaving) return;
		setIsSaving(true);
		setSaveError(null);
		try {
			const result = await deleteTransaction(transaction.id);
			if (result?.error) {
				setSaveError(result.error);
				return;
			}
			notifyTransactionSaved();
			closeTransactionModal();
		} catch (e) {
			console.error("[movimento] eliminazione:", e);
			setSaveError(t.common.genericError);
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
		<>
			{/*
				⚠️ Il bottone di salvataggio è `fixed`, come "Continua" nel passo
				"importo" di `TransactionModal` — stessa posizione, stesso motivo:
				prima era l'ultimo elemento dello scroll, quindi su un form con
				ricorrenza + ricevute finiva sotto la piega e bisognava scorrere
				fino in fondo per salvare. `pb-24` sul contenitore che scorre
				riserva lo spazio sotto, o l'ultimo campo (o il comando elimina)
				resterebbe nascosto dietro il bottone.
			*/}
			<div
				ref={scrollRef}
				className="flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-none pb-24"
			>
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
					// Una destinazione ora identica all'origine sparisce da sé: vedi
					// `toAccountId`, che la deriva.
					onChange={(val) => setAccountId(val)}
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
							// issue #69 — text-base: sotto i 16px iOS zooma da solo al focus.
							className="bg-transparent text-base flex-1 outline-none placeholder:text-muted"
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
			{/*
				E non sui tipi che una regola non può avere: `canRepeat()` è lo
				specchio di `recurring_rules_type_check`, che esclude anche il
				disinvestimento — prima "Ripeti" gli veniva offerto (#122).
			*/}
			{!exists && repeatable && (
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
								ink={TIPO_INK[selectedType.id] ?? "var(--ink-kiri)"}
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
				aver spostato denaro fra due conti propri. Né su una regola
				ricorrente: vedi `receiptsOffered`.
			*/}
			{/*
				Montato anche su un trasferimento IN CREAZIONE, ma nascosto: chi
				passa per sbaglio dal trasferimento e torna a una spesa ritrova le
				foto scelte (#122). Su un trasferimento esistente non si monta
				proprio — non avrebbe niente da leggere.
			*/}
			{(!isTransfer || !isEditing) && (
				<>
					<AttachmentPicker
						transactionId={transaction?.id ?? createdId}
						ref={pickerRef}
						onWrite={() => onWrite()}
						hidden={!receiptsOffered}
						hiddenNote={isTransfer ? t.transactions.form.receiptsNotOnTransfer : null}
					/>
					{recurring && (
						<p className="mt-5 mb-5 text-[11px] text-disabled leading-relaxed">
							{t.transactions.form.receiptsNotOnRule}
						</p>
					)}
					{attachmentError && (
						<p className="mt-1.5 text-[11.5px] text-aka-ink">{attachmentError}</p>
					)}
				</>
			)}

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

			{saveError && (
				<p ref={saveErrorRef} className="mt-2 text-[11.5px] text-center leading-relaxed text-aka-ink">
					{saveError}
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
							className="w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
							// issue #81 — anello (box-shadow), non bordo: il colore è traslucido (40%).
							style={{
								boxShadow:
									"color-mix(in srgb, var(--color-aka) 40%, transparent) 0px 0px 0px 1px inset",
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

		{/*
			`fixed`, non l'ultimo elemento dello scroll — stessa posizione del
			"Continua" del passo "importo": `left-6 right-6` ripete il `px-6`
			del foglio (qui non è dentro quel contenitore) e il fondo rispetta
			la stessa safe-area. Classe e stile condivisi con quel bottone —
			vedi `WIZARD_FOOTER_BUTTON_CLASS` qui sopra.
		*/}
		<button
			onClick={handleSave}
			disabled={!isValid || isSaving}
			className={WIZARD_FOOTER_BUTTON_CLASS}
			style={WIZARD_FOOTER_BUTTON_STYLE}
		>
			<Check size={18} />
			{/* `exists` e non `isEditing`: creato il movimento, "Salva" lo aggiorna. */}
			{exists
				? t.transactions.form.saveChanges
				: recurring
					? t.transactions.form.createRecurring
					: t.transactions.form.save}
		</button>
	</>
	);
}
