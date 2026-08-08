/**
 * Libreria icone per il picker "Nuova categoria", divisa per tipo.
 *
 * Solo gli ID (chiavi di `ICON_MAP`), nell'ordine in cui vanno mostrati. Le
 * ETICHETTE stanno in `t.iconLabels[tipo][id]` dalla Fase 19.
 *
 * ⚠️ Le etichette sono annidate per TIPO, non una mappa piatta `id → etichetta`,
 * e non è una comodità: nove icone hanno nomi diversi a seconda del tipo.
 * `Landmark` è "Bonifico" fra le entrate ma "Azioni" fra gli investimenti;
 * `Home` è "Casa / Affitto" fra le spese e "Casa nuova" fra i risparmi. Appiattire
 * avrebbe mostrato l'etichetta di un altro contesto senza alcun errore visibile —
 * il picker degli investimenti che propone "Bonifico".
 */
export const CATEGORY_LIBRARY: Record<string, string[]> = {
	entrata: [
		"Briefcase",
		"Banknote",
		"Landmark",
		"Award",
		"Gift",
		"Coins",
		"TrendingUp",
		"ArrowDownToLine",
		"HandCoins",
		"Percent",
		"Handshake",
		"CircleDollarSign",
	],
	spesa: [
		"ShoppingCart",
		"ShoppingBasket",
		"Utensils",
		"Car",
		"Home",
		"Zap",
		"Shirt",
		"HeartPulse",
		"GraduationCap",
		"Wifi",
		"Fuel",
		"Baby",
		"PawPrint",
		"Coffee",
		"Wrench",
		"Stethoscope",
	],
	investimento: [
		"TrendingUp",
		"LineChart",
		"Landmark",
		"Bitcoin",
		"Building2",
		"PieChart",
		"Layers",
		"Coins",
		"BarChart3",
		"Vault",
		"Globe",
		"Percent",
		"CircleDollarSign",
	],
	risparmio: [
		"PiggyBank",
		"Shield",
		"Plane",
		"Home",
		"GraduationCap",
		"Heart",
		"Gem",
		"Target",
		"Baby",
		"Car",
		"Umbrella",
		"Sunrise",
		"Sparkles",
	],
	abbonamento: [
		"Repeat",
		"Tv",
		"Music",
		"Smartphone",
		"Cloud",
		"Newspaper",
		"Dumbbell",
		"Wifi",
		"Gamepad2",
		"BookOpen",
		"Mail",
		"CreditCard",
		"Radio",
		"Headphones",
	],
};
