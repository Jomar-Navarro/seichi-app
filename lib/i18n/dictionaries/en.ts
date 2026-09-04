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

	// "Seichi" e 整地 restano: sono il nome. Si traduce solo la riga che spiega.
	brand: {
		tagline: "financial clarity",
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
		selectPlaceholder: "Select {field}",
		toggleVisibility: "Show or hide amounts",
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
		disinvestimento: "Divestments",
		abbonamento: "Subscriptions",
		trasferimento: "Transfers",
	},

	typesSingular: {
		entrata: "Income",
		spesa: "Expense",
		risparmio: "Saving",
		investimento: "Investment",
		abbonamento: "Subscription",
		/* No `trasferimento` here, nor in `newByType`/`typesShort`: see it.ts. */
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

	pwa: {
		offlineTitle: "You're offline",
		offlineDescription:
			"Nothing is shown until you're back online: no old numbers passed off as current.",
		offlineBack: "Back to home",
		offlineRetrying: "You're offline — retries on its own once you reconnect",
		updateAvailable: "A new version of Seichi is available",
		updateReload: "Reload",
		installIosTitle: "Add Seichi to your Home Screen",
		installIosHint: "Tap Share, then “Add to Home Screen”.",
	},

	errors: {
		notAuthenticated: "Not signed in",
		nameRequired: "A name is required",
		nameTooLong: "That name is too long",
		invalidType: "Invalid type",
		unsupportedLanguage: "Unsupported language",
		unsupportedCurrency: "Unsupported currency",
		noFileSelected: "No file selected",
		unsupportedFormat: "Unsupported format — use JPG, PNG or WebP",
		enterPassword: "Enter your password",
		amountMustBePositive: "The amount must be greater than zero",
		invalidEmail: "Invalid email address",
		sameEmail: "That's already your current email",
		samePassword: "The new password must be different from the current one",
		wrongCurrentPassword: "Your current password is not correct",
		wrongPassword: "Incorrect password",
		emailMismatch: "That email doesn't match your account",
		avatarRemoveFailed: "Could not remove your profile photo. Please try again.",
		/** ⚠️ Frase propria, non quella dell'avatar — vedi la nota in it.ts. */
		receiptsRemoveFailed:
			"Could not remove your attached receipts. Your account was not deleted: please try again.",
		categoryHasTransactions: {
			one: "This category has {n} linked transaction. Move or delete it before removing the category.",
			other: "This category has {n} linked transactions. Move or delete them before removing the category.",
		},
	},

	auth: {
		tabs: {
			signIn: "Sign in",
			signUp: "Sign up",
		},

		welcome: {
			lead: "Level the ground before you build.",
			leadMuted: "Put your finances in order — calmly, and on purpose.",
			createAccount: "Create your account",
			haveAccount: "Already have an account?",
			signIn: "Sign in",
		},

		signIn: {
			eyebrow: "Welcome back",
			heading: "Sign in to your space.",
			email: "Email",
			password: "Password",
			forgotPassword: "Forgot your password?",
			submit: "Sign in",
			noAccount: "Don't have an account?",
			signUp: "Sign up",
			or: "or",
			passwordReset: "Password updated — sign in with the new one",
		},

		signUp: {
			eyebrow: "Welcome",
			heading: "Create your account.",
			firstName: "First name",
			lastName: "Last name",
			confirmPassword: "Confirm password",
			submit: "Create account",
			consentBefore: "I accept Seichi's ",
			consentTerms: "Terms of service",
			consentMiddle: " and ",
			consentPrivacy: "privacy policy",
			consentAfter: ".",
			requirements: {
				length: "At least {n} characters",
				number: "At least one number",
				lowercase: "At least one lowercase letter",
				uppercase: "At least one uppercase letter",
				special: "At least one special character",
			},
			sentTitle: "Check your email",
			sentBefore: "We've sent a verification link to ",
			sentAfter: ". Open it to activate your account.",
			alreadyVerified: "Already verified?",
		},

		recovery: {
			linkExpired: "That link has expired or is invalid — request a new reset",
			title: "Recover your password",
			intro: "Enter your email and we will send you a link to reset it",
			sentTitle: "Check your email",
			sentDescription:
				"If that address is registered, we've sent you a link to reset your password.",
			backToLogin: "Back to sign in",
			submit: "Send reset link",
			sending: "Sending…",
			newPassword: "New password",
			confirmPassword: "Confirm password",
			reset: "Reset password",
			resetting: "Updating…",
			resetTitle: "Reset password",
		},

		emailConfirmed: {
			title: "Email confirmed",
			description:
				"If Supabase also asked for confirmation from your previous address, the change only takes effect once you've opened both links.",
			backToSettings: "Back to settings",
			failedTitle: "Confirmation failed",
			failedDescription:
				"That link is invalid or has expired. Try changing your email again from settings.",
			goToSettings: "Go to settings",
		},

		codeError: {
			title: "Sign-in failed",
			description: "That authentication link is invalid or has expired. Please try again.",
			backToLogin: "Back to sign in",
		},

		meta: {
			recover: "Recover your password — Seichi",
			reset: "Reset password — Seichi",
			emailConfirmed: "Email confirmed — Seichi",
		},

		errors: {
			wrongCredentials: "Incorrect sign-in details",
			acceptTerms: "You must accept the terms of service",
			passwordTooShort: "Your password must be at least {n} characters",
			passwordMismatch: "The passwords don't match",
		},
	},

	onboarding: {
		firstAccountName: "Main account",
		start: {
			eyebrow: "Welcome",
			heading: "Let's start calmly.",
			lead: "Level the ground before you build.",
			leadMuted: "Put your finances in order — calmly, and on purpose.",
			description:
				"Three short steps to set up your financial space. No rush — you can change everything later.",
			cta: "Start",
		},
		preference: {
			eyebrow: "Preferences",
			headingLine1: "Language",
			headingLine2: "and currency",
			heading: "Language and currency",
			description: "Set your basics. You can change them at any time.",
		},
		category: {
			eyebrow: "Categories",
			headingLine1: "Choose your",
			headingLine2: "categories",
			heading: "Choose your categories",
			description:
				"Pick what you want to keep in order. You can add more later.",
			cta: "Finish setup",
			groups: {
				entrata: "Income",
				spesa: "Expenses",
				risparmio: "Savings",
				investimento: "Investments",
				abbonamento: "Subscriptions",
			},
		},
	},

	// `title` è anche il nome scritto in categories.name: vedi it.ts.
	presetCategories: {
		stipendio: { title: "Salary", subtitle: "Monthly income" },
		freelance: { title: "Freelance", subtitle: "Self-employed work" },
		bonus: { title: "Bonus", subtitle: "Rewards and incentives" },
		regalo: { title: "Gift", subtitle: "Unexpected income" },
		rimborso: { title: "Refund", subtitle: "Reimbursed expenses" },

		alimentari: { title: "Groceries", subtitle: "Food and supermarket" },
		ristoranti: { title: "Restaurants", subtitle: "Bars and eating out" },
		trasporti: { title: "Transport", subtitle: "Car, trains, buses" },
		salute: { title: "Health", subtitle: "Appointments and medicine" },
		abbigliamento: { title: "Clothing", subtitle: "Clothes and accessories" },
		svago: { title: "Leisure", subtitle: "Free time" },
		casa_spesa: { title: "Home", subtitle: "Furniture and upkeep" },

		fondo_emergenza: { title: "Emergency fund", subtitle: "Your safety buffer" },
		vacanze: { title: "Holidays", subtitle: "Trips and stays" },
		obiettivo_casa: { title: "Home goal", subtitle: "Buying or renting" },
		elettronica: { title: "Electronics", subtitle: "Gadgets and devices" },

		etf: { title: "ETF", subtitle: "Index funds" },
		azioni: { title: "Stocks", subtitle: "Equity markets" },
		crypto: { title: "Crypto", subtitle: "Digital assets" },
		fondi: { title: "Funds", subtitle: "Actively managed" },

		streaming: { title: "Streaming", subtitle: "Video on demand" },
		musica: { title: "Music", subtitle: "Audio platforms" },
		palestra: { title: "Gym", subtitle: "Fitness and sport" },
		utenze: { title: "Utilities", subtitle: "Power, gas, internet" },
		affitto: { title: "Rent", subtitle: "Home and spaces" },
	},

	transactionTypes: {
		spesa: { label: "Expense", description: "Everyday spending and purchases" },
		entrata: { label: "Income", description: "Salary, refunds, gifts" },
		risparmio: { label: "Saving", description: "Set-asides and goals" },
		investimento: { label: "Investment", description: "Markets, funds, portfolio" },
		abbonamento: { label: "Recurring", description: "Subscriptions and fixed payments" },
		/** Vedi la nota in it.ts: la descrizione dice anche ciò che il tipo NON è. */
		disinvestimento: {
			label: "Divestment",
			description: "Sell: the capital returns to your account",
		},
		trasferimento: { label: "Transfer", description: "Move money between your accounts" },
	},

	home: {
		greeting: "Welcome back",
		error: "Something went wrong",
		flowTitle: "Flow",
		flowExplain: "money in minus money out this month — not your account balances",
		cards: {
			income: "Income",
			expenses: "Spending",
			investments: "Investments",
			savings: "Savings",
			savingsWithProgress: "Savings · {pct}%",
		},
		analyticsTitle: "Analytics",
		analyticsSubtitle: "Charts and statistics",
		recentTitle: "Recent transactions",
		seeAll: "See all →",
		emptyTitle: "No transactions yet",
		emptyDescription: "Add your first one to get started.",
	},

	accounts: {
		title: "Accounts",
		loadError: "Could not load your accounts.",

		all: "All accounts",
		manage: "Manage accounts",

		fieldLabel: "Account",
		balanceHeading: "Balance",
		activeCount: { one: "{n} active account", other: "{n} active accounts" },
		balanceExplainAll: "the sum of your active accounts — archived ones stay out",
		balanceExplainOne: "what this account holds right now",
		seeDetail: "See your accounts in detail",

		archivedSection: { one: "Archived · {n}", other: "Archived · {n}" },
		archivedNote: "archived · not counted in the balance",
		reactivate: "reactivate",

		types: {
			corrente: "Current",
			contanti: "Cash",
			risparmio: "Savings",
			investimento: "Investment",
		},
		typeless: "Account",

		newTitle: "New account",
		editTitle: "Edit account",
		name: "Account name",
		namePlaceholder: "e.g. Current account, Cash…",
		color: "Colour",
		colors: {
			blue: "Blue",
			green: "Green",
			gold: "Gold",
			purple: "Purple",
			red: "Red",
		},
		type: "Type",
		initialBalance: "Opening balance",
		initialBalanceHint:
			"Where this account starts — it is never counted as income or spending.",
		initialBalanceEditHint:
			"Changing it moves the balance; it creates no income and no spending.",
		save: "Save account",
		saving: "Saving…",

		archive: "Archive",
		archiveConfirm: "Confirm archiving",
		archiveBody:
			"It disappears from the pickers, but its transactions stay and its history remains readable.",

		/** ⚠️ Visible ONLY at zero transactions (issue #62) — see the note in it.ts. */
		deleteConfirm: "Confirm deletion",
		deleteBody:
			"It has no linked transactions: deleting it loses nothing, but — unlike archiving — it cannot be undone.",

		emptyTitle: "No accounts yet",
		emptyDescription: "Add an account to know where your money actually is.",

		errors: {
			nameRequired: "Give the account a name.",
			invalidColor: "That colour is not valid.",
			none: "You need an account before you can record a transaction. Create one from the accounts page.",
			saveFailed: "Could not save the account. Please try again.",
			nameTooLong: "The name can be at most 50 characters.",
			notFound: "Account not found.",
			lastAccount:
				"This is your only active account, and every transaction has to belong to one.",
			hasRecurring: {
				one: "There is {n} active recurring rule on this account. Move it to another account or pause it, then try again.",
				other: "There are {n} active recurring rules on this account. Move them to another account or pause them, then try again.",
			},
			/** ⚠️ Different from `lastAccount`: see the note in it.ts. */
			hasMovements: "This account has linked transactions: it can't be deleted. You can archive it.",
		},
	},

	transactions: {
		title: "Transactions",
		modalNew: "New transaction",
		modalEdit: "Edit transaction",
		modalTypeQuestion: "What kind of transaction do you want to record?",

		form: {
			amount: "Amount",
			category: "Category",
			description: "Description",
			descriptionPlaceholder: "e.g. Trainline, Tesco...",
			date: "Date",
			// "Source/Destination account", not "From/To account": the placeholder is
			// `Select {field}`, so "To account" produced "Select to account". See it.ts.
			fromAccount: "Source account",
			toAccount: "Destination account",
			noDestination: "None",
			destinationHint: "the money really moves to that account, and the goal still moves forward",
			recurringSection: "Recurring",
			repeat: "Repeat",
			saveChanges: "Save changes",
			createRecurring: "Create recurring rule",
			save: "Save transaction",
			deleteConfirm: "Confirm deletion",
			delete: "Delete transaction",
		},
		emptyTitle: "No transactions yet",
		emptyDescription:
			"Your income and spending will show up here as soon as you record your first one.",
		emptyFilteredTitle: "No transactions match these filters",
		emptyFilteredDescription:
			"Try widening the period, or picking a different account or type.",
		addAction: "Add transaction",
		searchPlaceholder: "Search transactions",
		/** ⚠️ Era "All": ambiguo accanto al filtro categoria — vedi la nota in it.ts. */
		filterAll: "All types",
		filterAllCategories: "All categories",
		resetFilters: "Clear filters",
		loadMore: "Load more",
		/** ⚠️ Righe guardate, non risultati trovati — vedi la nota in it.ts. */
		searchScanLimit:
			"Search looked at the {n} most recent transactions in this period. Narrow the period to search further back.",
		periods: {
			"7d": "7 days",
			"30d": "30 days",
			"3m": "3 months",
			tutto: "All time",
		},
	},

	goals: {
		title: "Goals",
		loadError: "Could not load your goals.",
		activeCount: { one: "{n} active", other: "{n} active" },
		completedCount: { one: "{n} completed", other: "{n} completed" },
		new: "New",
		emptyTitle: "No goals yet",
		emptyDescription: "Create your first goal and start setting money aside, calmly.",
		create: "Create goal",
		noDeadline: "No deadline",
		completedSection: "Completed",
		reached: "Reached · {date}",
		deadline: "Due · {date}",
		of: "of",

		editTitle: "Edit goal",
		newTitle: "New goal",
		nameLabel: "Goal name",
		namePlaceholder: "e.g. Trip to Japan",
		nameRequired: "Enter a name",
		targetLabel: "Target amount",
		optional: "(optional)",
		amountInvalid: "Enter a valid amount",
		dateLabel: "Target date",
		iconLabel: "Icon",
		saveChanges: "Save changes",
		deleteConfirm: "Confirm deletion",
		delete: "Delete goal",
	},

	investments: {
		title: "Investments",
		emptyTitle: "No investments yet",
		emptyDescription:
			"Add a transaction of type “{type}” to start tracking your portfolio.",
		positionCount: { one: "{n} active position", other: "{n} active positions" },
		typeCount: { one: "{n} type", other: "{n} types" },
		/** ⚠️ Non è il valore di mercato — vedi la nota estesa in it.ts. */
		portfolioValue: "Capital contributed",
		/** Mostrata quando una posizione è stata liquidata oltre il versato. */
		negativeNote: "you took out more than you put in: the difference is gain",
		vsLastMonth: "vs last month",
		composition: "Composition",
		byTypeTitle: "By asset class",
		total: "Total",
		positions: "Positions",
		invested: "Invested",
		types: {
			etf: "ETF",
			azioni: "Stocks",
			obbligazioni: "Bonds",
			crypto: "Crypto",
			altro: "Other",
		},
	},

	analytics: {
		title: "Analytics",
		lastWeek: "Last week",
		allTime: "All time",
		// "Flow", same word as the home card: it is the same number. See it.ts.
		netFlow: "Flow",
		firstMonth: "— first month",
		tabs: {
			settimana: "Week",
			mese: "Month",
			anno: "Year",
			tutto: "All",
		},
		legendIncome: "Income",
		legendExpenses: "Money out",
		spendingByCategory: "Spending by category",
		spendingLabel: "Expenses",
		noSpending: "No spending {window}",
		windows: {
			settimana: "this week",
			mese: "this month",
			anno: "this year",
			tutto: "ever",
		},

		fixedOutflowsTitle: "Fixed outflows",
		fixedOutflowsHint: "Subscriptions and scheduled payments",

		report: {
			open: "Printable report",
			title: "Report",
			print: "Print",
			generatedOn: "generated on {date}",
			flowExplain: "income minus outgoings for the period — not the balance of your accounts",
			trendTitle: "Trend",
		},
	},

	/** ⚠️ "Receipts" per chi legge, "attachment" nel codice — vedi la nota in it.ts. */
	attachments: {
		title: "Receipts",
		add: "Add receipt",
		hint: "JPG, PNG or WebP · {max} MB max",
		count: { one: "{n} receipt", other: "{n} receipts" },
		remove: "Remove",
		open: "Open full screen",
		uploading: "Uploading…",
		missing: "File unavailable",
		errors: {
			tooLarge: "That image is over {max} MB. Pick a lighter one.",
			notSaved: "Could not attach the receipt to this transaction.",
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
		/** ⚠️ Vedi it.ts: una scrittura fallita deve dirlo quanto una lettura. */
		saveFailed: "Could not save your budget: {reason}",

		/** ⚠️ Mai "salary": vedi la nota in it.ts. Sono TUTTE le entrate del mese. */
		available: "Available",
		availableHint: "This month's income minus fixed outflows",
		/** ⚠️ Vedi it.ts: nei primi giorni del mese è il caso normale, non un guasto. */
		availableNoIncome: "No income recorded this month",
		useAvailable: "Set the limit to {amount}",
		useAvailableHint: "What's left after fixed outflows — a ceiling, not advice",

		sectionTitle: "Budget",
		variableExpenses: "Variable spending",
		/** ⚠️ "fixed OUTFLOWS": vedi la nota in it.ts — "fixed" da solo non dice cosa. */
		fixedThisMonth: "fixed outflows this month {amount}",
		acrossAllAccounts: "budgets count every account, not just the one you filtered",
	},

	/** Il coach (Fase 24b). Vedi la nota in it.ts: qui è tutta cornice. */
	coach: {
		bubbleLabel: "Open the coach",
		title: "Coach",
		subtitle: "What your numbers say",
		close: "Close",
		loading: "Looking at your numbers…",
		readFailed: "I can't read your numbers: {reason}",
		hint: "Tap a question",
		/** ⚠️ Vedi it.ts: compare solo con un filtro conto attivo sulla home. */
		acrossAccounts: "These numbers cover every account, not just the one you selected.",
		opening: {
			available:
				"This month you took in {income} and have {fixed} of expected fixed outflows: {available} is left for variable spending.",
			alreadySpent: "You have already spent {spent} on variable expenses.",
			availableNoIncome:
				"No income recorded this month yet, while {fixed} of fixed outflows are expected. The picture clears up once the first one lands.",
			/** ⚠️ Percentuale fra parentesi per simmetria con it.ts, dove l'articolo
			 *  davanti a una cifra variabile si rompe da solo. Qui non servirebbe —
			 *  ed è precisamente il motivo per cui il difetto si vede solo in
			 *  italiano. */
			savingsRate:
				"Between savings and investments you are setting aside {amount} out of {income} that came in ({pct}%).",
			savingsRateNone:
				"You have not set anything aside this month yet, in savings or investments.",
			/** ⚠️ Vedi it.ts: «so far» contro «all of last month» dichiara che il
			 *  confronto mette un mese parziale accanto a uno intero. */
			flowSoFar: "So far this month's flow is {flow}, against {previous} for all of last month.",
		},
		questions: {
			available: "What have I got left?",
			budget: "How are my budgets doing?",
			goals: "Where are my goals?",
			fixed: "How much do fixed outflows weigh?",
		},
		answers: {
			available:
				"Income {income} minus expected fixed outflows {fixed}: {available} left. You have already spent {spent} on variable expenses.",
			availableNoIncome:
				"With no income recorded there is nothing to work out yet: so far there are only {fixed} of expected fixed outflows.",
			budgetNone:
				"You have not set any limit. The global one lives in settings, the per-category ones in the category form.",
			budgetGlobal: "On the global limit you have spent {spent} of {amount}.",
			budgetOver: "You have gone over the limit on: {names}.",
			budgetNear: "You are getting close to the limit on: {names}.",
			budgetOk: "No category is near its limit.",
			goalsNone: "You have no active savings goals.",
			goalsNoTarget: "Your goals have no target set: you have {amount} put aside.",
			goalsAllDone: "You have reached all of your goals.",
			goalsClosest: "The closest is {name}: {saved} of {target}, {missing} to go.",
			fixed:
				"Expected fixed outflows are {fixed} out of {income} that came in this month ({pct}%).",
			fixedNoIncome:
				"Expected fixed outflows are {fixed}. With no income recorded, saying what share they are would mean nothing.",
		},
	},

	jobHealth: {
		recurring: {
			rowLabel: "Automations stopped",
			title: "Recurring transactions are not being recorded",
			hint: "Scheduled transactions may be missing and your totals incomplete. You can add them manually in the meantime.",
		},
		notifications: {
			rowLabel: "Alerts out of date",
			title: "Some alerts may be missing",
			hint: "Your transactions are recorded correctly — it is the budget and goal alerts that were not generated.",
		},
		lastOk: "Last successful check: {when}.",
		never: "No run has been recorded.",
		withError: "The last run ended with an error.",
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

	profileMenu: {
		settings: "Settings",
		signOut: "Sign out",
		darkMode: "Dark mode",
	},

	notifications: {
		loading: "Loading…",
		empty: "No notifications",
		justNow: "just now",
		title: "Notifications",
		markAllRead: "mark all as read",
		emptyDescription: "Alerts about budgets, goals and upcoming renewals show up here.",
		messages: {
			budgetExceeded: 'Budget "{category}" exceeded',
			budgetNearLimit: 'Budget "{category}" almost used up',
			globalExceeded: "Variable spending limit exceeded",
			globalNearLimit: "Variable spending limit almost reached",
			spentOf: "You've spent {spent} of {amount}",

			goalReached: 'Goal "{goal}" reached',
			goalHalfway: 'Goal "{goal}" halfway there',
			savedOf: "You've set aside {saved} of {target}",

			renewal: 'Renewal "{name}" {when}',
			renewalFallbackName: "subscription",
			renewalAmount: "{amount} due",

			recurringGenerated: {
				one: "{n} recurring transaction recorded",
				other: "{n} recurring transactions recorded",
			},

			fallback: "Notification",
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
			data: "Data",
			security: "Security",
			support: "Support",
			dangerZone: "Danger zone",
		},

		importData: "Import transactions",
		exportData: "Export transactions",
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

	import: {
		title: "Import transactions",

		file: {
			drop: "Drag a CSV file",
			or: "or tap to choose one",
			hint: ".csv file with date, amount and description · 2 MB max",
			change: "Change file",
			accountLabel: "Statement account",
			accountHint: "which account this file belongs to",
			noAccounts: "You need at least one active account to import.",
			continue: "Continue",

			recognised: "{source} · {n}",
			sources: {
				trade_republic: "Trade Republic statement",
				generico: "Generic CSV",
			},
			brokerHint:
				"This is your Trade Republic statement: pick the account that stands for it, or create one. Not the account you transfer from.",

			newAccount: "New account",
			newAccountName: "Account name",
			create: "Create",
		},

		history: {
			title: "Previous imports",
			rows: { one: "{n} movement", other: "{n} movements" },
		},

		mapping: {
			title: "Which columns to use",
			hint: "The format wasn't recognised: point out where the date and amount are.",
			date: "Date",
			amount: "Amount",
			description: "Description",
			none: "none",
		},

		preview: {
			found: { one: "{n} movement found", other: "{n} movements found" },
			explain: "Decide by group: one choice applies to every row it contains.",
			rows: { one: "{n} row", other: "{n} rows" },
			more: { one: "+ {n} more row", other: "+ {n} more rows" },
			undecided: { one: "{n} group to decide", other: "{n} groups to decide" },
			becomes: "Movement type",
			category: "Category",
			noCategory: "none",
			counterpart: "Source account",
			counterpartOut: "Destination account",
			noDetail: "counterparty not stated",
			showRows: "Show rows",
			hideRows: "Hide rows",
			continue: "Continue",
		},

		groups: {
			acquisti: "Purchases and savings plans",
			vendite: "Sales",
			interessi: "Interest",
			dividendi: "Dividends",
			regalo: "Gifted shares",
			carta: "Card payments",
			imposte: "Taxes and duties",
			trasferimentoIn: "Money received",
			trasferimentoOut: "Money sent",
			senzaCassa: "Rows with no money movement",
			movimenti: "Movements",
			altro: "Unrecognised",
		},

		notes: {
			vendite:
				"They become divestments: the capital returns to the account without counting as income. As income they would inflate this month's flow.",
			senzaCassa:
				"Securities transfers and free receipts: no money moves, so they don't become transactions.",
			trasferimento: "Pick the other account, or the app can't tell where the money came from.",
			altro: "Unknown movement type: you decide what it becomes.",
		},

		targets: {
			ignora: "Don't import",
		},

		summary: {
			toImport: { one: "{n} movement to import", other: "{n} movements to import" },
			ignored: { one: "{n} row ignored", other: "{n} rows ignored" },
			unreadable: { one: "{n} unreadable row", other: "{n} unreadable rows" },
			confirm: "Import",
			importing: "Importing…",
		},

		done: {
			title: "Import complete",
			imported: { one: "{n} movement imported", other: "{n} movements imported" },
			skipped: { one: "{n} already there", other: "{n} already there" },
			nothing: "No new movements: they had all been imported already.",
			undo: "Undo the import",
			undoTitle: "Undo this import?",
			undoBody:
				"The movements written by this import will be deleted, including any edits made by hand afterwards.",
			undoConfirm: "Undo the import",
			undoCancel: "Keep",
			backToSettings: "Back to settings",
		},

		errors: {
			tooLarge: "The file is too large — 2 MB max",
			notCsv: "A .csv file is required",
			empty: "No readable movements in this file",
			unknownFormat: "Format not recognised",
			noAccount: "Choose the account this file belongs to",
			undecided: "Decide what to do with every group",
			badDecisions: "Invalid choices",
			transferNeedsAccount: "Pick the other account of the transfer",
			sameAccount: "The source and destination accounts must be different",
			badCategory: "The category doesn't match the chosen type",
			nothingToImport: "Nothing left to import",
		},
	},

	export: {
		title: "Export transactions",
		intro: "Download your movements as a CSV file, to open in Excel or a spreadsheet.",
		notBackup:
			"This is not a backup: receipts are left out, and to put data back into Seichi you go through Import transactions.",
		filters: "What to export",
		fields: {
			period: "Period",
			type: "Type",
			account: "Account",
			category: "Category",
		},
		download: "Download the CSV file",
		nothing: "There are no movements to export yet.",

		columns: {
			date: "Date",
			type: "Type",
			category: "Category",
			account: "Account",
			toAccount: "Destination account",
			amount: "Amount",
			notes: "Notes",
			attachments: "Receipts",
		},

		errors: {
			badFilter: "Invalid filter: go back and try again.",
			failed: "The file could not be prepared. Please try again.",
		},
	},
};
