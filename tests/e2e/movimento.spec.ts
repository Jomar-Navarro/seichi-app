import { randomUUID } from "node:crypto";
import { choose, field, newMovement } from "./support/app";
import { expect, leave, login, open, test } from "./support/fixtures";
import { openHeld } from "./support/hold";
import { insertMovements, seedBasic } from "./support/seed";

/**
 * Il nuovo movimento propone il conto che la pagina sta guardando (#112).
 *
 * ⚠️ Il difetto che custodisce: con Revolut scelto in home, «Nuovo movimento»
 * proponeva il primo conto attivo, e dimenticarsi di cambiarlo scriveva il
 * movimento sul conto sbagliato. Il modale sta nel layout e non sa quale
 * pagina c'è sotto: glielo dice `viewedAccountId`.
 *
 * Controprova: nel form ignorare `viewedAccountId` e proporre il primo attivo.
 */
test("il nuovo movimento propone il conto guardato", async ({ page, account }) => {
	const s = await seedBasic(account);
	await login(page, account);

	await open(page, `/?conto=${s.accounts.revolut}`);
	await newMovement(page, "Uscita", "12");
	await expect(field(page, "Conto")).toHaveText("Revolut");

	// Movimenti filtrata su Revolut dichiara anche lei il proprio conto.
	await open(page, `/transazioni?conto=${s.accounts.revolut}`);
	await newMovement(page, "Uscita", "12");
	await expect(field(page, "Conto")).toHaveText("Revolut");

	// «Tutti i conti»: nessun conto guardato, si propone il primo attivo.
	await open(page, "/?conto=");
	await newMovement(page, "Uscita", "12");
	await expect(field(page, "Conto")).toHaveText("Conto principale");
});

/**
 * Il + toccato mentre si vede lo scheletro propone il conto guardato (#217).
 *
 * ⚠️ Il difetto che custodisce: la home dichiarava il conto in fondo al suo
 * contenuto, dentro il Suspense. Per tutto lo scheletro il + apriva un form
 * che non trovava la dichiarazione e proponeva il primo attivo, e quella
 * arrivata dopo non lo correggeva. Lo scenario qui sopra lo prendeva solo col
 * server carico (#165); qui lo scheletro lo tiene fermo `openHeld`, apposta.
 *
 * `/analisi` e `/investimenti` oggi arrivano intere: nessun Suspense né
 * `loading.tsx` sopra la dichiarazione, che sta nell'involucro (il proxy al
 * più trattiene il piede della sidebar, vedi `hold.ts`). Il controllo
 * custodisce il giorno in cui uno dei due comparisse.
 *
 * Un id nell'URL che non è dell'utente: la home lo dichiara prima di
 * scartarlo, e il form non deve proporlo mai.
 *
 * Controprove: (1) rimettere `<ViewedAccount>` in fondo a `DashboardContent`
 * → la home propone «Conto principale»; (2) un `loading.tsx` in `/analisi`
 * → lo stesso su `/analisi`; (3) nel form proporre `viewedAccountId` senza
 * cercarlo fra i conti letti → l'id inventato lascia il campo senza un conto.
 */
test("il + durante lo scheletro propone il conto guardato", async ({ page, account }) => {
	const s = await seedBasic(account);
	await login(page, account);

	const cases = [
		{ path: `/?conto=${s.accounts.revolut}`, skeleton: true, expected: "Revolut" },
		{ path: `/?conto=${randomUUID()}`, skeleton: true, expected: "Conto principale" },
		{ path: `/analisi?conto=${s.accounts.revolut}`, skeleton: false, expected: "Revolut" },
		{ path: `/investimenti?conto=${s.accounts.revolut}`, skeleton: false, expected: "Revolut" },
	];
	for (const c of cases) {
		const held = await openHeld(page, c.path);
		try {
			if (c.skeleton) {
				await held.holding;
				// Lo scheletro della home, e niente ancora del contenuto vero.
				await expect(page.locator(".zg-pulse").filter({ visible: true }).first()).toBeVisible();
				await expect(page.getByText("Transazioni recenti")).toHaveCount(0);
			}
			await newMovement(page, "Uscita", "12");
			// `soft`: un giro dice quali pagine sbagliano, non solo la prima.
			await expect.soft(field(page, "Conto"), c.path).toHaveText(c.expected);
		} finally {
			await leave(page);
			await held.close();
		}
	}
});

/**
 * Tornare indietro nel wizard non perde ciò che si è scritto, e un salvataggio
 * scrive UNA riga (#122).
 *
 * ⚠️ Il difetto che custodisce: il tasto «indietro» smontava il form.
 * Categoria, descrizione, conto e foto in coda sparivano senza avviso.
 *
 * Controprova: montare il form solo quando il passo è «form».
 */
