/**
 * Dizionario inglese.
 *
 * L'annotazione `: Dictionary` è il controllo che regge tutta la Fase 19: una
 * chiave mancante o un refuso in un nome fanno fallire la build, e una chiave in
 * più viene rifiutata dal controllo sugli oggetti letterali. Nessuna stringa può
 * restare indietro in silenzio quando l'italiano cresce.
 */

import type { Dictionary } from "./it";

export const en: Dictionary = {
	meta: {
		title: "Seichi",
		description:
			"Financial clarity. The way you level the ground before you build, Seichi helps you put your finances in order — calmly, clearly, in control.",
	},

	common: {
		save: "Save",
		cancel: "Cancel",
		delete: "Delete",
		edit: "Edit",
		close: "Close",
		back: "Back",
		continue: "Continue",
		confirm: "Confirm",
		loading: "Loading…",
		retry: "Try again",
		genericError: "Something went wrong. Please try again.",
		unknownError: "Unknown error",
		required: "This field is required",
	},

	nav: {
		home: "Home",
		transactions: "Transactions",
		goals: "Goals",
		investments: "Investments",
		addTransaction: "Add transaction",
	},

	// Le chiavi restano i valori del database — si traduce solo ciò che si legge.
	types: {
		entrata: "Income",
		spesa: "Expenses",
		risparmio: "Savings",
		investimento: "Investments",
		abbonamento: "Subscriptions",
	},

	theme: {
		light: "light",
		dark: "dark",
		system: "system",
		label: "Theme",
		followsSystem: "follows the system",
		followsSystemNow: "follows the system · currently {theme}",
	},

	settings: {
		title: "Settings",
		preferences: {
			currency: "Currency",
			language: "Language",
		},
		currencies: {
			EUR: "Euro",
			USD: "Dollar",
			GBP: "Pound",
			CHF: "Franc",
			JPY: "Yen",
		},
	},
};
