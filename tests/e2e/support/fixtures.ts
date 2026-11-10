import { test as base, expect, type Page } from "@playwright/test";
import { createTestAccount, deleteUser, type TestAccount } from "./accounts";
import { BASE_URL } from "./env";

/**
 * `account`: un utente di prova nuovo per ogni test, eliminato alla fine anche
 * se il test fallisce. `pageErrors`: un'eccezione non gestita nella pagina fa
 * fallire il test anche se ogni asserzione è verde — la #124 ne ha trovate
 * quattro dietro schermate che sembravano a posto.
 */
// ⚠️ `provide` e non `use`, il nome dei documenti di Playwright: il lint di
// React prende ogni `use(...)` per l'hook omonimo e lo vieta in un try.
export const test = base.extend<{ account: TestAccount; pageErrors: void }>({
	account: async ({ page }, provide) => {
		const account = await createTestAccount();
		try {
			await provide(account);
		} finally {
			await leave(page);
			await deleteUser(account.id);
		}
	},
	pageErrors: [
		async ({ page }, provide) => {
			const errors: string[] = [];
			page.on("pageerror", (e) => errors.push(e.message));
			await provide();
			expect(errors, "eccezioni non gestite nella pagina").toEqual([]);
		},
		{ auto: true },
	],
});

export { expect };

/**
 * La pagina lascia l'app PRIMA che l'utente venga eliminato (code review
 * della #156): una richiesta ancora in volo — un refresh, una revalidazione —
 * troverebbe l'utente sparito, e un'eccezione nella pagina farebbe fallire per
 * `pageErrors` un test il cui corpo era verde. Lo scatto di un fallimento è già
 * stato preso: Playwright lo fa appena finisce il corpo del test.
 */
export async function leave(page: Page) {
	await page.goto("about:blank").catch(() => {});
}

/** Il login dal form vero, come un utente. */
export async function login(page: Page, account: Pick<TestAccount, "email" | "password">) {
	await page.goto("/sign");
	await page.fill('input[name="email"]', account.email);
	await page.fill('input[name="password"]', account.password);
	// Il tab "Accedi" in cima ha lo stesso testo del bottone: si cerca nel form.
	await page.locator("form").getByRole("button", { name: "Accedi" }).click();
	await page.waitForURL((u) => !u.pathname.startsWith("/sign"));
}

/**
 * Apre una pagina e aspetta che si possa guardare: lo splash (`zg-boot-out`,
 * ~900ms) copre la pagina dopo ogni caricamento a freddo. Si dissolve
 * nell'opacità e resta nel DOM, trasparente e `pointer-events-none`.
 */
export async function open(page: Page, path: string) {
	await page.goto(path);
	await page.waitForFunction(() => {
		const s = document.querySelector(".zg-boot-out");
		return !s || getComputedStyle(s).opacity === "0";
	});
}

/**
 * "€ 1.540,70" → 1540.7, "− € 18,50" → −18.5, "€ −18,50" → −18.5.
 * Il segno può stare prima o dopo il simbolo, e il meno può essere quello
 * tipografico (U+2212). `NaN` se nel testo non c'è un importo.
 */
export function money(text: string) {
	const m = text.replace(/\s/g, "").match(/([−-])?€([−-])?([\d.]+(?:,\d{1,2})?)/);
	if (!m) return Number.NaN;
	const n = Number(m[3].replace(/\./g, "").replace(",", "."));
	return m[1] || m[2] ? -n : n;
}

export { BASE_URL };
