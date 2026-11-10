import type { Locator, Page } from "@playwright/test";
import { money } from "./fixtures";

/**
 * I gesti che più scenari ripetono, scritti una volta: se l'interfaccia
 * cambia, si corregge qui e non in dieci test che divergono.
 */

/** Il modale del movimento, aperto dal FAB e portato oltre il passo dell'importo. */
export async function newMovement(page: Page, typeLabel: string, amount: string) {
	await page.locator(".fab").first().click();
	await page.getByRole("button", { name: new RegExp(`^${typeLabel}`) }).first().click();
	// Il passo dell'importo legge anche la tastiera fisica (28d): niente tasti
	// a schermo da cercare, ed è lo stesso gesto di chi lo usa dal computer.
	await page.keyboard.type(amount);
	await page.getByRole("button", { name: "Continua" }).filter({ visible: true }).first().click();
}

/**
 * Il bottone di un `Select` compatto, trovato dalla sua ETICHETTA («Conto»,
 * «Conto di arrivo»): porta il valore scelto o il segnaposto, e la tendina è
 * sua sorella nello stesso contenitore.
 */
export function field(scope: Page | Locator, label: string) {
	return scope.getByText(label, { exact: true }).filter({ visible: true }).first().locator("..").getByRole("button").first();
}

/** Una scelta in un `Select` compatto, nella pagina o dentro una card. */
export async function choose(scope: Page | Locator, label: string, option: string) {
	const trigger = field(scope, label);
	await trigger.click();
	await trigger.locator("..").locator("div.absolute").getByRole("button", { name: option, exact: true }).click();
}

/**
 * La cifra del Flusso in home: quella colorata (inchiostro verde o rosso) del
 * carosello. Il saldo accanto è neutro di proposito (20a), quindi non può
 * essere lui.
 */
export async function homeFlow(page: Page) {
	const text = await page.locator("div.snap-x p.text-midori-ink, div.snap-x p.text-aka-ink").first().innerText();
	return money(text);
}

/** La cifra del KPI «Flusso» di /analisi: il testo del contenitore dell'etichetta. */
export async function analisiFlow(page: Page) {
	const text = await page.getByText(/^Flusso$/).filter({ visible: true }).first().locator("..").innerText();
	return money(text);
}
