import { expect, test } from "./support/fixtures";

/**
 * Il service worker è un FILE (#233): `/sw.js`, scritto in `public/` da
 * `next build` (`scripts/build-sw.mjs`), non una route.
 *
 * ⚠️ Il difetto che custodisce: fino alla #233 il worker lo serviva la route
 * `/serwist/[path]`. Ogni `revalidatePath("/", "layout")` la dichiarava
 * scaduta, e Vercel la rieseguiva a runtime, dove ricompilare il worker
 * falliva (Sentry SEICHI-3) o, con esbuild presente, avrebbe prodotto un worker
 * col precache vuoto. Quel guasto si vede solo su Vercel; qui si custodisce la
 * forma che lo rende impossibile: nessuna route risponde col worker, e il
 * worker vero arriva come file statico.
 *
 * E i due modi in cui il file c'è ma la PWA no, già pagati nella Fase 25: il
 * proxy che manda la richiesta del worker a /welcome (un worker rediretto non
 * si installa), e un worker servito che nessuno registra, o che non aggancia
 * il fallback offline. Per questo si guarda un browser vero, non il curl.
 *
 * Nessun account: il worker si registra anche da /welcome, prima del login.
 *
 * Controprova:
 *   - togliere `sw\.js(?:\.map)?$` dal matcher di `proxy.ts`: cadono tutti e
 *     due (307 → /welcome, e il worker non si registra);
 *   - il codice di master (la route): cade «è un file», perché
 *     `/serwist/sw.js` risponde 200 e `/sw.js` no;
 *   - in `app/sw.ts` togliere la rotta `NetworkOnly`: cade «si registra», sul
 *     fallback offline che non compare.
 */

test("il worker è un file statico, servito senza passare dal proxy", async ({ request }) => {
	for (const path of ["/sw.js", "/sw.js.map"]) {
		const response = await request.get(path, { maxRedirects: 0 });
		expect(response.status(), path).toBe(200);
		expect(response.headers()["content-type"], path).toMatch(path.endsWith(".map") ? /json/ : /javascript/);
	}
	// Il worker porta il suo precache: vuoto, sarebbe il difetto che una
	// ricompilazione fuori dalla build produrrebbe.
	const worker = await (await request.get("/sw.js")).text();
	expect(worker).toContain('"/~offline"');
	expect(worker).toContain("/_next/static/");

	// La route di prima non risponde più col worker (qui: il proxy la manda a
	// /welcome, come ogni percorso sconosciuto senza sessione).
	const old = await request.get("/serwist/sw.js", { maxRedirects: 0 });
	expect(old.status()).not.toBe(200);
});

test("il worker si registra su /sw.js e aggancia il fallback offline", async ({ page, context }) => {
	await page.goto("/welcome");

	await expect
		.poll(
			() =>
				page.evaluate(async () => {
					const regs = await navigator.serviceWorker.getRegistrations();
					return {
						count: regs.length,
						active: regs[0]?.active?.scriptURL.replace(location.origin, "") ?? null,
						scope: regs[0]?.scope.replace(location.origin, "") ?? null,
						controller: navigator.serviceWorker.controller?.scriptURL.replace(location.origin, "") ?? null,
					};
				}),
			{ timeout: 30_000 },
		)
		.toEqual({ count: 1, active: "/sw.js", scope: "/", controller: "/sw.js" });

	// Una pagina mai aperta, a rete spenta: risponde il fallback del worker,
	// non la pagina d'errore del browser.
	await context.setOffline(true);
	try {
		await page.goto("/transazioni");
		await expect(page.getByRole("heading", { name: "Sei offline" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Torna alla home" })).toBeVisible();
	} finally {
		await context.setOffline(false);
	}
});
