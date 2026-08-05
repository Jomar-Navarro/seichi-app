export const TIPO_COLOR: Record<string, string> = {
	entrata:      "var(--color-midori)",
	spesa:        "var(--color-aka)",
	risparmio:    "var(--color-kin)",
	investimento: "var(--color-ao)",
	abbonamento:  "var(--color-murasaki)",
};

/**
 * Gli stessi ruoli di TIPO_COLOR, ma per il TESTO.
 *
 * TIPO_COLOR resta per riempimenti, pastiglie e icone, dove l'accento pieno
 * serve a risaltare. Per gli importi serve invece leggibilità: in tema chiaro
 * gli accenti stanno sotto la soglia WCAG AA, e "spesa" e "risparmio"
 * (#b47358 e #ae8b49) sono per giunta quasi lo stesso marrone — proprio i due
 * numeri che non devono mai essere confusi.
 */
export const TIPO_INK: Record<string, string> = {
	entrata:      "var(--ink-midori)",
	spesa:        "var(--ink-aka)",
	risparmio:    "var(--ink-kin)",
	investimento: "var(--ink-ao)",
	abbonamento:  "var(--ink-murasaki)",
};

export const TIPO_LABEL: Record<string, string> = {
	entrata:      "Entrate",
	spesa:        "Uscite",
	risparmio:    "Risparmi",
	investimento: "Investimenti",
	abbonamento:  "Abbonamenti",
};

export const numberFormatter = new Intl.NumberFormat("it-IT", {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export function formatDate(iso: string) {
	// Le stringhe date-only "YYYY-MM-DD" (es. recurring_rules.next_run) vanno
	// costruite come data locale: `new Date("2026-08-15")` sarebbe mezzanotte
	// UTC e slitterebbe al giorno prima nei fusi negativi.
	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
	const date = dateOnly
		? new Date(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3])
		: new Date(iso);
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);
	if (date.toDateString() === today.toDateString()) return "Oggi";
	if (date.toDateString() === yesterday.toDateString()) return "Ieri";
	return date.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
}

export function formatAmount(amount: number, type: string) {
	const abs = numberFormatter.format(Math.abs(amount));
	const sign = type === "entrata" ? "+ " : "− ";
	return `${sign}€ ${abs}`;
}
