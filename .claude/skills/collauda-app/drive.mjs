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
	/*
	 * ⚠️⚠️ `?conto=` VUOTO, non `/` nudo — e questa riga esiste per un difetto del
	 * collaudo stesso, scoperto il 2026-08-12.
	 *
	 * Dalla 20b il conto scelto si RICORDA in un cookie. Il passo 2 qui sopra ne
	 * sceglie uno, quindi da lì in poi un `goto("/")` non è più "la home non
	 * filtrata": è la home filtrata su quel conto. Il confronto 6 ha continuato a
	 * passare — misurando però due numeri FILTRATI invece dei totali, cioè non più
	 * ciò che il commento qui sopra dichiara. **Un controllo che passa per il
	 * motivo sbagliato è peggio di un controllo che manca**, perché nessuno torna
	 * a guardarlo.
	 *
	 * Un parametro presente ma vuoto è un'ISTRUZIONE ("nessun conto") e batte la
	 * memoria: vedi `getSelectedAccount`. È l'unico modo di chiedere "tutti i
	 * conti" senza dover prima toccare l'interfaccia.
	 */
	await page.goto(`${BASE}/?conto=`, { waitUntil: "domcontentloaded" });
	await page.waitForLoadState("networkidle").catch(() => {});
	const homeFlow = toNumber(
		await page.locator("p").filter({ hasText: /€/ }).first().innerText(),
	);

	await page.goto(`${BASE}/analisi?conto=`, { waitUntil: "domcontentloaded" });
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
		/*
		 * Si prende il primo conto dal pannello e si confrontano le due pagine.
		 *
		 * ⚠️ `?conto=` vuoto, per lo stesso motivo del confronto 6: con la memoria
		 * attiva il chip porta il NOME del conto scelto al passo 2, quindi la
		 * ricerca per "tutti i conti" non lo aggancia e l'intero blocco veniva
		 * saltato **in silenzio** — il controllo spariva dal referto e nessuno se
		 * ne accorgeva, perché un elenco di soli OK non distingue "passato" da
		 * "non eseguito".
		 */
		await page.goto(`${BASE}/?conto=`, { waitUntil: "domcontentloaded" });
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
			} else {
				ko.push("KO  7 nessun conto nel pannello: confronto filtrato NON eseguito");
			}
		} else {
			ko.push("KO  7 chip 'Tutti i conti' non trovato: confronto filtrato NON eseguito");
		}
	} else {
		ko.push("KO  7 /conti irraggiungibile: confronto filtrato NON eseguito");
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

	/* ======================================================= Fase 20b · trasferimenti */

	/* ------------------------ 8 · la griglia dei tipi non sfonda il riquadro */
	// ⚠️ La prova esiste per un difetto che né `tsc` né il lint vedono: la card
	// dell'ultimo tipo occupava DUE colonne per riempire una griglia dispari, e
	// col sesto tipo (`trasferimento`) la griglia 2×3 è esatta — quella regola
	// avrebbe spinto l'ultima card su una quarta riga inesistente, dentro un
	// contenitore `flex-1 min-h-0` che non può crescere. Si vede solo aprendo il
	// modale, e solo dopo aver aggiunto un tipo: cioè una volta ogni due anni.
	await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
	await page.waitForLoadState("networkidle").catch(() => {});
	await page.locator(".fab").first().click();
	await page.waitForTimeout(700);
	await expectText(page, "Trasferimento", "8 il sesto tipo c'è");

	const griglia = page.locator(".grid.grid-cols-2.grid-rows-3").first();
	const gb = await griglia.boundingBox();
	const cardTrasf = page.getByText("Trasferimento", { exact: true }).first();
	const cb = await cardTrasf.boundingBox();
	const dentro = gb && cb && cb.y + cb.height <= gb.y + gb.height + 2;
	(dentro ? ok : ko).push(
		`${dentro ? "OK " : "KO "} 8 la card 'Trasferimento' sta DENTRO la griglia ` +
		`(griglia fino a ${gb ? Math.round(gb.y + gb.height) : "?"}, card fino a ${cb ? Math.round(cb.y + cb.height) : "?"})`,
	);
	console.log("shot:", await shot(page, "tipi-sei-card"));

	/* --------------- 9 · il form trasferimento: due conti, nessuna categoria */
	await cardTrasf.click();
	// ⚠️ 2500ms e non 800: i conti arrivano da una query Supabase e alla PRIMA
	// apertura c'è anche la compilazione del chunk. Con l'attesa corta lo scatto
	// mostrava il form senza conti e con l'avviso rosso "serve un conto" — un
	// falso allarme che somiglia moltissimo a un difetto vero.
	await page.waitForTimeout(2500);
	await expectText(page, "Conto di partenza", "9 origine");
	await expectText(page, "Conto di arrivo", "9 destinazione");
	for (const [testo, etichetta] of [
		["Categoria", "9 la categoria lascia il posto alla destinazione"],
		["Ripeti", "9 niente ricorrenza sui trasferimenti"],
	]) {
		const c = await page.getByText(testo, { exact: false }).first().isVisible().catch(() => false);
		(c ? ko : ok).push(`${c ? "KO " : "OK "} ${etichetta} — "${testo}" NON deve esserci`);
	}
	console.log("shot:", await shot(page, "form-trasferimento"));

	/* -------- 10 · risparmio: categoria E destinazione facoltativa, spiegata */
	await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
	await page.waitForLoadState("networkidle").catch(() => {});
	await page.locator(".fab").first().click();
	await page.waitForTimeout(700);
	await page.getByText("Risparmio", { exact: true }).first().click();
	await page.waitForTimeout(2000);
	await expectText(page, "Categoria", "10 il risparmio tiene la categoria");
	await expectText(page, "Conto di arrivo", "10 e guadagna la destinazione facoltativa");
	// La riga che rende impossibile il doppio conteggio: senza, l'utente
	// registra il risparmio E il trasferimento.
	await expectText(page, "il denaro si sposta davvero", "10 con la riga che dice cosa cambia");
	console.log("shot:", await shot(page, "form-risparmio-destinazione"));

	/* ------------- 11 · il conto di una ricorrente è modificabile (debito 20a) */
	// ⚠️ Il selettore punta a "modifica", NON a un bottone che contenga "€":
	// l'importo sta in un FRATELLO della riga, la stessa trappola già annotata
	// per le righe conto. Un `button` con dentro `€` non aggancia niente.
	await page.goto(`${BASE}/impostazioni/ricorrenti`, { waitUntil: "domcontentloaded" });
	await page.waitForLoadState("networkidle").catch(() => {});
	const modifica = page.getByText("modifica", { exact: true }).first();
	if (await modifica.isVisible().catch(() => false)) {
		await modifica.click();
		await page.waitForTimeout(2000);
		await expectText(page, "Modifica ricorrenza", "11 sheet aperto");
		await expectText(page, "Conto", "11 il conto della regola è modificabile");
		console.log("shot:", await shot(page, "ricorrente-conto"));
	} else {
		ok.push("OK  11 saltata — nessuna regola ricorrente da aprire");
	}

	/* ------- 12 · il conto scelto SOPRAVVIVE a un giro fuori e ritorno */
	// ⚠️ È il difetto segnalato usando l'app: "Home" nella bottom nav punta a `/`,
	// e finché la selezione viveva solo in `?conto=` ogni ritorno la azzerava.
	// La prova deve passare da una navigazione VERA — andare su un'altra pagina e
	// tornare — perché un `goto` diretto su `/?conto=…` non dimostrerebbe nulla:
	// riporterebbe il parametro con sé.
	// ⚠️ Si parte da uno stato NOTO (`?conto=` vuoto = tutti i conti), o il chip
	// porterebbe il nome del conto lasciato dai passi precedenti e il selettore
	// per testo non lo aggancerebbe. Lo stesso motivo per cui il confronto 6 va
	// forzato: da quando esiste la memoria, "aprire la home" non è più uno stato
	// determinato.
	await page.goto(`${BASE}/?conto=`, { waitUntil: "domcontentloaded" });
	await page.waitForLoadState("networkidle").catch(() => {});
	await page.getByText("Tutti i conti", { exact: false }).first().click().catch(() => {});
	await page.waitForTimeout(700);
	const vociConto = page.locator("div.absolute button");
	if ((await vociConto.count()) > 1) {
		const nomeConto = (await vociConto.nth(1).innerText()).split("\n")[0].trim();
		await vociConto.nth(1).click();
		await page.waitForTimeout(1500);

		// Giro fuori e ritorno, come farebbe la bottom nav.
		await page.goto(`${BASE}/transazioni`, { waitUntil: "domcontentloaded" });
		await page.waitForLoadState("networkidle").catch(() => {});
		await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
		await page.waitForLoadState("networkidle").catch(() => {});
		await expectText(page, nomeConto, `12 il conto "${nomeConto}" è ricordato dopo il ritorno in home`);
		console.log("shot:", await shot(page, "conto-ricordato"));

		/* ---- 13 · /analisi eredita la memoria e ha il proprio selettore ---- */
		await page.goto(`${BASE}/analisi?periodo=anno`, { waitUntil: "domcontentloaded" });
		await page.waitForLoadState("networkidle").catch(() => {});
		await expectText(page, nomeConto, "13 /analisi eredita il conto senza passare dalla home");
		// ⚠️ Il periodo NON deve essere cambiato dal selettore: `keepParams` esiste
		// per questo, o un tocco cambierebbe DUE variabili e una in silenzio.
		const annoOk = page.url().includes("periodo=anno") || (await page.getByText(String(new Date().getFullYear()), { exact: false }).first().isVisible().catch(() => false));
		(annoOk ? ok : ko).push(`${annoOk ? "OK " : "KO "} 13 il periodo sopravvive al selettore conti`);
		console.log("shot:", await shot(page, "analisi-selettore"));

		// Si rimette "Tutti i conti", o il giro successivo partirebbe filtrato.
		await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
		await page.waitForLoadState("networkidle").catch(() => {});
		await page.locator("button").filter({ hasText: new RegExp(nomeConto) }).first().click().catch(() => {});
		await page.waitForTimeout(700);
		await page.locator("div.absolute button").first().click().catch(() => {});
		await page.waitForTimeout(1200);
		const pulito = await page.getByText("Tutti i conti", { exact: false }).first().isVisible().catch(() => false);
		(pulito ? ok : ko).push(`${pulito ? "OK " : "KO "} 12b "Tutti i conti" cancella la memoria`);
	} else {
		ko.push("KO  12 pannello conti non apribile: memoria non verificata");
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
