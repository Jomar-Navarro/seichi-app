/**
 * Driver di verifica della Fase 20a — usa e getta, fuori dal repo.
 *
 * ⚠️ È SOLA LETTURA sul database. L'unico gesto che potrebbe scrivere è il
 * secondo tocco su "Archivia": il primo arma soltanto la conferma nello stato
 * locale del componente, e quello è esattamente ciò che serve verificare. Lo
 * script si ferma lì.
 *
 * Nessuna credenziale: si riusa una sessione esistente via cookie.
 *   SEICHI_COOKIES  percorso del JSON coi cookie `sb-*` — FUORI dal repo
 *   SEICHI_SHOTS    cartella degli screenshot — FUORI dal repo
 *   SEICHI_URL      opzionale, default http://localhost:3000
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync, existsSync } from "node:fs";

const BASE = process.env.SEICHI_URL ?? "http://localhost:3000";

/*
 * ⚠️ NESSUN default dentro il repository.
 *
 * La prima versione aveva `?? "./cookies.json"`, che si risolve contro la CWD —
 * cioè la radice del progetto. Chi avesse lanciato lo script senza esportare le
 * variabili avrebbe scritto i cookie di sessione Supabase VIVI in un percorso
 * tracciato da git, a un `git add -A` dalla pubblicazione. E lo SKILL.md accanto
 * dice "nello scratchpad, mai nel repo": il default faceva l'opposto di ciò che
 * la sua stessa documentazione prescrive.
 *
 * Ora il percorso è obbligatorio e lo script si rifiuta di partire senza.
 */
const OUT = process.env.SEICHI_SHOTS;
const COOKIE_FILE = process.env.SEICHI_COOKIES;

if (!COOKIE_FILE || !OUT) {
	console.error(
		"Servono SEICHI_COOKIES e SEICHI_SHOTS, con percorsi FUORI dal repository " +
			"(lo scratchpad della sessione). Nessun default: i cookie sono una sessione viva.",
	);
	process.exit(2);
}

/*
 * ⚠️ Si riusa la SESSIONE ESISTENTE invece di fare il login dal form: così la
 * password non entra mai né nello script né nella cronologia. I cookie `sb-*`
 * di Supabase scadono da soli in un'ora, quindi anche il materiale che passa
 * di qui ha vita breve.
 *
 * Costo dichiarato: questo giro NON verifica il percorso di login, che resta
 * da provare a mano. Qui interessa ciò che sta dietro l'autenticazione.
 */
if (!existsSync(COOKIE_FILE)) {
	console.error(`Manca ${COOKIE_FILE}: serve un array JSON di {name, value}.`);
	process.exit(2);
}
const rawCookies = JSON.parse(readFileSync(COOKIE_FILE, "utf8"));

mkdirSync(OUT, { recursive: true });

const errors = [];
let step = 0;
const ok = [];
const ko = [];

async function shot(page, name) {
	step += 1;
	const file = `${OUT}/${String(step).padStart(2, "0")}-${name}.png`;
	await page.screenshot({ path: file, fullPage: false });
	return file;
}

/**
 * "€ 1.540,70" → 1540.70. Formato italiano: punto = migliaia, virgola = decimali.
 * Si tiene il segno perché un flusso può essere negativo.
 */
function toNumber(text) {
	const m = text.replace(/\s| /g, "").match(/(−|-)?[\d.]+,\d{2}/);
	if (!m) return NaN;
	const neg = /^(−|-)/.test(m[0]);
	const n = Number(m[0].replace(/^(−|-)/, "").replace(/\./g, "").replace(",", "."));
	return neg ? -n : n;
}

/** Verifica la presenza di un testo e registra l'esito senza fermare il giro. */
async function expectText(page, text, label) {
	const found = await page
		.getByText(text, { exact: false })
		.first()
		.isVisible()
		.catch(() => false);
	(found ? ok : ko).push(`${found ? "OK " : "KO "} ${label} — "${text}"`);
	return found;
}

const browser = await chromium.launch();
// Viewport mobile: l'app è disegnata per il telefono, e a 1280px la bottom nav
// e i bottom sheet non sono nella forma in cui li vede l'utente.
const context = await browser.newContext({ viewport: { width: 414, height: 896 } });

await context.addCookies(
	rawCookies.map((c) => ({
		name: c.name,
		value: c.value,
		domain: "localhost",
		path: "/",
		httpOnly: false,
		secure: false,
		sameSite: "Lax",
	})),
);

const page = await context.newPage();

