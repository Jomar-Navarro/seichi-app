import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseCsv } from "../../lib/import/csv";
import type { TestAccount } from "./support/accounts";
import { localSupabase } from "./support/env";
import { BASE_URL, expect, login, open, test } from "./support/fixtures";
import { insertMovements, seedBasic, todayNoon } from "./support/seed";
import { readZip } from "./support/zip";

/**
 * L'archivio completo (#162), scaricato dalla pagina vera e riletto da DUE
 * lettori indipendenti dallo scrittore: `readZip()` dei test e `unzip -t`.
 *
 * ⚠️ Il difetto che custodisce è quello di cui l'export ha già pagato il
 * prezzo (23a, #124): un file salvato che afferma il falso. Qui la forma più
 * probabile è una ricevuta che non si scarica e sparisce in silenzio — un
 * archivio «completo» con un buco che nessuno dichiara. Una ricevuta resta
 * nel database e viene tolta dal bucket: l'archivio deve consegnare l'altra e
 * DIRE quale manca, in `manifest.json`, in `LEGGIMI.txt` e con `file: null`.
 *
 * Controprove (fatte, #162):
 *   - nella rotta, una ricevuta non scaricata che diventa una voce vuota invece
 *     di essere dichiarata: il test cade su `missing` e sulle voci;
 *   - senza `consumeRateLimit(…, "archive")` la quarta richiesta passa: cade su
 *     «atteso 429» (oggi «atteso 303»: il rinvio con il codice è venuto dopo,
 *     dalla review, e questa controprova va ripetuta sul codice nuovo).
 */
const PNG_1X1 = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64",
);

/** Un file nel bucket delle ricevute, col token dell'utente (sotto le policy). */
async function storage(a: TestAccount, method: "POST" | "DELETE", path: string, body?: Buffer) {
	const sb = localSupabase();
	const res = await fetch(`${sb.url}/storage/v1/object/receipts/${path}`, {
		method,
		headers: {
			apikey: sb.publishableKey,
			Authorization: `Bearer ${a.token}`,
			...(body ? { "Content-Type": "image/png" } : {}),
		},
		body: body ? new Blob([new Uint8Array(body)]) : undefined,
	});
	if (!res.ok) throw new Error(`${method} receipts/${path} → ${res.status} ${await res.text()}`);
}

