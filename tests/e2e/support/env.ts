import { execSync } from "node:child_process";

/**
 * Dove girano i test end-to-end (#156): un Supabase LOCALE in Docker, mai
 * quello di produzione. Le chiavi si leggono da `supabase status` e non stanno
 * in nessun file del repo.
 *
 * ⚠️ Porta e marcatore sono gli stessi di `scripts/e2e.mjs`, che li scrive:
 * quel file si esegue all'import, quindi non si può importare da qui.
 */
export const E2E_PORT = 3200;
export const BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_MARKER = ".next/e2e-supabase.json";

/** Gli indirizzi degli account di prova: un dominio riservato, mai consegnabile. */
export const TEST_EMAIL_DOMAIN = "e2e.seichi.test";

export type LocalSupabase = { url: string; publishableKey: string; secretKey: string; mailpitUrl: string };

/**
 * Letto una volta dal processo principale (in `playwright.config.ts`) e passato
 * ai worker per ambiente: `supabase status` passa da `npx` e costa un secondo.
 */
export function localSupabase(): LocalSupabase {
	if (!process.env.E2E_SUPABASE_URL) {
		const out = execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
		const s = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
		process.env.E2E_SUPABASE_URL = s.API_URL;
		process.env.E2E_SUPABASE_PUBLISHABLE_KEY = s.PUBLISHABLE_KEY;
		process.env.E2E_SUPABASE_SECRET_KEY = s.SECRET_KEY;
		process.env.E2E_MAILPIT_URL = s.MAILPIT_URL;
	}
	const env = {
		url: process.env.E2E_SUPABASE_URL ?? "",
		publishableKey: process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? "",
		secretKey: process.env.E2E_SUPABASE_SECRET_KEY ?? "",
		mailpitUrl: process.env.E2E_MAILPIT_URL ?? "",
	};
	assertLocal(env.url);
	return env;
}

/**
 * ⚠️⚠️ La difesa della produzione, ripetuta ovunque si parli col database: la
 * chiave segreta del Supabase locale è quella pubblica dei documenti della
 * CLI, e un test che la mandasse a un altro host fallirebbe comunque — ma un
 * test che ricevesse l'URL di produzione da una variabile sbagliata creerebbe
 * account veri. Qui non si arriva nemmeno a provarci.
 */
export function assertLocal(url: string) {
	const host = (() => {
		try {
			return new URL(url).hostname;
		} catch {
			return "";
		}
	})();
	if (host !== "127.0.0.1" && host !== "localhost") {
		throw new Error(`I test end-to-end girano solo su un Supabase locale: ${url || "(vuoto)"} non lo è.`);
	}
}
