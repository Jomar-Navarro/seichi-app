import { existsSync, readFileSync } from "node:fs";
import { assertLocal, E2E_MARKER, localSupabase } from "./env";

/**
 * Prima di qualunque test: la build che `next start` sta per servire è stata
 * costruita contro il Supabase LOCALE?
 *
 * ⚠️⚠️ È la domanda che separa questa suite dalla produzione. Le NEXT_PUBLIC_*
 * sono inlinizzate in compilazione, quindi una `.next` costruita con
 * `.env.local` parla col database vero qualunque cosa dica l'ambiente dei
 * test. Il marcatore lo scrive solo `scripts/e2e.mjs build`, e `next build`
 * svuota `.next` all'inizio: se c'è, l'ultima build è quella dei test.
 */
export default async function globalSetup() {
	if (!existsSync(E2E_MARKER)) {
		throw new Error(
			`Manca ${E2E_MARKER}: l'ultima build non è quella dei test. Prima \`npm run e2e:build\` (con il database locale acceso: \`npm run e2e:db\`).`,
		);
	}
	const marker = JSON.parse(readFileSync(E2E_MARKER, "utf8")) as { supabaseUrl: string };
	assertLocal(marker.supabaseUrl);

	const sb = localSupabase();
	if (marker.supabaseUrl !== sb.url) {
		throw new Error(`La build punta a ${marker.supabaseUrl}, il database locale risponde su ${sb.url}: ricostruisci con \`npm run e2e:build\`.`);
	}
	const health = await fetch(`${sb.url}/auth/v1/health`, { headers: { apikey: sb.publishableKey } }).catch(() => null);
	if (!health?.ok) {
		throw new Error(`Il Supabase locale non risponde su ${sb.url}: \`npm run e2e:db\` (serve Docker).`);
	}
}
