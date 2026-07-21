export const TIPO_COLOR: Record<string, string> = {
	entrata:      "var(--color-midori)",
	spesa:        "var(--color-aka)",
	risparmio:    "var(--color-kin)",
	investimento: "var(--color-ao)",
	abbonamento:  "var(--color-murasaki)",
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

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);

export function formatDate(iso: string) {
	const date = new Date(iso);
	if (date.toDateString() === today.toDateString()) return "Oggi";
	if (date.toDateString() === yesterday.toDateString()) return "Ieri";
	return date.toLocaleDateString("it-IT", { day: "numeric", month: "long" });
}

export function formatAmount(amount: number, type: string) {
	const abs = numberFormatter.format(Math.abs(amount));
	const sign = type === "entrata" ? "+ " : "− ";
	return `${sign}€ ${abs}`;
}