test("indietro nel wizard non perde i campi", async ({ page, account }) => {
	const s = await seedBasic(account);
	await login(page, account);
	await open(page, "/?conto=");

	await newMovement(page, "Uscita", "25");
	await choose(page, "Categoria", "Ristoranti");
	await page.getByPlaceholder(/^Es. Trenord/).fill("pranzo di lavoro");

	// Indietro all'importo, poi alla griglia dei tipi, e di nuovo avanti.
	const back = page.locator("button:has(svg.lucide-chevron-left)").filter({ visible: true }).first();
	await back.click();
	await back.click();
	await page.getByRole("button", { name: /^Uscita/ }).first().click();
	await page.getByRole("button", { name: "Continua" }).filter({ visible: true }).first().click();

	await expect(field(page, "Categoria")).toHaveText("Ristoranti");
	await expect(page.getByPlaceholder(/^Es. Trenord/)).toHaveValue("pranzo di lavoro");
	await page.getByRole("button", { name: "Salva movimento" }).click();
	await expect(page.getByRole("button", { name: "Salva movimento" })).toHaveCount(0);

	const rows = await account.rest<{ amount: number; category_id: string; notes: string; type: string }[]>(
		"GET",
		"transactions?select=amount,category_id,notes,type",
	);
	expect(rows).toEqual([{ amount: 25, category_id: s.cat("Ristoranti"), notes: "pranzo di lavoro", type: "spesa" }]);
});

/**
 * La ricerca trova anche col testo che il telefono lascia in coda (#122).
 *
 * ⚠️ Il difetto che custodisce: «Revolut » — con lo spazio che il suggerimento
 * della tastiera di iOS aggiunge — non trovava niente, perché l'ago non veniva
 * ripulito. La ricerca guarda anche il nome del conto, che sta su un'altra
 * tabella: è proprio il caso in cui si cerca per conto.
 *
 * Controprova: cercare senza togliere gli spazi dall'ago.
 */
test("la ricerca ignora gli spazi in coda", async ({ page, account }) => {
	const s = await seedBasic(account);
	await insertMovements(account, [
		{ type: "spesa", amount: 4.5, account_id: s.accounts.revolut, category_id: s.cat("Ristoranti"), notes: "caffè al banco" },
		{ type: "spesa", amount: 3, account_id: s.accounts.principale, category_id: s.cat("Alimentari"), notes: "pane" },
	]);
	await login(page, account);
	await open(page, "/transazioni?conto=");
	await expect(page.getByText("pane").filter({ visible: true })).toBeVisible();

	await page.getByPlaceholder("Cerca movimenti").fill("Revolut ");
	await expect(page.getByText("caffè al banco").filter({ visible: true })).toBeVisible();
	await expect(page.getByText("pane", { exact: true })).toHaveCount(0);
});

/**
 * Eliminare un movimento si fa dal fondo del pannello, accanto a «Salva
 * modifiche» (#224, chiesto da Jomar).
 *
 * ⚠️ Il difetto che custodisce: «Elimina movimento» stava in fondo al
 * contenuto che scorre, staccato dal gesto con cui si chiude il pannello, e
 * su un movimento con le ricevute andava cercato sotto la piega. Ora sta nella
 * riga fissa del fondo, sempre sullo schermo; il primo tocco chiede conferma
 * nella stessa riga, e «Annulla» la ritira senza toccare niente.
 *
 * Nessun altro scenario elimina un movimento: questo è anche il collaudo del
 * gesto in sé.
 *
 * Controprova: rimettere il cestino in fondo al contenuto che scorre (fuori
 * dalla riga fissa): cade «sta nella riga del fondo, accanto al salvataggio».
 */
test("il cestino sta accanto a «Salva modifiche», chiede conferma ed elimina", async ({ page, account }) => {
	const s = await seedBasic(account);
	await insertMovements(account, [
		{ type: "spesa", amount: 23, account_id: s.accounts.principale, category_id: s.cat("Ristoranti") },
		{ type: "spesa", amount: 7, account_id: s.accounts.principale, category_id: s.cat("Alimentari") },
	]);
	await login(page, account);
	await open(page, "/?conto=");

	await page.getByRole("button", { name: /Ristoranti/ }).first().click();
	const movement = page.getByRole("dialog", { name: "Modifica movimento" });
	await movement.getByRole("button", { name: "Continua" }).click();

	const trash = movement.getByRole("button", { name: "Elimina movimento" });
	const save = movement.getByRole("button", { name: "Salva modifiche" });
	await expect(trash).toBeInViewport();
	await expect(save).toBeInViewport();
	// Sta nella riga del fondo, accanto al salvataggio: stesso genitore, stessa
	// altezza sullo schermo.
	const [t, v] = [await trash.boundingBox(), await save.boundingBox()];
	expect(t && v && Math.abs(t.y - v.y) < 2 && t.x < v.x, "sta nella riga del fondo, accanto al salvataggio").toBe(true);

	// «Annulla» ritira la conferma senza toccare niente.
	await trash.click();
	await movement.getByRole("button", { name: "Annulla" }).click();
	await expect(save).toBeVisible();
	expect(await account.rest<unknown[]>("GET", "transactions?select=id")).toHaveLength(2);

	await trash.click();
	await movement.getByRole("button", { name: "Conferma eliminazione" }).click();
	await expect(movement).toHaveCount(0);
	const left = await account.rest<{ amount: number }[]>("GET", "transactions?select=amount");
	expect(left.map((r) => Number(r.amount))).toEqual([7]);
});
