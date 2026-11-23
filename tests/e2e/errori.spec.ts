import { readFileSync } from "node:fs";
import { choose, newMovement } from "./support/app";
import { localSql } from "./support/db";
import { E2E_SENTRY_LOG } from "./support/env";
import { expect, login, open, test } from "./support/fixtures";
import { seedBasic } from "./support/seed";

/**
 * Gli errori di produzione arrivano a Sentry, e senza dati personali (#160).
 *
 * ⚠️ Il difetto che custodisce è un silenzio: `genericError()` e gli altri 105
 * `console.error` scrivevano nei log di Vercel, che nessuno legge e che il
 * piano gratuito tiene poche ore. E con esso il difetto che la correzione
 * poteva introdurre: spedire a un servizio esterno la nota, l'importo o
 * l'email di chi usa l'app.
 *
 * Sentry qui è finto: lo accende il `globalSetup`, e ogni envelope finisce in
 * `E2E_SENTRY_LOG`. Ogni scenario cerca il PROPRIO marcatore, perché gli altri
 * scenari in parallelo possono riferire errori loro.
 *
 * Controprova:
 *   - in `logServerError()` (`lib/errors.ts`) togliere `queueReport(…)`: cade
 *     «un guasto in una server action», che non trova l'evento;
 *   - in `buildEvent()` usare `report.message` invece di `scrub(…)`: cadono
 *     entrambi gli scenari sul primo dato personale.
 */

/** La nota-marcatore: il trigger rifiuta solo questa, e non deve uscire. */
const NOTA = "Cena con Mario al Vecchio Mulino";

/*
 * Un guasto iniettato con la forma dei messaggi veri di Postgres: il vincolo
 * per nome, il VALORE tra virgolette (`%L`). In più, apposta, l'email e
 * l'importo fuori dalle virgolette: devono sparire lo stesso.
 */
const INSTALL = `
create or replace function public.e2e_guasto_160() returns trigger language plpgsql
security definer set search_path = '' as $$
begin
	if new.notes = '${NOTA}' then
		raise exception 'new row violates check constraint "e2e_guasto_160": nota %, importo %, utente %',
			quote_literal(new.notes), new.amount, (select email from auth.users where id = new.user_id)
			using errcode = '23514';
	end if;
	return new;
end $$;
drop trigger if exists e2e_guasto_160 on public.transactions;
create trigger e2e_guasto_160 before insert on public.transactions
	for each row execute function public.e2e_guasto_160();
`;
const REMOVE = `
drop trigger if exists e2e_guasto_160 on public.transactions;
drop function if exists public.e2e_guasto_160();
`;

type Envelope = { path: string; auth: string; body: string };

function envelopes(): Envelope[] {
	return readFileSync(E2E_SENTRY_LOG, "utf8")
		.split("\n")
		.filter(Boolean)
		.map((l) => JSON.parse(l) as Envelope);
}

/** L'envelope che contiene `marker`, aspettato: l'invio parte DOPO la risposta (`after()`). */
async function waitForEnvelope(marker: string): Promise<Envelope> {
	let found: Envelope | undefined;
	await expect
		.poll(() => (found = envelopes().find((e) => e.body.includes(marker))), {
			message: `un evento con «${marker}» arriva al finto Sentry`,
			timeout: 15_000,
		})
		.toBeTruthy();
	return found!;
}

test("un guasto in una server action arriva a Sentry, senza nota, importo, email né id", async ({ page, account }) => {
	localSql(INSTALL);
	try {
		await seedBasic(account);
		await login(page, account);
		await open(page, "/?conto=");

		await newMovement(page, "Uscita", "37,45");
		const wizard = page.getByRole("dialog", { name: "Nuovo movimento" });
		await choose(page, "Categoria", "Alimentari");
		await wizard.getByPlaceholder("Es. Trenord, Esselunga...").fill(NOTA);
		await wizard.getByRole("button", { name: "Salva movimento" }).click();
		// L'utente vede la frase generica, non il testo di Postgres.
		await expect(wizard.getByRole("alert")).toBeVisible();
	} finally {
		localSql(REMOVE);
	}

	const env = await waitForEnvelope("e2e_guasto_160");
	expect(env.path).toBe("/api/1/envelope/");
	expect(env.auth).toContain("sentry_key=e2e");

	const [, item, eventLine] = env.body.split("\n");
	expect(JSON.parse(item)).toEqual({ type: "event" });
	const event = JSON.parse(eventLine);
	expect(event.tags).toMatchObject({ scope: "transactions", source: "server" });
	// Il nome del vincolo resta: è ciò che dice QUALE guasto.
	expect(event.exception.values[0].value).toContain('"e2e_guasto_160"');

	for (const secret of [NOTA, "Mario", account.email, account.id, "37,45", "37.45"]) {
		expect(env.body, `«${secret}» non esce`).not.toContain(secret);
	}
	expect(event.user).toBeUndefined();
	expect(event.request).toBeUndefined();
});

test.describe("dal browser", () => {
	// L'eccezione non gestita è proprio ciò che si prova: il controllo
	// automatico delle eccezioni della pagina qui la prenderebbe per un difetto.
	// Playwright pretende la destrutturazione del primo argomento: `page` è già
	// una dipendenza di ogni scenario, quindi non costa niente.
	test.use({
		pageErrors: async ({ page }, provide) => {
			void page;
			await provide();
		},
	});

	test("un'eccezione non gestita nel browser arriva a Sentry, ripulita", async ({ page, account }) => {
		await seedBasic(account);
		await login(page, account);
		await open(page, "/transazioni?q=farmacia");

		// Uno <script> della pagina e non `page.evaluate`: il codice di evaluate
		// non ha un file della nostra origine, e `ClientErrorReporter` scarta
		// gli errori degli script estranei (le estensioni del browser).
		const message = `errore di prova e2e_browser_160 per ${account.email}: "Spesa casa" da 12,34`;
		await page.addScriptTag({ content: `setTimeout(() => { throw new Error(${JSON.stringify(message)}); }, 0);` });

		const env = await waitForEnvelope("e2e_browser_160");
		const event = JSON.parse(env.body.split("\n")[2]);
		expect(event.tags).toMatchObject({ scope: "browser", source: "client", route: "/transazioni" });
		for (const secret of [account.email, "Spesa casa", "12,34", "farmacia"]) {
			expect(env.body, `«${secret}» non esce`).not.toContain(secret);
		}
	});

	test("senza sessione /api/errori non accetta niente", async ({ request }) => {
		const before = envelopes().length;
		const res = await request.post("/api/errori", {
			data: { scope: "browser", message: "e2e_anonimo_160" },
			maxRedirects: 0,
		});
		// Il proxy rimanda a /welcome; senza proxy la route risponderebbe 401.
		expect([307, 401]).toContain(res.status());
		await new Promise((r) => setTimeout(r, 1_000));
		expect(envelopes().slice(before).some((e) => e.body.includes("e2e_anonimo_160"))).toBe(false);
	});
});