test("l'archivio contiene ogni tabella e dichiara la ricevuta che manca", async ({ page, account, playwright }) => {
	const s = await seedBasic(account);
	const { principale, revolut } = s.accounts;
	const [spesa] = await insertMovements(account, [
		{ type: "spesa", amount: 12.5, account_id: principale, category_id: s.cat("Alimentari"), notes: "=1+1", date: todayNoon(2) },
		{ type: "trasferimento", amount: 400, account_id: principale, to_account_id: revolut },
		{ type: "entrata", amount: 2000, account_id: principale, category_id: s.cat("Stipendio") },
	]);
	await account.rest("POST", "budgets", { user_id: account.id, category_id: null, period: "mensile", amount: 800, valid_from: "2026-01-01" });

	// Due ricevute sulla spesa; la seconda poi sparisce dal bucket.
	const paths = [`${account.id}/${randomUUID()}.png`, `${account.id}/${randomUUID()}.png`];
	try {
		for (const p of paths) await storage(account, "POST", p, PNG_1X1);
		const [kept, lost] = await account.rest<{ id: string }[]>(
			"POST",
			"attachments",
			paths.map((p) => ({
				user_id: account.id,
				transaction_id: spesa.id,
				storage_path: p,
				mime_type: "image/png",
				size_bytes: PNG_1X1.length,
			})),
		);
		await storage(account, "DELETE", paths[1]);

		await login(page, account);
		await open(page, "/impostazioni/esporta");
		await expect(page.getByText("Include 2 ricevute: con molte foto può volerci un po'.")).toBeVisible();

		const [download] = await Promise.all([
			page.waitForEvent("download"),
			page.getByRole("link", { name: "Scarica l'archivio" }).click(),
		]);
		expect(download.suggestedFilename()).toMatch(/^seichi-archivio-\d{4}-\d{2}-\d{2}\.zip$/);
		const file = (await download.path())!;

		// Il secondo lettore, quello di sistema: un archivio che solo il nostro
		// lettore sa aprire non è un archivio.
		expect(execFileSync("unzip", ["-t", file], { encoding: "utf8" })).toMatch(/No errors detected/);

		const entries = readZip(readFileSync(file));
		const byName = new Map(entries.map((e) => [e.name, e.data]));
		const json = <T>(name: string) => JSON.parse(byName.get(name)!.toString("utf8")) as T;
		const receiptDate = todayNoon(2).slice(0, 10);

		expect(entries.map((e) => e.name).sort()).toEqual(
			[
				"LEGGIMI.txt",
				"manifest.json",
				"movimenti.csv",
				`ricevute/${receiptDate}_${kept.id}.png`,
				...["profile", "accounts", "categories", "transactions", "recurring_rules", "budgets", "notifications", "imports", "attachments"].map(
					(t) => `data/${t}.json`,
				),
			].sort(),
		);
		expect(Buffer.compare(byName.get(`ricevute/${receiptDate}_${kept.id}.png`)!, PNG_1X1)).toBe(0);

		// Ogni tabella: le righe del database, una per una, senza `user_id`.
		for (const table of ["accounts", "categories", "transactions", "budgets", "attachments"]) {
			const db = await account.rest<{ id: string }[]>("GET", `${table}?select=id&order=id`);
			const rows = json<Record<string, unknown>[]>(`data/${table}.json`);
			expect(rows.map((r) => r.id).sort(), table).toEqual(db.map((r) => r.id).sort());
			expect(rows.every((r) => !("user_id" in r)), `${table} senza user_id`).toBe(true);
			expect(rows.length, table).toBeGreaterThan(0);
		}
		const profile = json<{ email: string; currency: string; sign_in_methods: string[] }>("data/profile.json");
		expect(profile).toMatchObject({ email: account.email, currency: "EUR", sign_in_methods: ["email"] });

		// La ricevuta che manca è DICHIARATA, in tre posti.
		const attachments = json<{ id: string; file: string | null; storage_path?: string }[]>("data/attachments.json");
		expect(attachments.find((a) => a.id === kept.id)!.file).toBe(`ricevute/${receiptDate}_${kept.id}.png`);
		expect(attachments.find((a) => a.id === lost.id)!.file).toBeNull();
		expect(attachments.every((a) => !("storage_path" in a))).toBe(true);
		const manifest = json<{ receipts: { expected: number; included: number; missing: string[] }; rows: Record<string, number> }>(
			"manifest.json",
		);
		expect(manifest.receipts).toEqual({ expected: 2, included: 1, missing: [lost.id] });
		expect(manifest.rows.transactions).toBe(3);
		const readme = byName.get("LEGGIMI.txt")!.toString("utf8");
		expect(readme).toContain("1 ricevuta non si è potuta scaricare");
		expect(readme).toContain(`- ${lost.id}`);

		// Il CSV è quello dell'export: stesse colonne, la formula disinnescata, il
		// numero di ricevute dal database (2, anche se una non è nell'archivio).
		const [header, ...rows] = parseCsv(byName.get("movimenti.csv")!.toString("utf8"));
		expect(header).toEqual(["Data", "Tipo", "Categoria", "Conto", "Conto di arrivo", "Importo", "Note", "Ricevute"]);
		expect(rows).toHaveLength(3);
		expect(rows.find((r) => r[6] === "'=1+1")![7]).toBe("2");

		// Le intestazioni, dalla seconda richiesta: la seconda e la terza della
		// giornata passano, la quarta no (3 ogni 24 ore).
		const url = `${BASE_URL}/impostazioni/esporta/archivio`;
		const second = await page.request.get(url);
		expect(second.status()).toBe(200);
		expect(second.headers()["content-type"]).toBe("application/zip");
		expect(second.headers()["cache-control"]).toBe("private, no-store");
		expect(second.headers()["content-disposition"]).toMatch(/^attachment; filename="seichi-archivio-\d{4}-\d{2}-\d{2}\.zip"$/);
		expect((await page.request.get(url)).status()).toBe(200);

		// La quarta: un rinvio alla pagina con un CODICE e l'attesa, mai un testo
		// (#162). Il comando è un `<a>` nudo: un testo sarebbe una pagina bianca
		// senza tasto indietro nella PWA installata.
		const fourth = await page.request.get(url, { maxRedirects: 0 });
		expect(fourth.status()).toBe(303);
		const back = new URL(fourth.headers()["location"], BASE_URL);
		expect(back.pathname).toBe("/impostazioni/esporta");
		expect(back.searchParams.get("errore")).toBe("limite");
		expect(back.searchParams.get("per")).toBe("archivio");
		expect(Number(back.searchParams.get("attesa"))).toBeGreaterThan(86_000);
		expect(back.hash).toBe("#archivio");

		// Dal comando vero: la pagina dice perché, accanto all'archivio, e l'URL
		// torna pulito (un ricarico non ripete un'attesa ormai vecchia).
		// ⚠️ `toBeInViewport()` e non solo `toBeVisible()`, che non guarda lo
		// schermo: senza l'ancora la pagina ricaricata partiva dall'inizio e
		// l'avviso restava sotto la BottomNav, «visibile» per Playwright e non
		// per chi tiene il telefono (collaudo dell'app vera, #162).
		await page.getByRole("link", { name: "Scarica l'archivio" }).click();
		const notice = page.getByText(
			/^Hai scaricato molti archivi nelle ultime 24 ore\. Potrai scaricarne un altro tra (24|23) ore\.$/,
		);
		await expect(notice).toBeVisible();
		await expect(notice).toBeInViewport({ ratio: 1 });
		await expect(page).toHaveURL(`${BASE_URL}/impostazioni/esporta`);

		// Senza sessione, mai un archivio: un rinvio all'ingresso dell'app. Lo fa
		// già il proxy (`/welcome`), prima della rotta; la rotta ha il suo
		// controllo (`/sign`) per chi arrivasse con una POST o un proxy cambiato.
		const anon = await playwright.request.newContext({ baseURL: BASE_URL });
		try {
			const res = await anon.get("/impostazioni/esporta/archivio", { maxRedirects: 0 });
			expect([302, 303, 307, 308]).toContain(res.status());
			expect(["/welcome", "/sign"]).toContain(new URL(res.headers()["location"], BASE_URL).pathname);
		} finally {
			await anon.dispose();
		}
	} finally {
		// L'utente si elimina dalla fixture, ma i file dello Storage non seguono
		// la cascata: si tolgono qui, anche se il test è fallito.
		await storage(account, "DELETE", paths[0]).catch(() => {});
	}
});
