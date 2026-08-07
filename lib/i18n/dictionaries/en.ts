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
		deleting: "Deleting…",
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

	auth: {
		recovery: {
			linkExpired: "That link has expired or is invalid — request a new reset",
		},
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

		sectionTitle: "Budget",
		variableExpenses: "Variable spending",
		fixedThisMonth: "fixed this month {amount}",
	},

	// Annidate per tipo: le stesse nove icone che in italiano cambiano nome col
	// contesto lo cambiano anche qui (Landmark = Bank transfer / Stocks).
	iconLabels: {
		entrata: {
			Briefcase: "Salary",
			Banknote: "Cash",
			Landmark: "Bank transfer",
			Award: "Bonus",
			Gift: "Gift received",
			Coins: "Extra",
			TrendingUp: "Growth",
			ArrowDownToLine: "Payment in",
			HandCoins: "Tip",
			Percent: "Interest",
			Handshake: "Freelance",
			CircleDollarSign: "Dividends",
		},
		spesa: {
			ShoppingCart: "Everyday shopping",
			ShoppingBasket: "Groceries",
			Utensils: "Restaurants",
			Car: "Transport",
			Home: "Home / Rent",
			Zap: "Utilities",
			Shirt: "Clothing",
			HeartPulse: "Health",
			GraduationCap: "Education",
			Wifi: "Internet",
			Fuel: "Fuel",
			Baby: "Children",
			PawPrint: "Pets",
			Coffee: "Coffee shops",
			Wrench: "Maintenance",
			Stethoscope: "Medical visits",
		},
		investimento: {
			TrendingUp: "ETF / DCA",
			LineChart: "Performance",
			Landmark: "Stocks",
			Bitcoin: "Crypto",
			Building2: "Real estate",
			PieChart: "Allocation",
			Layers: "Portfolio",
			Coins: "Bonds",
			BarChart3: "Returns",
			Vault: "Deposit",
			Globe: "Foreign funds",
			Percent: "Yield %",
			CircleDollarSign: "Dividends",
		},
		risparmio: {
			PiggyBank: "General",
			Shield: "Emergency fund",
			Plane: "Travel",
			Home: "New home",
			GraduationCap: "Children's education",
			Heart: "Wedding",
			Gem: "Big purchase",
			Target: "Goal",
			Baby: "Baby fund",
			Car: "New car",
			Umbrella: "Protection",
			Sunrise: "Retirement",
			Sparkles: "Special occasion",
		},
		abbonamento: {
			Repeat: "General",
			Tv: "Streaming",
			Music: "Music",
			Smartphone: "Mobile",
			Cloud: "Storage",
			Newspaper: "Magazines",
			Dumbbell: "Gym",
			Wifi: "Connectivity",
			Gamepad2: "Cloud gaming",
			BookOpen: "Ebooks / audiobooks",
			Mail: "Premium mail",
			CreditCard: "Prepaid card",
			Radio: "Podcasts",
			Headphones: "Premium music",
		},
	},

	frequencies: {
		settimanale: { label: "Weekly", recur: "Every week" },
		mensile: { label: "Monthly", recur: "Every month" },
		annuale: { label: "Yearly", recur: "Every year" },
	},

	budgetPeriods: {
		settimanale: { label: "weekly", suffix: "/ week", window: "this week" },
		mensile: { label: "monthly", suffix: "/ month", window: "this month" },
		annuale: { label: "yearly", suffix: "/ year", window: "this year" },
	},

	typesShort: {
		entrata: "income",
		spesa: "expense",
		investimento: "invest.",
		risparmio: "saving",
		abbonamento: "subscr.",
	},

	categories: {
		deleteTitle: "Delete category",
		deleteQuestionBefore: "Delete ",
		deleteQuestionAfter: "? This cannot be undone.",

		editTitle: "Edit category",
		newTitle: "New category",
		nameLabel: "Name",
		namePlaceholder: "e.g. Gym",
		nameRequired: "Enter a name",
		typeLabel: "Type",
		iconLabel: "Icon",
		iconSet: "set — {type}",
		currentIcon: "current",
		saveChanges: "Save changes",
		create: "Create category",

		budgetLabel: "Budget limit",
		optional: "(optional)",
		budgetPlaceholder: "e.g. 250",
		budgetMustBePositive: "The budget limit must be an amount greater than zero",
		budgetHintExisting:
			"Clear the field to remove the limit: past periods stay as they were.",
		budgetHintNew: "Leave empty to set no limit.",
	},

	recurring: {
		emptyTitle: "No recurring payments",
		emptyDescription:
			"Your subscriptions and scheduled payments will show up here as soon as you add one.",
		addAction: "Add recurring",
		count: {
			one: "{n} scheduled payment",
			other: "{n} scheduled payments",
		},
		paused: "paused",
		pause: "pause",
		resume: "resume",
		edit: "edit",
		delete: "delete",
		deleteTitle: "Delete recurring rule",
		deleteBody: "This stops future generations. Transactions already created stay. Continue?",

		editTitle: "Edit recurring rule",
		amount: "Amount",
		category: "Category",
		noCategory: "No category",
		frequency: "Frequency",
		nextDate: "Next date",
		description: "Description",
		descriptionPlaceholder: "Optional",
		saveChanges: "Save changes",
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

		passwordCommon: {
			show: "Show password",
			hide: "Hide password",
			tooShort: "Your password must be at least {min} characters",
			mismatch: "The passwords don't match",
			strength: {
				0: "too short",
				1: "weak",
				2: "medium",
				3: "strong",
			},
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
