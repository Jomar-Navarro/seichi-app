import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/*
 * Test unitari (#155): solo funzioni PURE di `lib/`, niente Supabase, niente
 * DOM. Le verifiche dell'app vera restano allo skill `collauda-app`.
 *
 * ⚠️ Il fuso è FISSATO, e qui, prima che partano i processi dei test: lo
 * ereditano. Metà di `lib/` ragiona in ora locale (`lib/dates.ts`,
 * `lib/recurring.ts`), e i casi che contano — il cambio dell'ora legale, la
 * mezzanotte del primo del mese — esistono solo in un fuso che li ha. In UTC,
 * il fuso della CI, quei test passerebbero senza aver guardato niente.
 * `lib/dates.test.ts` controlla che il fuso sia davvero questo.
 */
process.env.TZ = "Europe/Rome";

export default defineConfig({
	resolve: {
		// Lo stesso alias di tsconfig.json. Una regex e non la chiave "@", così
		// `@supabase/…` e gli altri pacchetti con lo scope non ci finiscono dentro.
		alias: [{ find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) }],
	},
	test: {
		include: ["lib/**/*.test.ts"],
		environment: "node",
	},
});
