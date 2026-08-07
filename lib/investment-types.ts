/**
 * Tipologie di investimento: solo id e colore.
 *
 * ⚠️ Le etichette non stanno più qui (Fase 19): vivono in
 * `t.investmentTypes[id]`. Erano l'ennesimo caso dello stesso schema — un
 * modulo di `lib/` che distribuiva un colore e, accanto, una parola da tradurre.
 *
 * Le chiavi restano italiane perché sono i valori di
 * `transactions.investment_type`, cioè dati.
 */
export const INVESTMENT_TYPE_COLOR: Record<string, string> = {
	etf: "ao",
	azioni: "midori",
	obbligazioni: "murasaki",
	crypto: "kin",
	altro: "kiri",
};

/** Il ripiego quando `investment_type` è NULL o sconosciuto. */
export const INVESTMENT_TYPE_FALLBACK = "altro";
