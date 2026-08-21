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
		/** Segnaposto di un Select non ancora scelto: "Seleziona categoria". */
		selectPlaceholder: "Seleziona {field}",
		/** L'occhio che nasconde gli importi: è un bottone con la sola icona. */
		toggleVisibility: "Mostra o nascondi gli importi",
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
		disinvestimento: "Disinvestimenti",
		abbonamento: "Abbonamenti",
		trasferimento: "Trasferimenti",
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
		/*
		 * ⚠️ NIENTE `trasferimento` né `disinvestimento` qui, né in `newByType` e
		 * `typesShort`, e non è una dimenticanza.
		 *
		 * Questi tre elenchi servono SOLO alla UI delle categorie
		 * (`CategoryManager`, `CategorySheet`), e nessuno dei due tipi può avere
		 * una categoria propria — `categories_type_check` non li ammette — ma per
		 * ragioni OPPOSTE, che vale la pena tenere distinte:
		 *
		 *   · un `trasferimento` non ha categoria per costruzione (un CHECK la
		 *     vieta: `transactions_transfer_category_check`);
		 *   · un `disinvestimento` la categoria ce l'ha, ma è **in prestito** dagli
		 *     investimenti — vendi "ETF", non "disinvestimento ETF" — perché le due
		 *     righe devono compensarsi sulla stessa posizione (#52).
		 *
		 * In entrambi i casi le voci sarebbero codice morto in due lingue — il
		 * difetto che il code-review della 20a ha trovato otto volte.
		 *
		 * `t.types` (plurale) e `t.transactionTypes` invece ce l'hanno, perché
		 * quelli descrivono i TIPI DI MOVIMENTO e vengono resi davvero: il filtro
		 * dei movimenti, il sottotitolo delle righe, le card del modale.
		 */
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
		/* Niente `trasferimento`: vedi la nota in `typesSingular`. */
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
		unsupportedCurrency: "Valuta non supportata",
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
		/**
		 * ⚠️ Frase PROPRIA e non `avatarRemoveFailed`: due cause diverse non possono
		 * avere lo stesso messaggio solo perché arrivano dallo stesso punto del
		 * codice. Dire "foto profilo" a chi sta eliminando l'account con delle
		 * ricevute allegate manderebbe a controllare una cosa sana — la stessa
		 * classe già corretta in `contoError()` nella 20b.
		 */
		receiptsRemoveFailed:
			"Non è stato possibile rimuovere le ricevute allegate. L'account non è stato eliminato: riprova.",
		/**
		 * Cancellazione di una categoria che ha ancora movimenti.
		 *
		 * ⚠️ Era l'ULTIMA frase cablata dell'app, sopravvissuta alla Fase 19 —
		 * un template dentro una server action, quindi invisibile a uno scanner che
		 * guardi solo i `.tsx` o solo i nodi JSX. Un utente in inglese leggeva
		 * italiano proprio mentre l'app gli negava un'operazione.
		 *
		 * Il plurale passa da `plural()`: la versione cablata lo scriveva a mano,
		 * e nel ramo singolare sbagliava anche l'italiano — diceva "Spostali o
		 * eliminali" (pronome plurale) per un solo movimento.
		 */
		categoryHasTransactions: {
			one: "Questa categoria ha {n} movimento collegato. Spostalo o eliminalo prima di rimuoverla.",
			other: "Questa categoria ha {n} movimenti collegati. Spostali o eliminali prima di rimuoverla.",
		},
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
			resetTitle: "Reimposta password",
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
		/**
		 * Il nome del primo conto, creato insieme alle categorie.
		 *
		 * ⚠️ Sta nel dizionario ma viene scritto nel DATABASE al momento
		 * dell'insert, non letto a ogni render: da lì in poi è un dato
		 * dell'utente, rinominabile. Stessa regola dei nomi delle categorie
		 * preimpostate (Fase 19).
		 */
		firstAccountName: "Conto principale",
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
		/**
		 * ⚠️ "torna sul conto" fa il lavoro che nella riga sopra fa "fra i tuoi
		 * conti": dice ciò che il tipo NON è. Vendere non è guadagnare — è
		 * capitale tuo che rientra — e senza quelle parole il tipo si legge come
		 * un'entrata, che è proprio la scorciatoia scartata dalla #52 perché
		 * falsifica il Flusso.
		 */
		disinvestimento: {
			label: "Disinvestimento",
			description: "Vendi: il capitale torna sul conto",
		},
		/**
		 * ⚠️ "fra i tuoi conti" e non "sposta denaro": la descrizione deve dire
		 * anche ciò che il tipo NON fa. Un trasferimento non è una spesa, e
		 * l'unico modo di comunicarlo in una riga è nominare i due estremi.
		 */
		trasferimento: { label: "Trasferimento", description: "Sposta denaro fra i tuoi conti" },
	},

	home: {
		greeting: "Bentornato",
		error: "Errore",
		/**
		 * ⚠️ Non è più "Saldo totale" (Fase 20a), e non è una rinomina: la cifra
		 * grande è un'altra. Era entrate meno tutto il resto su TUTTA la storia,
		 * cioè un surrogato di "quanto ho" costruito quando i conti non
		 * esistevano; ora quella domanda ha una risposta vera nella pagina conti,
		 * e due schermate che rispondono diversamente sono la configurazione
		 * peggiore. La home dichiara ciò che è sempre stata: una vista di FLUSSO.
		 *
		 * `flowTitle` si compone col mese: "Flusso · giugno".
		 */
		flowTitle: "Flusso",
		/**
		 * ⚠️ "uscite" e non "spese". Il numero sottrae anche gli abbonamenti, che
		 * nella tassonomia dell'app sono un tipo a sé e non hanno una card: dire
		 * "spese" escluderebbe l'affitto dalla frase mentre è dentro al calcolo.
		 */
		flowExplain: "entrate meno uscite di questo mese — per i saldi, scorri →",
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

	/** Conti multipli — Fase 20a. */
	accounts: {
		title: "Conti",
		loadError: "Errore nel caricamento dei conti.",

		/** Il selettore in home e il filtro nella lista movimenti. */
		all: "Tutti i conti",
		manage: "Gestisci conti",

		/**
		 * ⚠️ "Saldo", non "Saldo totale". Gli archiviati restano fuori dalla
		 * somma, quindi "totale" sarebbe falso in cifre grandi con la smentita in
		 * piccolo accanto — la trappola già elevata a regola nella 17a ("spese
		 * variabili", mai "spese totali").
		 */
		/** Etichetta del CAMPO nel form movimento — singolare, non il titolo della pagina. */
		fieldLabel: "Conto",
		balanceHeading: "Saldo",
		activeCount: { one: "{n} conto attivo", other: "{n} conti attivi" },
		/** Card saldo nel carosello della home: cosa somma, detto esplicitamente. */
		balanceExplainAll: "somma dei saldi sui conti attivi — gli archiviati restano fuori",
		balanceExplainOne: "giacenza attuale di questo conto",
		seeDetail: "Vedi il dettaglio dei conti",

		archivedSection: { one: "Archiviato · {n}", other: "Archiviati · {n}" },
		/** Dice dove NON è finito il denaro, cioè perché il saldo sopra non lo include. */
		archivedNote: "archiviato · fuori dal saldo",
		reactivate: "riattiva",

		/**
		 * ⚠️ Etichette DECORATIVE, come `accounts.type` che le sceglie: servono a
		 * disegnare e a nient'altro. La natura di un movimento la decide sempre
		 * `transactions.type`, mai il conto su cui si trova.
		 */
		types: {
			corrente: "Corrente",
			contanti: "Contanti",
			risparmio: "Risparmio",
			investimento: "Investimento",
		},
		/** Ripiego quando `type` è NULL: la colonna è nullable, non ogni conto ne ha uno. */
		typeless: "Conto",

		newTitle: "Nuovo conto",
		editTitle: "Modifica conto",
		name: "Nome del conto",
		namePlaceholder: "Es. Conto corrente, Contanti…",
		color: "Colore",
		/**
		 * ⚠️ I nomi servono all'`aria-label` delle pastiglie colore, che non hanno
		 * testo visibile: senza, il nome accessibile sarebbe il token CSS.
		 */
		colors: {
			blue: "Blu",
			green: "Verde",
			gold: "Oro",
			purple: "Viola",
			red: "Rosso",
		},
		type: "Tipo",
		initialBalance: "Saldo iniziale",
		/**
		 * ⚠️ Dice cosa NON fa, perché è la domanda che l'utente si pone: 2.400 €
		 * che compaiono senza un movimento sembrano un'entrata, e se lo fossero
		 * gonfierebbero i redditi del mese e ogni grafico.
		 */
		initialBalanceHint:
			"Il punto di partenza di questo conto — non è mai un'entrata né una spesa.",
		/**
		 * In modifica il campo resta (Fase 20a): senza, un refuso sarebbe
		 * irreparabile, perché il conto non si cancella e il saldo deriva da lì.
		 */
		initialBalanceEditHint:
			"Cambiarlo sposta il saldo, non crea né entrate né spese.",
		save: "Salva conto",
		saving: "Salvataggio…",

		/**
		 * ⚠️ "Archivia", mai "Elimina", e come azione secondaria: un conto con
		 * storico non si cancella, perché cancellarlo porterebbe via anni di
		 * movimenti reali. Un conto chiuso in banca non fa sparire ciò che ci hai
		 * speso.
		 */
		archive: "Archivia",
		/**
		 * ⚠️ DEVE essere diverso da `archive`, o il secondo passo è invisibile.
		 * Prima erano entrambi "Archivia": il bottone non cambiava, e l'unico
		 * segnale che la conferma fosse in attesa era un paragrafo comparso sotto.
		 * Stesso schema di `GoalSheet` ("Elimina movimento" → "Conferma eliminazione").
		 */
		archiveConfirm: "Conferma archiviazione",
		archiveBody:
			"Sparirà dai selettori, ma i suoi movimenti restano e il suo storico resta consultabile.",

		emptyTitle: "Ancora nessun conto",
		emptyDescription: "Aggiungi un conto per sapere dove si trova il tuo denaro.",

		errors: {
			nameRequired: "Dai un nome al conto.",
			invalidColor: "Colore non valido.",
			/** Il form movimento senza conti: dice perché il salvataggio è spento. */
			none: "Serve un conto per registrare un movimento. Creane uno dalla pagina conti.",
			saveFailed: "Non è stato possibile salvare il conto. Riprova.",
			nameTooLong: "Il nome può avere al massimo 50 caratteri.",
			notFound: "Conto non trovato.",
			lastAccount:
				"Questo è il tuo unico conto attivo: ogni movimento deve appartenere a un conto.",
			/**
			 * Archiviazione rifiutata perché ci sono regole ricorrenti attive.
			 *
			 * ⚠️ Il messaggio dice cosa FARE, e non è cortesia: senza le due vie
			 * d'uscita nominate, l'utente si trova davanti a un divieto senza
			 * rimedio. È la stessa correzione fatta all'avviso del job giornaliero,
			 * il cui `hint` diceva "Controlla lo stato del database" a chi un
			 * database non ce l'ha.
			 */
			hasRecurring: {
				one: "C'è {n} regola ricorrente attiva su questo conto. Spostala su un altro conto o mettila in pausa, poi riprova.",
				other: "Ci sono {n} regole ricorrenti attive su questo conto. Spostale su un altro conto o mettile in pausa, poi riprova.",
			},
		},
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
			/**
			 * Le due estremità di un trasferimento (Fase 20b). Dove il conto è uno
			 * solo, `t.accounts.fieldLabel` ("Conto") basta; qui no, perché accanto
			 * a un secondo campo non direbbe quale dei due.
			 *
			 * ⚠️ **"Conto di partenza", non "Dal conto"** — ed è una correzione
			 * fatta guardando lo schermo, non ragionando. `Select` compone il
			 * segnaposto come `Seleziona {etichetta minuscola}`, quindi "Dal conto"
			 * dava **"Seleziona dal conto"** e "Al conto" **"Seleziona al conto"**:
			 * due mezze frasi. In inglese era identico — *"Select to account"*.
			 *
			 * È letteralmente la trappola già documentata per la Fase 19
			 * ("Seleziona category", "Nuova investimento"), reintrodotta da chi
			 * l'aveva scritta. La regola che ne discende: **un'etichetta di campo
			 * non si sceglie da sola, si sceglie insieme alla frase che la
			 * conterrà** — e in questo progetto quella frase esiste sempre, perché
			 * `Select` la costruisce.
			 */
			fromAccount: "Conto di partenza",
			toAccount: "Conto di arrivo",
			/** La voce che RIMUOVE la destinazione: senza, la scelta è irreversibile. */
			noDestination: "Nessuno",
			/**
			 * ⚠️ Compare solo dove la destinazione è FACOLTATIVA (risparmio,
			 * investimento). Su un trasferimento il campo si spiega da sé; qui no,
			 * e ciò che non si spiega è esattamente il motivo per cui esiste —
			 * senza questa riga l'utente registra il risparmio E il trasferimento,
			 * cioè il doppio conteggio.
			 */
			destinationHint: "il denaro si sposta davvero su quel conto, e l'obiettivo avanza lo stesso",
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
		/**
		 * ⚠️ Voci SEPARATE per la lista vuota CON i filtri attivi.
		 * Riusare quelle sopra diceva "non hai ancora registrato nulla" a chi ha
		 * centinaia di movimenti e ha solo scelto un conto senza spese nel
		 * periodo: un'affermazione falsa che fa dubitare che i dati esistano
		 * ancora. Il difetto c'era già coi filtri tipo/periodo, ma il filtro per
		 * conto lo rende facile da incontrare.
		 */
		emptyFilteredTitle: "Nessun movimento con questi filtri",
		emptyFilteredDescription:
			"Prova ad allargare il periodo, o a scegliere un altro conto o tipo.",
		addAction: "Aggiungi movimento",
		searchPlaceholder: "Cerca movimenti",
		/**
		 * ⚠️ Era "Tutte", ed è diventato ambiguo aggiungendo il filtro CATEGORIA
		 * (#9): due chip affiancati che dicevano "Tutte" e "Tutte le categorie"
		 * lasciavano indovinare a cosa si riferisse il primo. Il chip non ha
		 * un'etichetta accanto che lo spieghi — è l'etichetta — quindi deve
		 * nominare da sé la propria dimensione.
		 *
		 * La chiave resta `filterAll` perché descrive il RUOLO (l'opzione "tutti"
		 * del filtro tipo), non il testo.
		 */
		filterAll: "Tutti i tipi",
		/** L'opzione "tutte" del filtro categoria (#9). */
		filterAllCategories: "Tutte le categorie",
		/**
		 * ⚠️ "Azzera filtri" e non "Cancella": cancellare suggerisce di perdere
		 * dei dati, e qui non si perde niente — si torna allo stato con cui la
		 * pagina si apre.
		 */
		resetFilters: "Azzera filtri",
		/** Il pulsante in fondo alla lista paginata (#9). */
		loadMore: "Carica altri",
		/**
		 * ⚠️ Parla di quante righe ha GUARDATO, non di quante ne ha trovate.
		 * Cercando, il tetto vale sulle righe scandite e non sulle corrispondenze:
		 * "altri risultati" sarebbe falso proprio quando non ce n'è nemmeno uno.
		 */
		searchScanLimit:
			"La ricerca ha guardato i {n} movimenti più recenti del periodo. Restringi il periodo per cercare più indietro.",
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
		/** Intestazione del gruppo di obiettivi già raggiunti. */
		completedSection: "Completati",
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
		/**
		 * ⚠️ Era "Valore portafoglio", ed era **falso da sempre**: Seichi non ha
		 * quotazioni, quindi questo numero non è il valore di mercato ma la somma
		 * di quanto hai versato — ora al netto di quanto hai liquidato (#52).
		 *
		 * La #52 non ha creato la bugia, l'ha resa visibile: finché il totale
		 * poteva solo crescere, "valore" e "versato" sembravano la stessa cosa.
		 * È la regola della 17a — *un numero sbagliato che sembra giusto è peggio
		 * di un numero assente* — e la stessa correzione già fatta su "spese
		 * totali" → "spese variabili" e su "Saldo totale" → "Saldo · N conti".
		 */
		portfolioValue: "Capitale versato",
		/** Mostrata quando una posizione è stata liquidata oltre il versato. */
		negativeNote: "hai liquidato più di quanto versato: la differenza è guadagno",
		vsLastMonth: "rispetto al mese scorso",
		composition: "Composizione",
		total: "Totale",
		positions: "Posizioni",
		invested: "Investito",
		/** Tipologie: le chiavi sono i valori di transactions.investment_type. */
		types: {
			etf: "ETF",
			azioni: "Azioni",
			obbligazioni: "Obbligazioni",
			crypto: "Crypto",
			altro: "Altro",
		},
	},

	analytics: {
		title: "Analisi",
		lastWeek: "Ultima settimana",
		/**
		 * ⚠️ "Flusso", non più "Flusso netto" — ed è la stessa parola della home
		 * (`t.home.flowTitle`) perché è **lo stesso identico numero**, calcolato
		 * dalla stessa `sommaUscite()`.
		 *
		 * Fino alla 20a i due valori DIVERGEVANO — `/analisi` sottraeva anche
		 * risparmi e investimenti — e due nomi diversi erano coerenti con due cose
		 * diverse. La review della 20a ha allineato i numeri, e **così facendo ha
		 * reso i due nomi un difetto**: vale la regola già scritta per i conti,
		 * *stesso titolo o lo stesso numero ne avrebbe due*. "Netto" non aggiunge
		 * nulla — la formula è identica — e suggeriva una terza grandezza che non
		 * esiste.
		 *
		 * È il gemello della regola già registrata per la 20a: *correggere un
		 * numero può rendere falsa l'etichetta che lo descriveva*. Qui l'etichetta
		 * non è diventata falsa, è diventata **superflua e divergente** — e si
		 * scopre solo mettendo le due schermate una accanto all'altra.
		 */
		netFlow: "Flusso",
		/** Nessun periodo precedente con cui confrontarsi. */
		firstMonth: "— primo mese",
		tabs: {
			settimana: "Settimana",
			mese: "Mese",
			anno: "Anno",
		},
		legendIncome: "Entrate",
		/**
		 * ⚠️ "Uscite", NON "Uscite totali".
		 *
		 * La serie contiene `spesa` + `abbonamento`, non tutto ciò che non è
		 * entrata: risparmi e investimenti ne sono fuori, perché con i conti quel
		 * denaro è spostato, non speso (Fase 20a). "Totali" era vero prima di
		 * quella correzione e falso dopo — la stessa parola di troppo di "spese
		 * totali" nella 17a, prodotta questa volta *rendendo il calcolo più
		 * corretto*: correggere un numero può rendere falsa l'etichetta che lo
		 * descriveva.
		 */
		legendExpenses: "Uscite",
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
	/**
	 * Allegati / ricevute (Fase 22, issue #36).
	 *
	 * ⚠️ "Ricevute" e non "Allegati" nel titolo visibile: è la parola con cui
	 * l'utente cerca la funzione. "Allegato" descrive il MECCANISMO — un file
	 * appeso a un record — e resta nei nomi tecnici; "ricevuta" descrive la cosa
	 * che fotografi. È la stessa distinzione già fatta fra "giacenza" e
	 * "investito": il nome segue chi legge, non chi implementa.
	 */
	attachments: {
		title: "Ricevute",
		add: "Aggiungi ricevuta",
		/** ⚠️ `{max}` viene da `ATTACHMENT_MAX_BYTES`, mai scritto a mano qui. */
		hint: "JPG, PNG o WebP · massimo {max} MB",
		/** Il conteggio accanto al movimento nella lista. */
		count: { one: "{n} ricevuta", other: "{n} ricevute" },
		remove: "Rimuovi",
		open: "Apri a schermo intero",
		uploading: "Caricamento…",
		/** Mostrato al posto dell'anteprima quando il file non è più nel bucket. */
		missing: "File non disponibile",
		errors: {
			tooLarge: "L'immagine supera {max} MB. Scegline una più leggera.",
			notSaved: "Non è stato possibile allegare la ricevuta a questo movimento.",
		},
	},

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
		/**
		 * ⚠️ "USCITE fisse", non solo "fisse": la forma breve aveva perso il
		 * sostantivo e la riga si leggeva "fisse del mese € 52" — fisse cosa? È la
		 * stessa classe di "Tutte" accanto a "Tutte le categorie" nella barra
		 * filtri (#9): un testo che sta da solo deve nominare la propria dimensione,
		 * perché non ha un'etichetta accanto che lo spieghi.
		 *
		 * "del mese" resta perché senza quella parola la cifra non avrebbe un arco
		 * temporale — l'intestazione della sezione è neutra ("Budget") dalla 17a.
		 */
		fixedThisMonth: "uscite fisse del mese {amount}",
		/**
		 * ⚠️ Compare SOLO con un filtro conto attivo, e dice un ambito diverso.
		 *
		 * Un budget è un limite su una CATEGORIA, non su un conto: "€ 400 per la
		 * spesa" non si divide fra contanti e carta. Filtrarlo per conto
		 * inventerebbe budget per-conto che nessuno ha impostato; nasconderlo
		 * toglierebbe di vista i budget a chi filtra. Resta, e lo dichiara — la
		 * stessa mossa già fatta sulla FlowCard e su /analisi.
		 */
		acrossAllAccounts: "i budget valgono su tutti i conti, non solo su quello filtrato",
	},

	/**
	 * Stato del job giornaliero (issue #47).
	 *
	 * ⚠️ Il testo dice **cosa non funziona per l'utente**, non come si chiama il
	 * meccanismo: "job", "cron" e "pg_cron" non compaiono. Chi legge vuole sapere
	 * che i movimenti ricorrenti non vengono registrati, non quale processo è
	 * fermo — quello sta nella issue.
	 */
	jobHealth: {
		/**
		 * ⚠️ Due varianti annidate per AMBITO (`DailyJobScope`), non un testo solo.
		 * Quando fallisce il passo delle notifiche i movimenti ricorrenti SONO
		 * stati registrati: dire comunque che non lo sono è una dichiarazione
		 * falsa sui dati finanziari dell'utente. La versione precedente ne aveva
		 * una sola e la usava per entrambi i guasti.
		 */
		recurring: {
			/** Riga in /impostazioni. Compare SOLO quando c'è un problema. */
			rowLabel: "Automazioni ferme",
			/** Titolo dell'avviso in cima a /impostazioni/ricorrenti. */
			title: "I movimenti ricorrenti non vengono registrati",
			/**
			 * ⚠️ L'ultima frase dev'essere azionabile DA CHI LEGGE. Qui c'era
			 * "Controlla lo stato del database": un'istruzione per lo sviluppatore,
			 * data a un utente che non ha né database né credenziali — e per giunta
			 * l'unica cosa concreta dell'intero avviso.
			 */
			hint: "Le transazioni pianificate potrebbero non comparire e i totali essere incompleti. Nel frattempo puoi inserirle a mano.",
		},
		notifications: {
			rowLabel: "Avvisi non aggiornati",
			title: "Alcuni avvisi potrebbero mancare",
			/** Rassicura sulla parte che NON è compromessa: è tutto il punto. */
			hint: "I tuoi movimenti sono registrati correttamente: a non essere stati generati sono gli avvisi su budget e obiettivi.",
		},
		/**
		 * `{when}` è già una frase relativa ("2 giorni fa") prodotta da
		 * `formatRelativeTime`: qui non si compone una data a mano.
		 */
		lastOk: "Ultimo controllo riuscito: {when}.",
		/**
		 * Il caso peggiore: nessuna traccia di alcuna esecuzione.
		 *
		 * ⚠️ Era codice morto finché il seme `installed` veniva contato come
		 * esecuzione riuscita — cioè finché lo stato che questa frase descrive era
		 * l'unico irraggiungibile. Vedi `20260811_job_health_fixes.sql`.
		 */
		never: "Non risulta alcuna esecuzione.",
		/** Il job ha girato ma un passo è fallito: diverso da "non ha girato". */
		withError: "L'ultima esecuzione è terminata con un errore.",
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
		/* Niente `trasferimento`: vedi la nota in `typesSingular`. */
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
		darkMode: "Modalità scura",
		signOut: "Esci",
	},

	/** Pannello notifiche (Fase 17b) — le frasi arrivano nel lotto 5. */
	notifications: {
		loading: "Caricamento…",
		empty: "Nessuna notifica",
		/** Meno di un minuto fa. Intl darebbe "ora", ambiguo accanto a "1 ora fa". */
		justNow: "adesso",
		title: "Notifiche",
		markAllRead: "segna tutte come lette",
		emptyDescription: "Qui arrivano gli avvisi su budget, obiettivi e rinnovi in arrivo.",
		/**
		 * Le frasi delle notifiche, composte dai FATTI salvati nel `payload` JSONB.
		 *
		 * È il motivo per cui la Fase 17b ha scelto di non salvare il testo già
		 * scritto: la riga registra "categoria X, speso 120, limite 100" e la frase
		 * nasce alla lettura, quindi **anche le notifiche di mesi fa cambiano lingua**
		 * insieme all'app. Salvando la frase, tutto lo storico sarebbe rimasto
		 * italiano per sempre — ed è esattamente ciò che quella decisione previde.
		 *
		 * ⚠️ Frasi INTERE per ogni caso, non un tronco comune più un aggettivo
		 * appeso. Il codice componeva `Budget "X" ` + ("superato" | "quasi
		 * esaurito"): funziona finché l'aggettivo va in coda, cioè finché la lingua
		 * è quella in cui è stato scritto.
		 */
		messages: {
			budgetExceeded: 'Budget "{category}" superato',
			budgetNearLimit: 'Budget "{category}" quasi esaurito',
			/** Budget GLOBALE: "variabili" e mai "totali" — affitto e utenze restano fuori. */
			globalExceeded: "Limite sulle spese variabili superato",
			globalNearLimit: "Limite sulle spese variabili quasi raggiunto",
			spentOf: "Hai speso {spent} su {amount}",

			goalReached: 'Obiettivo "{goal}" raggiunto',
			goalHalfway: 'Obiettivo "{goal}" a metà strada',
			savedOf: "Hai messo da parte {saved} su {target}",

			/** `{when}` è "oggi" / "domani" / "fra 3 giorni", prodotto da `Intl`. */
			renewal: 'Rinnovo "{name}" {when}',
			renewalFallbackName: "abbonamento",
			renewalAmount: "Sono previsti {amount}",

			recurringGenerated: {
				one: "Registrato {n} movimento ricorrente",
				other: "Registrati {n} movimenti ricorrenti",
			},

			/**
			 * Tipo sconosciuto. Il `CHECK` sui tipi vive nella migration e può
			 * crescere senza che questo file lo sappia: senza ripiego, `meta.icon`
			 * su `undefined` porterebbe via l'intera dashboard.
			 */
			fallback: "Notifica",
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
			/** Import (Fase 21) e, quando arriverà, export (Fase 23). */
			data: "Dati",
			security: "Sicurezza",
			support: "Supporto",
			dangerZone: "Zona pericolo",
		},

		importData: "Importa transazioni",
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

	/** Import di transazioni da file — Fase 21. */
	import: {
		title: "Importa transazioni",

		file: {
			/** Il gesto, non il formato: "trascina" è ciò che si può fare qui. */
			drop: "Trascina un file CSV",
			or: "o tocca per selezionare",
			/**
			 * ⚠️ Il limite dichiarato deve corrispondere a `IMPORT_MAX_BYTES`, che
			 * a sua volta sta sotto `bodySizeLimit` di `next.config.ts`. Sono tre
			 * numeri da tenere allineati, come per l'avatar.
			 */
			hint: "file .csv con data, importo e descrizione · massimo 2 MB",
			change: "Cambia file",
			/**
			 * ⚠️ Il conto si chiede QUI, nello stesso passo del file, e la frase
			 * dice perché: è una proprietà dell'estratto, non delle singole righe.
			 */
			accountLabel: "Conto dell'estratto",
			accountHint: "di quale conto è questo file",
			noAccounts: "Serve almeno un conto attivo per importare.",
			continue: "Continua",

			/** Il profilo riconosciuto, mostrato appena scelto il file. */
			recognised: "{source} · {n}",
			sources: {
				trade_republic: "Estratto Trade Republic",
				generico: "CSV generico",
			},
			/**
			 * ⚠️ Compare SOLO per i profili di broker, e questa riga esiste perché
			 * la sua assenza è costata un import sbagliato da 216 movimenti: chi
			 * carica un estratto Trade Republic non ha necessariamente un conto
			 * Trade Republic in Seichi, e il campo proponeva il primo conto della
			 * lista senza dire che era un'altra cosa.
			 */
			brokerHint:
				"È l'estratto del tuo conto Trade Republic: scegli il conto che lo rappresenta, o creane uno. Non il conto da cui parti per versare.",

			/** Creare un conto senza uscire dal flusso e perdere il file scelto. */
			newAccount: "Nuovo conto",
			newAccountName: "Nome del conto",
			create: "Crea",
		},

		/** Gli import già fatti, da cui si annulla. */
		history: {
			title: "Import precedenti",
			/** ⚠️ Le righe si contano adesso: quelle cancellate a mano non ci sono più. */
			rows: { one: "{n} movimento", other: "{n} movimenti" },
		},

		/** Il passo che compare solo se il profilo non è riconosciuto. */
		mapping: {
			title: "Quali colonne servono",
			hint: "Il formato non è stato riconosciuto: indica dove stanno data e importo.",
			date: "Data",
			amount: "Importo",
			description: "Descrizione",
			none: "nessuna",
		},

		preview: {
			found: { one: "{n} movimento trovato", other: "{n} movimenti trovati" },
			/**
			 * ⚠️ "gruppi" e non "righe": è la differenza rispetto al mockup, che
			 * faceva decidere riga per riga. Duecento movimenti sono una quindicina
			 * di decisioni, e la frase deve dirlo o l'utente si aspetta duecento tap.
			 */
			explain: "Decidi per gruppo: una scelta vale per tutte le righe che contiene.",
			rows: { one: "{n} riga", other: "{n} righe" },
			/** Coda della lista aperta: dice che ce ne sono ALTRE, non quante in tutto. */
			more: { one: "+ {n} altra riga", other: "+ {n} altre righe" },
			undecided: { one: "{n} gruppo da decidere", other: "{n} gruppi da decidere" },
			becomes: "Tipo di movimento",
			category: "Categoria",
			noCategory: "nessuna",
			/** ⚠️ Etichette PIENE, non "Dal conto": `Select` compone "Seleziona {label}". */
			counterpart: "Conto di partenza",
			counterpartOut: "Conto di arrivo",
			noDetail: "controparte non indicata",
			showRows: "Mostra le righe",
			hideRows: "Nascondi le righe",
			continue: "Continua",
		},

		/** Le famiglie di righe. Le parole stanno qui, la meccanica in `lib/import/`. */
		groups: {
			acquisti: "Acquisti e piani d'accumulo",
			vendite: "Vendite",
			interessi: "Interessi",
			dividendi: "Dividendi",
			regalo: "Azioni in regalo",
			carta: "Pagamenti con carta",
			imposte: "Imposte e bolli",
			trasferimentoIn: "Denaro ricevuto",
			trasferimentoOut: "Denaro inviato",
			senzaCassa: "Righe senza movimento di denaro",
			movimenti: "Movimenti",
			altro: "Non riconosciuti",
		},

		/** Perché un gruppo va guardato. Compaiono sotto il titolo del gruppo. */
		notes: {
			/**
			 * ⚠️ Dice il problema, non solo la scelta. Seichi non ha un tipo per il
			 * disinvestimento (issue #52) e le due strade sbagliano in versi
			 * opposti: chi decide deve sapere quale prezzo sta pagando.
			 */
			vendite:
				"Diventano disinvestimenti: il capitale torna sul conto senza contare come guadagno. Come entrata gonfierebbero il flusso del mese.",
			senzaCassa:
				"Trasferimenti di titoli e accrediti gratuiti: non spostano denaro, quindi non diventano movimenti.",
			trasferimento: "Scegli l'altro conto, o l'app non sa da dove arriva il denaro.",
			altro: "Tipo di movimento sconosciuto: decidi tu cosa diventa.",
		},

		targets: {
			/** Non è un tipo di transazione: è la scelta di non scrivere niente. */
			ignora: "Non importare",
		},

		summary: {
			toImport: { one: "{n} movimento da importare", other: "{n} movimenti da importare" },
			ignored: { one: "{n} riga ignorata", other: "{n} righe ignorate" },
			unreadable: { one: "{n} riga illeggibile", other: "{n} righe illeggibili" },
			confirm: "Importa",
			importing: "Importazione…",
		},

		done: {
			title: "Import completato",
			imported: { one: "{n} movimento importato", other: "{n} movimenti importati" },
			/**
			 * ⚠️ "già presenti" e non "duplicati": non sono righe doppie nel file,
			 * sono movimenti che c'erano già da un import precedente. Chiamarli
			 * duplicati farebbe cercare un errore nel file.
			 */
			skipped: { one: "{n} già presente", other: "{n} già presenti" },
			nothing: "Nessun movimento nuovo: erano già tutti importati.",
			undo: "Annulla l'import",
			undoTitle: "Annullare l'import?",
			undoBody:
				"I movimenti scritti da questo import vengono eliminati, comprese le modifiche fatte a mano dopo.",
			undoConfirm: "Annulla l'import",
			undoCancel: "Tieni",
			backToSettings: "Torna alle impostazioni",
		},

		errors: {
			tooLarge: "Il file è troppo grande — massimo 2 MB",
			notCsv: "Serve un file .csv",
			empty: "Nessun movimento leggibile in questo file",
			unknownFormat: "Formato non riconosciuto",
			noAccount: "Scegli il conto a cui appartiene il file",
			undecided: "Decidi cosa fare di ogni gruppo",
			badDecisions: "Scelte non valide",
			transferNeedsAccount: "Scegli l'altro conto del trasferimento",
			/** Lo impone anche un CHECK del database; qui serve solo il messaggio. */
			sameAccount: "Il conto di partenza e quello di arrivo devono essere diversi",
			badCategory: "La categoria non corrisponde al tipo scelto",
			nothingToImport: "Non è rimasto niente da importare",
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
