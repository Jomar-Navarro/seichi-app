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

	/**
	 * Il marchio.
	 *
	 * ⚠️ "Seichi" e 整地 NON si traducono: sono il nome, e 整地 è la parola
	 * giapponese da cui viene ("preparazione del terreno"). Si traduce solo la
	 * riga che la spiega. Il maiuscolo lo mette il CSS, quindi qui sta minuscola.
	 */
	brand: {
		tagline: "ordine finanziario",
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
		deleting: "Elimino…",
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
		amountMustBePositive: "L'importo deve essere maggiore di zero",
		invalidEmail: "Indirizzo email non valido",
		sameEmail: "È già la tua email attuale",
		samePassword: "La nuova password deve essere diversa da quella attuale",
		wrongCurrentPassword: "La password attuale non è corretta",
		wrongPassword: "Password non corretta",
		emailMismatch: "L'email digitata non corrisponde al tuo account",
		avatarRemoveFailed: "Non è stato possibile rimuovere la foto profilo. Riprova.",
	},

	/**
	 * Autenticazione — l'unica parte dell'app PRE-LOGIN.
	 *
	 * Qui non esiste né utente né `profiles.language`: la lingua la decide
	 * `Accept-Language`, ed è l'unico posto dove quella negoziazione è davvero
	 * la fonte invece che un ripiego.
	 */
	auth: {
		/**
		 * Le due linguette del selettore accedi/registrati.
		 *
		 * Voci proprie e non riuso di `signIn.submit`: qui sono etichette di
		 * navigazione, là è il bottone che invia il form. Oggi coincidono in
		 * entrambe le lingue, ma la coincidenza è del testo, non del ruolo.
		 */
		tabs: {
			signIn: "Accedi",
			signUp: "Registrati",
		},

		welcome: {
			lead: "Prepara il terreno prima di costruire.",
			leadMuted: "Metti in ordine le tue finanze — con calma e intenzione.",
			createAccount: "Crea il tuo account",
			haveAccount: "Hai già un account?",
			signIn: "Accedi",
		},

		signIn: {
			eyebrow: "Bentornato",
			heading: "Accedi al tuo spazio.",
			email: "Email",
			password: "Password",
			forgotPassword: "Password dimenticata?",
			submit: "Accedi",
			noAccount: "Non hai un account?",
			signUp: "Registrati",
			or: "oppure",
			/** Conferma mostrata dopo un recupero password andato a buon fine. */
			passwordReset: "Password aggiornata — accedi con quella nuova",
		},

		signUp: {
			eyebrow: "Benvenuto",
			heading: "Crea il tuo account.",
			firstName: "Nome",
			lastName: "Cognome",
			confirmPassword: "Conferma password",
			submit: "Crea account",
			/** La frase del consenso è spezzata: due parti sono link. */
			consentBefore: "Accetto i ",
			consentTerms: "Termini di servizio",
			consentMiddle: " e l'",
			consentPrivacy: "informativa sulla privacy",
			consentAfter: " di Seichi.",
			/**
			 * Requisiti della password mostrati come barre.
			 * ⚠️ `{n}` viene da PASSWORD_MIN_LENGTH, non scritto a mano.
			 */
			requirements: {
				length: "Minimo {n} caratteri",
				number: "Minimo un numero",
				lowercase: "Minimo una lettera minuscola",
				uppercase: "Minimo una lettera maiuscola",
				special: "Minimo un carattere speciale",
			},
			sentTitle: "Controlla la tua email",
			sentBefore: "Abbiamo inviato un link di verifica a ",
			sentAfter: ". Aprilo per attivare il tuo account.",
			alreadyVerified: "Già verificato?",
		},

		recovery: {
			linkExpired: "Link scaduto o non valido — richiedi un nuovo recupero",
			title: "Recupera la password",
			intro: "Inserisci la tua email e ti invieremo un link per reimpostarla",
			sentTitle: "Controlla la tua email",
			/** Sempre la stessa risposta, anche per indirizzi inesistenti: vedi actions.ts. */
			sentDescription:
				"Se l'indirizzo è registrato, ti abbiamo inviato un link per reimpostare la password.",
			backToLogin: "Torna al login",
			submit: "Invia link di recupero",
			sending: "Invio…",
			newPassword: "Nuova password",
			confirmPassword: "Conferma password",
			reset: "Reimposta password",
			resetting: "Aggiornamento…",
		},

		emailConfirmed: {
			title: "Email confermata",
			description:
				"Se Supabase ha richiesto la conferma anche dall'indirizzo precedente, il cambio diventa effettivo solo dopo aver aperto entrambi i link.",
			backToSettings: "Torna alle impostazioni",
			failedTitle: "Conferma non riuscita",
			failedDescription:
				"Il link non è valido o è scaduto. Riprova a cambiare email dalle impostazioni.",
			goToSettings: "Vai alle impostazioni",
		},

		codeError: {
			title: "Accesso non riuscito",
			description: "Il link di autenticazione non è valido o è scaduto. Riprova ad accedere.",
			backToLogin: "Torna al login",
		},

		/** Titoli delle schede del browser: "<pagina> — Seichi". */
		meta: {
			recover: "Recupera la password — Seichi",
			reset: "Reimposta password — Seichi",
			emailConfirmed: "Email confermata — Seichi",
		},

		errors: {
			wrongCredentials: "Credenziali di login errate",
			acceptTerms: "Devi accettare i termini di servizio",
			passwordTooShort: "La password deve essere di almeno {n} caratteri",
			passwordMismatch: "Le password non corrispondono",
		},
	},

	onboarding: {
		start: {
			eyebrow: "Benvenuto",
			heading: "Iniziamo con calma.",
			lead: "Prepara il terreno prima di costruire.",
			leadMuted: "Metti in ordine le tue finanze — con calma e intenzione.",
			description:
				"Tre passi brevi per preparare il tuo spazio finanziario. Nessuna fretta — puoi cambiare tutto più tardi.",
			cta: "Inizia",
		},
		preference: {
			eyebrow: "Preferenze",
			headingLine1: "Lingua",
			headingLine2: "e valuta",
			heading: "Lingua e valuta",
			description:
				"Imposta le tue preferenze di base. Potrai cambiarle in qualsiasi momento.",
		},
		category: {
			eyebrow: "Categorie",
			headingLine1: "Scegli le",
			headingLine2: "categorie",
			heading: "Scegli le categorie",
			description:
				"Seleziona ciò che vuoi tenere in ordine. Puoi aggiungerne altre più tardi.",
			cta: "Completa la configurazione",
			/**
			 * ⚠️ "Spese" e non `t.types.spesa` ("Uscite"): sono due parole diverse,
			 * e riusare il token avrebbe cambiato il testo italiano dell'onboarding
			 * mentre lo traducevo. Tradurre non è riscrivere.
			 */
			groups: {
				entrata: "Entrate",
				spesa: "Spese",
				risparmio: "Risparmi",
				investimento: "Investimenti",
				abbonamento: "Abbonamenti",
			},
		},
	},

	/**
	 * Le categorie proposte dall'onboarding.
	 *
	 * ⚠️ Serve a DUE cose, e la seconda non è interfaccia: `title` è anche il nome
	 * che `saveCategories()` SCRIVE in `categories.name`. Da quel momento è un dato
	 * dell'utente — rinominabile, e già copiato nel payload delle notifiche
	 * (`'category', c.name` nella migration della 17b). Per questo si traduce alla
	 * SCRITTURA e non alla lettura: un nome tradotto al render disaccorderebbe la
	 * lista dalle notifiche già emesse, mostrando due nomi per la stessa categoria
	 * nella stessa schermata.
	 *
	 * Le CHIAVI (`stipendio`, `alimentari`) restano italiane: sono identificatori,
	 * come i valori di `categories.type`.
	 */
	presetCategories: {
		// Entrate
		stipendio: { title: "Stipendio", subtitle: "Reddito mensile" },
		freelance: { title: "Freelance", subtitle: "Lavoro autonomo" },
		bonus: { title: "Bonus", subtitle: "Premi e incentivi" },
		regalo: { title: "Regalo", subtitle: "Entrate inaspettate" },
		rimborso: { title: "Rimborso", subtitle: "Spese rimborsate" },
		// Spese
		alimentari: { title: "Alimentari", subtitle: "Spesa e supermercato" },
		ristoranti: { title: "Ristoranti", subtitle: "Bar e locali" },
		trasporti: { title: "Trasporti", subtitle: "Auto, treni, bus" },
		salute: { title: "Salute", subtitle: "Visite e farmaci" },
		abbigliamento: { title: "Abbigliamento", subtitle: "Vestiti e accessori" },
		svago: { title: "Svago", subtitle: "Tempo libero" },
		casa_spesa: { title: "Casa", subtitle: "Arredi e manutenzione" },
		// Risparmi
		fondo_emergenza: { title: "Fondo emergenza", subtitle: "Cuscinetto di sicurezza" },
		vacanze: { title: "Vacanze", subtitle: "Viaggi e soggiorni" },
		obiettivo_casa: { title: "Obiettivo casa", subtitle: "Acquisto o affitto" },
		elettronica: { title: "Elettronica", subtitle: "Gadget e dispositivi" },
		// Investimenti
		etf: { title: "ETF", subtitle: "Fondi indicizzati" },
		azioni: { title: "Azioni", subtitle: "Mercati azionari" },
		crypto: { title: "Crypto", subtitle: "Asset digitali" },
		fondi: { title: "Fondi", subtitle: "Gestione attiva" },
		// Abbonamenti
		streaming: { title: "Streaming", subtitle: "Video on demand" },
		musica: { title: "Musica", subtitle: "Piattaforme audio" },
		palestra: { title: "Palestra", subtitle: "Fitness e sport" },
		utenze: { title: "Utenze", subtitle: "Luce, gas, internet" },
		affitto: { title: "Affitto", subtitle: "Casa e spazi" },
	},

	/**
	 * I cinque tipi nel selettore del modale transazione.
	 *
	 * ⚠️ Non è `typesSingular`: lì `abbonamento` è "Abbonamento", qui è
	 * "Ricorrente". Sono due parole diverse per lo stesso tipo, già prima della
	 * traduzione, e unificarle sarebbe stato riscrivere il testo italiano.
	 */
	transactionTypes: {
		spesa: { label: "Uscita", description: "Spese e acquisti quotidiani" },
		entrata: { label: "Entrata", description: "Stipendio, rimborsi, regali" },
		risparmio: { label: "Risparmio", description: "Accantonamenti e obiettivi" },
		investimento: { label: "Investimento", description: "Mercati, fondi, portafoglio" },
		abbonamento: { label: "Ricorrente", description: "Abbonamenti e pagamenti fissi" },
	},

	home: {
		greeting: "Bentornato",
		error: "Errore",
		balanceTotal: "Saldo totale",
		balanceThisMonth: "questo mese",
		/**
		 * ⚠️ "Spese" e non `t.types.spesa` ("Uscite"): le card della home e il
		 * filtro dei movimenti usano due parole diverse già in italiano.
		 */
		cards: {
			income: "Entrate",
			expenses: "Spese",
			investments: "Investimenti",
			savings: "Risparmi",
			/** Quando ci sono obiettivi con un traguardo: "Risparmi · 42%". */
			savingsWithProgress: "Risparmi · {pct}%",
		},
		analyticsTitle: "Analisi",
		analyticsSubtitle: "Grafici e statistiche",
		recentTitle: "Transazioni recenti",
		seeAll: "Vedi tutte →",
		/** Lista vuota dentro la card della home, più stretta di quella a pagina piena. */
		emptyTitle: "Ancora nessun movimento",
		emptyDescription: "Aggiungi il primo movimento per iniziare.",
	},

	transactions: {
		title: "Movimenti",
		modalNew: "Nuovo movimento",
		modalEdit: "Modifica movimento",
		modalTypeQuestion: "Che tipo di movimento vuoi registrare?",

		/** Il form dentro il modale. */
		form: {
			amount: "Importo",
			category: "Categoria",
			description: "Descrizione",
			descriptionPlaceholder: "Es. Trenord, Esselunga...",
			date: "Data",
			recurringSection: "Ricorrenti",
			repeat: "Ripeti",
			saveChanges: "Salva modifiche",
			createRecurring: "Crea ricorrenza",
			save: "Salva movimento",
			deleteConfirm: "Conferma eliminazione",
			delete: "Elimina movimento",
		},
		emptyTitle: "Nessuna transazione ancora",
		emptyDescription:
			"Le tue entrate e uscite appariranno qui non appena registrerai il primo movimento.",
		addAction: "Aggiungi movimento",
		searchPlaceholder: "Cerca movimenti",
		filterAll: "Tutte",
		periods: {
			"7d": "7 giorni",
			"30d": "30 giorni",
			"3m": "3 mesi",
			tutto: "Tutto",
		},
	},

	/** Obiettivi di risparmio (Fase 11). */
	goals: {
		title: "Obiettivi",
		loadError: "Errore nel caricamento degli obiettivi.",
		/** "2 attivi · 1 completato" — due plurali indipendenti nella stessa riga. */
		activeCount: { one: "{n} attivo", other: "{n} attivi" },
		completedCount: { one: "{n} completato", other: "{n} completati" },
		new: "Nuovo",
		emptyTitle: "Nessun obiettivo ancora",
		emptyDescription:
			"Crea il tuo primo obiettivo per iniziare a metterlo da parte con calma.",
		create: "Crea obiettivo",
		noDeadline: "Nessuna scadenza",
		/** Riga sotto il nome sulla card: "Scadenza · ago 2026". */
		reached: "Raggiunto · {date}",
		deadline: "Scadenza · {date}",
		/** "€ 400 di € 1.000" — il connettivo fra risparmiato e traguardo. */
		of: "di",

		editTitle: "Modifica obiettivo",
		newTitle: "Nuovo obiettivo",
		nameLabel: "Nome obiettivo",
		namePlaceholder: "Es. Viaggio in Giappone",
		nameRequired: "Inserisci un nome",
		targetLabel: "Importo obiettivo",
		optional: "(opzionale)",
		amountInvalid: "Inserisci un importo valido",
		dateLabel: "Data obiettivo",
		iconLabel: "Icona",
		saveChanges: "Salva modifiche",
		deleteConfirm: "Conferma eliminazione",
		delete: "Elimina obiettivo",
	},

	investments: {
		title: "Investimenti",
		emptyTitle: "Nessun investimento ancora",
		/** ⚠️ Cita il nome del tipo: arriva da `t.transactionTypes.investimento.label`. */
		emptyDescription:
			"Aggiungi una transazione di tipo «{type}» per iniziare a tracciare il tuo portafoglio.",
		positionCount: { one: "{n} posizione attiva", other: "{n} posizioni attive" },
		typeCount: { one: "{n} tipologia", other: "{n} tipologie" },
		portfolioValue: "Valore portafoglio",
		vsLastMonth: "rispetto al mese scorso",
		composition: "Composizione",
		total: "Totale",
		positions: "Posizioni",
	},

	analytics: {
		title: "Analisi",
		lastWeek: "Ultima settimana",
		netFlow: "Flusso netto",
		/** Nessun periodo precedente con cui confrontarsi. */
		firstMonth: "— primo mese",
		tabs: {
			settimana: "Settimana",
			mese: "Mese",
			anno: "Anno",
		},
		legendIncome: "Entrate",
		legendExpenses: "Uscite totali",
		spendingByCategory: "Spese per categoria",
		/** Stato vuoto del donut: "Nessuna spesa questo mese". */
		noSpending: "Nessuna spesa {window}",
		/** Periodo vuoto nel donut: "nessuna spesa questa settimana". */
		windows: {
			settimana: "questa settimana",
			mese: "questo mese",
			anno: "quest'anno",
		},
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

		/** Intestazione neutra: la finestra temporale la porta ogni card. */
		sectionTitle: "Budget",
		/**
		 * Nome del budget globale sulla card.
		 * ⚠️ "variabili" e mai "totali": affitto e utenze sono categorie
		 * `abbonamento` e restano fuori dal limite.
		 */
		variableExpenses: "Spese variabili",
		/** "del mese" va detto qui: l'intestazione non porta più l'arco temporale. */
		fixedThisMonth: "fisse del mese {amount}",
	},

	/**
	 * Etichette del picker icone, annidate per TIPO.
	 *
	 * ⚠️ Non è una mappa piatta `id → etichetta` perché nove icone cambiano nome
	 * col contesto: `Landmark` è "Bonifico" fra le entrate e "Azioni" fra gli
	 * investimenti, `Home` è "Casa / Affitto" fra le spese e "Casa nuova" fra i
	 * risparmi. Vedi `lib/category-icons.ts`.
	 */
	iconLabels: {
		entrata: {
			Briefcase: "Stipendio",
			Banknote: "Contanti",
			Landmark: "Bonifico",
			Award: "Bonus",
			Gift: "Regalo ricevuto",
			Coins: "Extra",
			TrendingUp: "Crescita",
			ArrowDownToLine: "Incasso",
			HandCoins: "Mancia",
			Percent: "Interessi",
			Handshake: "Freelance",
			CircleDollarSign: "Dividendi",
		},
		spesa: {
			ShoppingCart: "Spesa quotidiana",
			ShoppingBasket: "Alimentari",
			Utensils: "Ristoranti",
			Car: "Trasporti",
			Home: "Casa / Affitto",
			Zap: "Utenze",
			Shirt: "Abbigliamento",
			HeartPulse: "Salute",
			GraduationCap: "Formazione",
			Wifi: "Internet",
			Fuel: "Carburante",
			Baby: "Figli",
			PawPrint: "Animali",
			Coffee: "Bar",
			Wrench: "Manutenzione",
			Stethoscope: "Visite mediche",
		},
		investimento: {
			TrendingUp: "ETF / PAC",
			LineChart: "Andamento",
			Landmark: "Azioni",
			Bitcoin: "Crypto",
			Building2: "Immobiliare",
			PieChart: "Composizione",
			Layers: "Portafoglio",
			Coins: "Obbligazioni",
			BarChart3: "Rendimento",
			Vault: "Deposito",
			Globe: "Fondi esteri",
			Percent: "Rendimento %",
			CircleDollarSign: "Dividendi",
		},
		risparmio: {
			PiggyBank: "Generico",
			Shield: "Fondo emergenza",
			Plane: "Viaggio",
			Home: "Casa nuova",
			GraduationCap: "Studi figli",
			Heart: "Matrimonio",
			Gem: "Grande acquisto",
			Target: "Obiettivo",
			Baby: "Fondo bebè",
			Car: "Auto nuova",
			Umbrella: "Protezione",
			Sunrise: "Pensione",
			Sparkles: "Occasione speciale",
		},
		abbonamento: {
			Repeat: "Generico",
			Tv: "Streaming",
			Music: "Musica",
			Smartphone: "Telefonia",
			Cloud: "Storage",
			Newspaper: "Riviste",
			Dumbbell: "Palestra",
			Wifi: "Connettività",
			Gamepad2: "Cloud gaming",
			BookOpen: "Ebook / audiolibri",
			Mail: "Posta premium",
			CreditCard: "Carta prepagata",
			Radio: "Podcast",
			Headphones: "Musica premium",
		},
	},

	/**
	 * Cadenze delle regole ricorrenti (Fase 14).
	 * `label` nel selettore, `recur` sulle card ("Ogni mese").
	 */
	frequencies: {
		settimanale: { label: "Settimanale", recur: "Ogni settimana" },
		mensile: { label: "Mensile", recur: "Ogni mese" },
		annuale: { label: "Annuale", recur: "Ogni anno" },
	},

	/** Periodi di budget (Fase 17a). */
	budgetPeriods: {
		settimanale: { label: "settimanale", suffix: "/ settimana", window: "questa settimana" },
		mensile: { label: "mensile", suffix: "/ mese", window: "questo mese" },
		annuale: { label: "annuale", suffix: "/ anno", window: "quest'anno" },
	},

	/**
	 * Tipi ABBREVIATI per la griglia a 5 colonne del form categoria.
	 * Su uno schermo stretto ogni colonna ha ~60px: "investimento" non ci sta.
	 */
	typesShort: {
		entrata: "entrata",
		spesa: "spesa",
		investimento: "investim.",
		risparmio: "risparmio",
		abbonamento: "abbon.",
	},

	/** Gestione delle categorie (Fase 13). */
	categories: {
		deleteTitle: "Elimina categoria",
		/** `{name}` viene reso in grassetto, quindi la frase è spezzata in due. */
		deleteQuestionBefore: "Vuoi eliminare ",
		deleteQuestionAfter: "? L'azione non si può annullare.",

		editTitle: "Modifica categoria",
		newTitle: "Nuova categoria",
		nameLabel: "Nome",
		namePlaceholder: "es. Palestra",
		nameRequired: "Inserisci un nome",
		typeLabel: "Tipo",
		iconLabel: "Icona",
		iconSet: "set — {type}",
		/** Icona di una categoria vecchia, non più nella libreria del suo tipo. */
		currentIcon: "attuale",
		saveChanges: "Salva modifiche",
		create: "Crea categoria",

		budgetLabel: "Limite di budget",
		optional: "(opzionale)",
		budgetPlaceholder: "es. 250",
		budgetMustBePositive: "Il limite di budget deve essere un importo maggiore di zero",
		budgetHintExisting:
			"Svuota il campo per togliere il limite: i periodi passati restano com'erano.",
		budgetHintNew: "Lascia vuoto per non impostare nessun limite.",
	},

	/** Transazioni ricorrenti (Fase 14). */
	recurring: {
		emptyTitle: "Nessun pagamento ricorrente",
		emptyDescription:
			"I tuoi abbonamenti e pagamenti pianificati appariranno qui non appena ne aggiungerai uno.",
		addAction: "Aggiungi ricorrente",
		/**
		 * ⚠️ Forme plurali, non una ternaria `n === 1 ? … : …` nel componente.
		 * Quella funziona in italiano e in inglese per caso: le categorie plurali
		 * sono una proprietà della lingua, e `plural()` le chiede a `Intl`.
		 */
		count: {
			one: "{n} pagamento pianificato",
			other: "{n} pagamenti pianificati",
		},
		paused: "in pausa",
		pause: "pausa",
		resume: "riprendi",
		edit: "modifica",
		delete: "elimina",
		deleteTitle: "Elimina ricorrenza",
		deleteBody: "Interrompe le generazioni future. I movimenti già creati restano. Continuare?",

		editTitle: "Modifica ricorrenza",
		amount: "Importo",
		category: "Categoria",
		noCategory: "Nessuna categoria",
		frequency: "Frequenza",
		nextDate: "Prossima data",
		description: "Descrizione",
		descriptionPlaceholder: "Opzionale",
		saveChanges: "Salva modifiche",
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

		/** Testo delle password, condiviso con il recupero pre-login. */
		passwordCommon: {
			show: "Mostra password",
			hide: "Nascondi password",
			tooShort: "La password deve essere di almeno {min} caratteri",
			mismatch: "Le password non corrispondono",
			/** Indicizzate dal punteggio 0–3 di `scorePassword`. */
			strength: {
				0: "troppo corta",
				1: "sicurezza bassa",
				2: "sicurezza media",
				3: "sicurezza alta",
			},
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

	/** Menu che si apre dal gruppo avatar+nome in home (Fase 18). */
	profileMenu: {
		settings: "Impostazioni",
		signOut: "Esci",
	},

	/** Pannello notifiche (Fase 17b) — le frasi arrivano nel lotto 5. */
	notifications: {
		loading: "Caricamento…",
		empty: "Nessuna notifica",
		title: "Notifiche",
		markAllRead: "segna tutte come lette",
		emptyDescription: "Qui arrivano gli avvisi su budget, obiettivi e rinnovi in arrivo.",
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
