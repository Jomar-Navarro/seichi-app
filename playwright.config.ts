import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, localSupabase } from "./tests/e2e/support/env";

/*
 * Il collaudo end-to-end (#156) — vedi «Collaudo end-to-end» in CLAUDE.md.
 *
 *   npm run e2e:db       Supabase locale in Docker (le migration del repo)
 *   npm run e2e:build    l'app costruita CONTRO quel database
 *   npm run test:e2e     questa suite, su `next start -p 3200`
 *
 * ⚠️ Mai sul database di produzione: il server lo avvia `e2e.mjs serve`, che
 * si rifiuta se l'ultima build non è quella dei test, e ogni chiamata dei test
 * al database passa da `assertLocal()`.
 *
 * Le chiavi del database locale si leggono qui, una volta, e arrivano ai
 * worker per ambiente. Con lo stack spento ci si ferma qui, e lo si dice.
 */
localSupabase();

export default defineConfig({
	testDir: "tests/e2e",
	testMatch: "**/*.spec.ts",
	globalSetup: "./tests/e2e/support/global-setup.ts",
	globalTeardown: "./tests/e2e/support/global-teardown.ts",
	// Ogni test ha il suo account: possono girare in parallelo.
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	// ⚠️ Niente tentativi ripetuti: un test che passa al secondo giro è un
	// difetto di tempi che resta nascosto (la #150 è stata tre volte «corretta
	// nella prova» invece che nell'app).
	retries: 0,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
	// 90 secondi e non 60: il primo giro, con otto browser che aprono insieme
	// un `next start` appena acceso, ha toccato i 50 su un portatile.
	timeout: 90_000,
	expect: { timeout: 10_000 },
	use: {
		baseURL: BASE_URL,
		// ⚠️ Senza, Playwright manda `Accept-Language: en-US` e l'app risponde
		// in inglese. Il fuso è quello di chi la usa.
		locale: "it-IT",
		timezoneId: "Europe/Rome",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [
		{
			// Il telefono: la forma per cui l'app è disegnata (Fase 27).
			name: "telefono",
			use: { ...devices["Desktop Chrome"], viewport: { width: 414, height: 896 } },
			grepInvert: /@desktop|@firefox/,
		},
		{
			// Sidebar, griglie, dialog centrati (Fase 28): da `lg:` in su.
			name: "desktop",
			use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
			grep: /@desktop/,
		},
		{
			// La #81 si vede solo nel motore di Firefox.
			name: "firefox",
			use: { ...devices["Desktop Firefox"], viewport: { width: 1024, height: 768 } },
			grep: /@firefox/,
		},
	],
	webServer: {
		// ⚠️ Il controllo del marcatore sta nel COMANDO e non nel globalSetup:
		// Playwright avvia il webServer prima del globalSetup.
		command: "node scripts/e2e.mjs serve",
		url: `${BASE_URL}/welcome`,
		// ⚠️ Mai riusare un server già acceso: su un'altra porta potrebbe girare
		// una build di produzione (collauda-app usa la 3100), e su questa una
		// build vecchia. Il marcatore dice quale build c'è in `.next`, non quale
		// sta servendo un processo partito prima.
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
