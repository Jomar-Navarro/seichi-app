import { assertLocal, E2E_BASE_URL, E2E_MARKER, E2E_PORT, readLocalStatus } from "../../../scripts/e2e-local.mjs";

/**
 * Dove girano i test end-to-end (#156): un Supabase LOCALE in Docker, mai
 * quello di produzione. Porta, marcatore e lettura delle chiavi stanno in
 * `scripts/e2e-local.mjs`, condiviso con lo script che costruisce la build.
 */
export { assertLocal, E2E_MARKER, E2E_PORT };
export const BASE_URL = E2E_BASE_URL;

/** Gli indirizzi degli account di prova: un dominio riservato, mai consegnabile. */
export const TEST_EMAIL_DOMAIN = "e2e.seichi.test";

export type LocalSupabase = { url: string; publishableKey: string; secretKey: string };

/**
 * Letto una volta dal processo principale (in `playwright.config.ts`) e passato
 * ai worker per ambiente: `supabase status` passa da `npx` e costa un secondo.
 */
export function localSupabase(): LocalSupabase {
	if (!process.env.E2E_SUPABASE_URL) {
		const s = readLocalStatus();
		process.env.E2E_SUPABASE_URL = s.url;
		process.env.E2E_SUPABASE_PUBLISHABLE_KEY = s.publishableKey;
		process.env.E2E_SUPABASE_SECRET_KEY = s.secretKey;
	}
	const env = {
		url: process.env.E2E_SUPABASE_URL ?? "",
		publishableKey: process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? "",
		secretKey: process.env.E2E_SUPABASE_SECRET_KEY ?? "",
	};
	assertLocal(env.url);
	return env;
}
