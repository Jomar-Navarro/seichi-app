/**
 * Dizionario italiano — FONTE DI VERITÀ della Fase 19.
 *
 * Da qui si deriva il tipo `Dictionary`, e `en.ts` deve soddisfarlo: una chiave
 * dimenticata nella traduzione non compila, invece di apparire in produzione come
 * "settings.account.title" in mezzo alla pagina.
 *
 * ⚠️ NIENTE `as const`. Con le stringhe irrigidite a tipi letterali, `Dictionary`
 * pretenderebbe da `en.ts` esattamente le stesse parole italiane. Senza, ogni voce
 * è `string` e la struttura resta comunque vincolata — che è precisamente il
 * controllo che serve.
 *
 * ⚠️ SOLO stringhe, oggetti semplici e forme plurali. Mai funzioni: il dizionario
 * viene passato a `<I18nProvider>`, cioè attraversa il confine server→client, e
 * una funzione lì dentro romperebbe la serializzazione. Per i valori variabili si
 * usano i segnaposto `{nome}`, che `fill()` sostituisce a runtime.
 *
 * Convenzione di stile del progetto: sentence case ovunque, mai title case.
 */

export const it = {
	/** Titolo e descrizione del documento — la scheda del browser e le anteprime. */
	meta: {
		title: "Seichi",
		description:
			"Ordine finanziario, Come si prepara il terreno prima di costruire, Seichi ti aiuta a mettere ordine nelle tue finanze — con calma, chiarezza e controllo.",
	},

	/** Vocabolario condiviso: se una parola serve in più di un'area, sta qui. */
	common: {
		save: "Salva",
		cancel: "Annulla",
		delete: "Elimina",
		edit: "Modifica",
		close: "Chiudi",
		back: "Indietro",
		continue: "Continua",
		confirm: "Conferma",
		done: "Fatto",
		saving: "Salvataggio…",
		loading: "Caricamento…",
		retry: "Riprova",
		genericError: "Si è verificato un errore. Riprova.",
		unknownError: "Errore sconosciuto",
		required: "Campo obbligatorio",
	},

	/** Barra di navigazione in fondo. */
	nav: {
		home: "Home",
		transactions: "Transazioni",
		goals: "Obiettivi",
		investments: "Investimenti",
		addTransaction: "Aggiungi transazione",
	},

	/**
	 * Etichette dei tipi finanziari.
	 *
	 * ⚠️ Le CHIAVI restano italiane (`entrata`, `spesa`, `abbonamento`): sono i
	 * valori scritti in `transactions.type` e `categories.type`, vincolati da
	 * `categories_type_check`. Tradurle qui significherebbe tradurre il database.
	 * Si traduce l'etichetta, mai la chiave.
	 */
	types: {
		entrata: "Entrate",
		spesa: "Uscite",
		risparmio: "Risparmi",
		investimento: "Investimenti",
		abbonamento: "Abbonamenti",
	},

	/**
	 * Gli stessi tipi al SINGOLARE — intestazioni dei gruppi in /impostazioni/categorie.
	 * Lì `TIPO_LABEL` (plurale) direbbe "ENTRATE" sopra un gruppo che prima diceva
	 * "ENTRATA": voci separate per non cambiare il testo italiano traducendolo.
	 */
	typesSingular: {
		entrata: "Entrata",
		spesa: "Spesa",
		risparmio: "Risparmio",
		investimento: "Investimento",
		abbonamento: "Abbonamento",
	},

	/**
	 * "nuova entrata", "nuovo investimento"…
	 *
	 * ⚠️ Frasi INTERE, non "nuov{o|a} " + il nome del tipo. Il codice concatenava
	 * `nuova ${type}` per tutti e cinque, che in italiano è sbagliato per tre di
	 * essi: "nuova investimento", "nuova risparmio", "nuova abbonamento". Un
	 * aggettivo si accorda col genere del nome, e il genere non è deducibile da
	 * una chiave del database. In inglese il problema non esiste — ed è
	 * esattamente perché non esiste che un template pensato in inglese lo
	 * nasconde.
	 */
	newByType: {
		entrata: "nuova entrata",
		spesa: "nuova spesa",
		risparmio: "nuovo risparmio",
		investimento: "nuovo investimento",
		abbonamento: "nuovo abbonamento",
	},

	/** Tema chiaro/scuro (Fase 18). */
	theme: {
		light: "chiaro",
		dark: "scuro",
		system: "sistema",
		followsSystem: "segue il sistema",
		/** La seconda metà si aggiunge solo dopo l'idratazione — vedi ThemeSection. */
		followsSystemNow: "segue il sistema · ora {theme}",
		always: "sempre {theme}",
	},

	/**
	 * Messaggi restituiti dalle server action.
	 *
	 * Le action girano sul server e possono leggere il cookie, quindi compongono
	 * il messaggio GIÀ TRADOTTO invece di restituire un codice che il client
	 * dovrebbe poi mappare. La seconda via sarebbe più pulita in astratto, ma qui
	 * significherebbe due elenchi da tenere allineati — codici e traduzioni — per
	 * frasi che nessuno mostra due volte in posti diversi.
	 */
	errors: {
		notAuthenticated: "Non autenticato",
		nameRequired: "Il nome è obbligatorio",
		nameTooLong: "Il nome è troppo lungo",
		invalidType: "Tipo non valido",
		unsupportedLanguage: "Lingua non supportata",
		noFileSelected: "Nessun file selezionato",
		unsupportedFormat: "Formato non supportato — usa JPG, PNG o WebP",
		enterPassword: "Inserisci la password",
		invalidEmail: "Indirizzo email non valido",
		sameEmail: "È già la tua email attuale",
		samePassword: "La nuova password deve essere diversa da quella attuale",
		wrongCurrentPassword: "La password attuale non è corretta",
		wrongPassword: "Password non corretta",
		emailMismatch: "L'email digitata non corrisponde al tuo account",
		avatarRemoveFailed: "Non è stato possibile rimuovere la foto profilo. Riprova.",
	},

	/** Budget (Fase 17a). */
	budget: {
		monthlyLimit: "Limite mensile",
		variableOnly: "Solo spese variabili",
		/** Il campo vuoto significa "nessun limite", che è diverso da "limite zero". */
		none: "nessuno",
		limitAriaLabel: "Limite di spesa mensile",
		perMonth: "/ mese",
		fixedOutflows: "Uscite fisse previste",
		fixedOutflowsHint: "Abbonamenti di questo mese, fuori dal limite",
		amountMustBePositive: "Inserisci un importo maggiore di zero",
		readFailed: "Impossibile leggere il budget: {reason}",
	},

	/** Gestione delle categorie (Fase 13). */
	categories: {
		deleteTitle: "Elimina categoria",
		/** `{name}` viene reso in grassetto, quindi la frase è spezzata in due. */
		deleteQuestionBefore: "Vuoi eliminare ",
		deleteQuestionAfter: "? L'azione non si può annullare.",
		deleting: "Elimino…",
	},

	/** Gestione account e sicurezza (Fase 16). */
	account: {
		profile: {
			uploading: "Caricamento in corso…",
			replacePhoto: "Sostituisci la foto",
			uploadPhoto: "Carica una foto",
			/**
			 * ⚠️ `{max}` viene dal MAX_BYTES del componente invece di essere scritto
			 * a mano. CLAUDE.md elenca già quattro punti da allineare quando quel
			 * limite cambia (server action, bucket, AVATAR_MAX_BYTES, UI): due
			 * stringhe cablate per lingua ne avrebbero aggiunti altri due.
			 */
			photoHint: "JPG, PNG o WebP — massimo {max} MB",
			removePhoto: "Rimuovi foto",
			imageTooLarge: "L'immagine non può superare {max} MB",
			uploadFailed: "Caricamento non riuscito. Riprova.",
			removeFailed: "Rimozione non riuscita. Riprova.",
			saveFailed: "Salvataggio non riuscito. Riprova.",
			nameSection: "Nome",
			namePlaceholder: "Come vuoi essere chiamato",
			nameUpdated: "Nome aggiornato",
		},

		email: {
			confirmIdentity: "Conferma la tua identità",
			currentEmail: "Email attuale",
			password: "Password",
			verifying: "Verifica…",
			newEmailIntro: "Inserisci la tua nuova email",
			newEmailPlaceholder: "Nuova email",
			sendRequest: "Invia richiesta",
			sending: "Invio…",
			sentTitle: "Controlla la tua email",
			sentDescription:
				"Ti abbiamo inviato un link di conferma. Per sicurezza Supabase può chiedere la conferma anche dalla casella attuale: il cambio diventa effettivo solo dopo.",
		},

		password: {
			current: "Password attuale",
			new: "Nuova password",
			confirm: "Conferma nuova password",
			update: "Aggiorna password",
			updating: "Aggiornamento…",
			updatedTitle: "Password aggiornata",
		},

		delete: {
			warning:
				"Questa azione è permanente. Perderai per sempre transazioni, obiettivi, categorie e regole ricorrenti — tutto. Non è possibile recuperare i dati dopo l'eliminazione.",
			typeEmail: "Digita il tuo indirizzo email per confermare",
			/** Non contiene l'indirizzo: scriverlo qui ridurrebbe la conferma a un copia-incolla. */
			emailPlaceholder: "il tuo indirizzo email",
			deleteForever: "Elimina definitivamente",
			deleting: "Eliminazione…",
		},
	},

	settings: {
		title: "Impostazioni",
		editProfile: "modifica",
		editEmail: "Modifica email",
		profilePhoto: "Foto profilo",

		/** Le intestazioni di sezione — maiuscolate dal CSS, non qui. */
		groups: {
			appearance: "Aspetto",
			preferences: "Preferenze",
			budget: "Budget",
			categories: "Categorie",
			automation: "Automazione",
			security: "Sicurezza",
			support: "Supporto",
			dangerZone: "Zona pericolo",
		},

		manageCategories: "Gestisci categorie",
		recurringTransactions: "Transazioni ricorrenti",
		/** Titolo della pagina dedicata: lì il contesto rende superfluo "Transazioni". */
		recurringTitle: "Ricorrenti",
		biometricLock: "Blocco biometrico",
		pinLock: "Blocco con PIN",
		/** Funzioni previste ma non ancora costruite (Fase 25). */
		comingSoon: "presto",
		changePassword: "Cambia password",
		externalProvider: "Accedi con un provider esterno",
		about: "Informazioni",
		version: "versione {version}",
		signOut: "Esci",
		deleteAccount: "Elimina il tuo account",

		preferences: {
			currency: "Valuta",
			language: "Lingua",
		},
		/**
		 * Nomi delle valute. Il CODICE ISO non si traduce, il nome sì:
		 * la riga si compone come "EUR — Euro".
		 */
		currencies: {
			EUR: "Euro",
			USD: "Dollaro",
			GBP: "Sterlina",
			CHF: "Franco",
			JPY: "Yen",
		},
	},
};

/**
 * La forma che ogni dizionario deve avere.
 *
 * Derivata dall'italiano e non scritta a mano: un tipo mantenuto separatamente
 * diventerebbe un terzo posto da tenere allineato, e il primo a divergere.
 */
export type Dictionary = typeof it;