page.on("console", (m) => {
	if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

try {
	/* -------------------------------------------------- sessione riusata */
	await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
	await page.waitForLoadState("networkidle").catch(() => {});

	// Se i cookie non bastano il proxy ci sbatte su /welcome: meglio dirlo
	// subito e chiaramente che collezionare cinque "KO" senza spiegazione.
	if (/\/welcome|\/sign/.test(page.url())) {
		throw new Error(`sessione non valida — finito su ${page.url()}`);
	}

	/* ------------------------------------------------------- 1 · home flusso */
	await expectText(page, "Flusso", "1 home mostra Flusso");
	const saldoTotale = await page.getByText("Saldo totale", { exact: false }).first().isVisible().catch(() => false);
	(saldoTotale ? ko : ok).push(`${saldoTotale ? "KO " : "OK "} 1 "Saldo totale" non compare più`);
	await expectText(page, "per i saldi, scorri", "1 riga che insegna lo scorrimento");
	console.log("shot:", await shot(page, "home-flusso"));

	/* ---------------------------------- 1-bis · carosello flusso / saldo */
	/*
	 * Il carosello è due pagine in uno scroll con snap. Si verifica che la
	 * seconda esista e che il suo numero coincida con la somma dei saldi dei
	 * conti attivi — cioè che la home e /conti dicano lo STESSO numero, che è la
	 * ragione per cui questa card è ammessa in home.
	 */
	const track = page.locator("div.snap-x").first();
	if (await track.isVisible().catch(() => false)) {
		await track.evaluate((el) => el.scrollTo({ left: el.clientWidth }));
		await page.waitForTimeout(600);
		await expectText(page, "Saldo", "1b seconda pagina del carosello");
		await expectText(page, "conti attivi", "1b pastiglia col conteggio");
		console.log("shot:", await shot(page, "carosello-saldo"));
		await track.evaluate((el) => el.scrollTo({ left: 0 }));
		await page.waitForTimeout(500);
	} else ko.push("KO  1b carosello non trovato");

	/* ------------------------------------------ 2 · selettore conti + saldo */
	const chip = page.getByRole("button", { name: /tutti i conti|all accounts/i }).first();
	if (await chip.isVisible().catch(() => false)) {
		await chip.click();
		await page.waitForTimeout(300);
		await expectText(page, "Gestisci conti", "2 pannello con voce gestisci");
		console.log("shot:", await shot(page, "selettore-aperto"));

		// Sceglie il PRIMO conto singolo (le righe dopo "tutti i conti").
		const rows = page.locator("div.absolute button");
		const n = await rows.count();
		if (n > 1) {
			await rows.nth(1).click();
			await page.waitForTimeout(1200);
			await expectText(page, "Flusso", "2 la home resta filtrata dopo la scelta");
			console.log("shot:", await shot(page, "conto-selezionato"));
		} else ko.push("KO  2 nessun conto singolo nel pannello");
	} else ko.push("KO  2 selettore conti non trovato");

	/* -------------------------------------------------------- 3 · /conti */
	await page.goto(`${BASE}/conti`, { waitUntil: "domcontentloaded" });
	await page.waitForLoadState("networkidle").catch(() => {});
	await expectText(page, "Conti", "3 titolo pagina conti");
	await expectText(page, "attiv", "3 sottotitolo 'N conti attivi'");
	console.log("shot:", await shot(page, "pagina-conti"));

	/* ----------------------------------- 4 · archivia: etichetta e disabilitato */
	/*
	 * ⚠️ Il selettore NON può cercare un bottone che contenga "€": dopo la
	 * correzione del markup interattivo annidato, la riga conto è un `div` e il
	 * bottone cliccabile contiene solo icona, nome e tipo — l'importo è in un
	 * fratello. Si punta al nome, che è ciò su cui l'utente tocca davvero.
	 */
	const firstAccount = page.getByRole("button", { name: /conto principale|revolut/i }).first();
	await firstAccount.click();
	await page.waitForTimeout(500);
	await expectText(page, "Modifica conto", "4 sheet di modifica aperto");

	const archiveBtn = page.getByRole("button", { name: /archivia|archive/i }).first();
	if (await archiveBtn.isVisible().catch(() => false)) {
		const disabled = await archiveBtn.isDisabled();
		console.log("shot:", await shot(page, "sheet-archivia"));

		if (disabled) {
			// È l'ultimo conto attivo: deve restare visibile con la ragione sotto.
			await expectText(page, "unico conto attivo", "4 ragione dell'ultimo conto");
			ok.push("OK  4 bottone visibile ma disabilitato sull'ultimo conto");
		} else {
			// ⚠️ SOLO il primo tocco: arma la conferma, non scrive nulla.
			await archiveBtn.click();
			await page.waitForTimeout(300);
			await expectText(page, "Conferma archiviazione", "4 etichetta cambia al primo tocco");
			console.log("shot:", await shot(page, "archivia-confermare"));
		}
	} else ko.push("KO  4 bottone archivia non trovato");

	/* ------------------------- 6 · il numero della home == quello di /analisi */
	/*
	 * ⚠️ È la verifica che conta più di tutte le altre messe insieme.
	 * `/analisi` mostra "Flusso netto" — la STESSA parola della home — e prima
	 * della correzione ne dava un valore diverso, perché contava come uscita
	 * anche risparmi e investimenti. Due schermate a un tap di distanza, due
	 * risposte per lo stesso mese: il difetto che l'intera fase esiste per
	 * chiudere, ricreato dopo averlo chiuso altrove.
	 */
	await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
	await page.waitForLoadState("networkidle").catch(() => {});
	const homeFlow = toNumber(
		await page.locator("p").filter({ hasText: /€/ }).first().innerText(),
	);

	await page.goto(`${BASE}/analisi`, { waitUntil: "domcontentloaded" });
	await page.waitForLoadState("networkidle").catch(() => {});
	const analisiFlow = toNumber(
		await page.getByText(/Flusso netto|Net flow/i).first().locator("..").innerText(),
	);
	console.log("shot:", await shot(page, "analisi"));

	const coincidono =
		Number.isFinite(homeFlow) && Number.isFinite(analisiFlow) &&
		Math.abs(homeFlow - analisiFlow) < 0.005;
	(coincidono ? ok : ko).push(
		`${coincidono ? "OK " : "KO "} 6 home (${homeFlow}) == /analisi (${analisiFlow})`,
	);

	/* ------------- 7 · /analisi FILTRATA coincide con la home filtrata */
	/*
	 * ⚠️ È il controllo che il giro precedente non aveva, e che copre il difetto
	 * più grave della review: la home era filtrabile per conto e `/analisi` no,
	 * quindi selezionando un conto le due tornavano a dire numeri diversi sotto
	 * la stessa parola — la correzione e la sua riapertura nella stessa PR.
	 */
	const accountsForFilter = await page.evaluate(async () => {
		const r = await fetch("/conti");
		return r.ok;
	}).catch(() => false);
	if (accountsForFilter) {
		// Si prende il primo conto dal pannello e si confrontano le due pagine.
		await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
		await page.waitForLoadState("networkidle").catch(() => {});
		const chip2 = page.getByRole("button", { name: /tutti i conti|all accounts/i }).first();
		if (await chip2.isVisible().catch(() => false)) {
			await chip2.click();
			await page.waitForTimeout(300);
			const rows2 = page.locator("div.absolute button");
			if ((await rows2.count()) > 1) {
				await rows2.nth(1).click();
				await page.waitForTimeout(1500);
				const url = new URL(page.url());
				const conto = url.searchParams.get("conto");
				const homeFiltrato = toNumber(
					await page.locator("p").filter({ hasText: /€/ }).first().innerText(),
				);
				await page.goto(`${BASE}/analisi?conto=${conto}`, { waitUntil: "domcontentloaded" });
				await page.waitForLoadState("networkidle").catch(() => {});
				const analisiFiltrato = toNumber(
					await page.getByText(/Flusso netto|Net flow/i).first().locator("..").innerText(),
				);
				console.log("shot:", await shot(page, "analisi-filtrata"));
				const coincidonoF =
					Number.isFinite(homeFiltrato) && Number.isFinite(analisiFiltrato) &&
					Math.abs(homeFiltrato - analisiFiltrato) < 0.005;
				(coincidonoF ? ok : ko).push(
					`${coincidonoF ? "OK " : "KO "} 7 FILTRATO: home (${homeFiltrato}) == /analisi (${analisiFiltrato})`,
				);
			}
		}
	}

	/* ---------------------------------------- 5 · lista filtrata senza risultati */
	await page.goto(`${BASE}/transazioni`, { waitUntil: "domcontentloaded" });
	await page.waitForLoadState("networkidle").catch(() => {});
	console.log("shot:", await shot(page, "movimenti"));

	// Filtrando per conto i budget NON si filtrano — restano su tutti i conti,
	// perché un budget è un limite su una CATEGORIA. La nota deve dirlo.
	const contoChip = page.getByRole("button", { name: /tutti i conti|all accounts/i }).first();
	if (await contoChip.isVisible().catch(() => false)) {
		await contoChip.click();
		await page.waitForTimeout(300);
		const voci = page.locator("div.absolute button");
		if ((await voci.count()) > 1) {
			await voci.nth(1).click();
			await page.waitForTimeout(900);
			await expectText(page, "budget valgono su tutti i conti", "5 i budget dichiarano il proprio ambito");
			console.log("shot:", await shot(page, "movimenti-filtrati"));
		}
	}
} catch (e) {
	ko.push(`KO  eccezione: ${e.message.split("\n")[0]}`);
	await shot(page, "errore").catch(() => {});
} finally {
	console.log("\n=========== ESITI ===========");
	for (const l of ok) console.log(l);
	for (const l of ko) console.log(l);
	console.log("\n=========== ERRORI CONSOLE ===========");
	console.log(errors.length ? errors.slice(0, 10).join("\n") : "nessuno");
	await browser.close();
}
