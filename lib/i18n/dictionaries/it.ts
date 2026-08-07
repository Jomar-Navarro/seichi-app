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

	/** Tema chiaro/scuro (Fase 18). */
	theme: {
		light: "chiaro",
		dark: "scuro",
		system: "sistema",
		label: "Tema",
		followsSystem: "segue il sistema",
		/** "segue il sistema · ora scuro" — la seconda metà si aggiunge solo dopo l'idratazione. */
		followsSystemNow: "segue il sistema · ora {theme}",
	},

	settings: {
		title: "Impostazioni",
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
