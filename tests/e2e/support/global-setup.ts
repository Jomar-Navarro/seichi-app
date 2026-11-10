import { readFileSync } from "node:fs";
import { localSupabase } from "./env";

/**
 * Prima di qualunque test, ciò che si può controllare a server già acceso.
 *
 * ⚠️ Il controllo del MARCATORE della build non sta qui: Playwright avvia il
 * `webServer` prima del `globalSetup` (letto nel sorgente del runner, code
 * review della #156), quindi qui arriverebbe tardi. Lo fa `e2e.mjs serve`,
 * prima di avviare `next start`.
 */
export default async function globalSetup() {
	const sb = localSupabase();
	const health = await fetch(`${sb.url}/auth/v1/health`, { headers: { apikey: sb.publishableKey } }).catch(() => null);
	if (!health?.ok) {
		throw new Error(`Il Supabase locale non risponde su ${sb.url}: \`npm run e2e:db\` (serve Docker).`);
	}

	/*
	 * ⚠️ Auth firma con la chiave ES256 del repo, come la produzione? `supabase
	 * start` su uno stack già acceso non ricarica la configurazione, e col
	 * segreto HS256 `getClaims()` ripiegherebbe in silenzio su `getUser()`: la
	 * suite passerebbe provando un percorso d'autenticazione che la produzione
	 * non usa. Ogni account di prova controlla anche l'intestazione del proprio
	 * token (`accounts.ts`).
	 */
	const [{ kid }] = JSON.parse(readFileSync("supabase/signing_keys.json", "utf8")) as { kid: string }[];
	const jwks = (await (await fetch(`${sb.url}/auth/v1/.well-known/jwks.json`)).json()) as { keys?: { kid: string }[] };
	if (!jwks.keys?.some((k) => k.kid === kid)) {
		throw new Error("Auth non firma con supabase/signing_keys.json: `npx supabase stop --no-backup` e di nuovo `npm run e2e:db`.");
	}
}
