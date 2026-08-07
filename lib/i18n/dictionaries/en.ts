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
		done: "Done",
		saving: "Saving…",
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

	typesSingular: {
		entrata: "Income",
		spesa: "Expense",
		risparmio: "Saving",
		investimento: "Investment",
		abbonamento: "Subscription",
	},

	newByType: {
		entrata: "new income",
		spesa: "new expense",
		risparmio: "new saving",
		investimento: "new investment",
		abbonamento: "new subscription",
	},

	theme: {
		light: "light",
		dark: "dark",
		system: "system",
		followsSystem: "follows the system",
		followsSystemNow: "follows the system · currently {theme}",
		always: "always {theme}",
	},

	errors: {
		notAuthenticated: "Not signed in",
		nameRequired: "A name is required",
		nameTooLong: "That name is too long",
		invalidType: "Invalid type",
		unsupportedLanguage: "Unsupported language",
		noFileSelected: "No file selected",
		unsupportedFormat: "Unsupported format — use JPG, PNG or WebP",
		enterPassword: "Enter your password",
		invalidEmail: "Invalid email address",
		sameEmail: "That's already your current email",
		samePassword: "The new password must be different from the current one",
		wrongCurrentPassword: "Your current password is not correct",
		wrongPassword: "Incorrect password",
		emailMismatch: "That email doesn't match your account",
		avatarRemoveFailed: "Could not remove your profile photo. Please try again.",
	},

	budget: {
		monthlyLimit: "Monthly limit",
		variableOnly: "Variable spending only",
		none: "none",
		limitAriaLabel: "Monthly spending limit",
		perMonth: "/ month",
		fixedOutflows: "Expected fixed outflows",
		fixedOutflowsHint: "This month's subscriptions, outside the limit",
		amountMustBePositive: "Enter an amount greater than zero",
		readFailed: "Could not read your budget: {reason}",
	},

	categories: {
		deleteTitle: "Delete category",
		deleteQuestionBefore: "Delete ",
		deleteQuestionAfter: "? This cannot be undone.",
		deleting: "Deleting…",
	},

	account: {
		profile: {
			uploading: "Uploading…",
			replacePhoto: "Replace photo",
			uploadPhoto: "Upload a photo",
			photoHint: "JPG, PNG or WebP — {max} MB maximum",
			removePhoto: "Remove photo",
			imageTooLarge: "The image cannot be larger than {max} MB",
			uploadFailed: "Upload failed. Please try again.",
			removeFailed: "Could not remove the photo. Please try again.",
			saveFailed: "Could not save. Please try again.",
			nameSection: "Name",
			namePlaceholder: "What should we call you",
			nameUpdated: "Name updated",
		},

		email: {
			confirmIdentity: "Confirm your identity",
			currentEmail: "Current email",
			password: "Password",
			verifying: "Verifying…",
			newEmailIntro: "Enter your new email",
			newEmailPlaceholder: "New email",
			sendRequest: "Send request",
			sending: "Sending…",
			sentTitle: "Check your email",
			sentDescription:
				"We've sent you a confirmation link. For security, Supabase may also ask you to confirm from your current inbox: the change only takes effect afterwards.",
		},

		password: {
			current: "Current password",
			new: "New password",
			confirm: "Confirm new password",
			update: "Update password",
			updating: "Updating…",
			updatedTitle: "Password updated",
		},

		delete: {
			warning:
				"This action is permanent. You will lose your transactions, goals, categories and recurring rules forever — everything. There is no way to recover your data afterwards.",
			typeEmail: "Type your email address to confirm",
			emailPlaceholder: "your email address",
			deleteForever: "Delete permanently",
			deleting: "Deleting…",
		},
	},

	settings: {
		title: "Settings",
		editProfile: "edit",
		editEmail: "Change email",
		profilePhoto: "Profile photo",

		groups: {
			appearance: "Appearance",
			preferences: "Preferences",
			budget: "Budget",
			categories: "Categories",
			automation: "Automation",
			security: "Security",
			support: "Support",
			dangerZone: "Danger zone",
		},

		manageCategories: "Manage categories",
		recurringTransactions: "Recurring transactions",
		recurringTitle: "Recurring",
		biometricLock: "Biometric lock",
		pinLock: "PIN lock",
		comingSoon: "soon",
		changePassword: "Change password",
		externalProvider: "You sign in with an external provider",
		about: "About",
		version: "version {version}",
		signOut: "Sign out",
		deleteAccount: "Delete your account",

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
