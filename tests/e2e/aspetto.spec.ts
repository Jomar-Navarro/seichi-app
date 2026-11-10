import type { Page } from "@playwright/test";
import { expect, login, open, test } from "./support/fixtures";
import { insertMovements, seedBasic } from "./support/seed";

/**
 * I separatori fra le righe delle impostazioni hanno il colore del bordo, non
 * quello del testo (#114). Sul desktop, dove la pagina è a due colonne.
 *
 * ⚠️ Il difetto che custodisce: in `SettingsGroup` la classe del colore era
 * incollata al `${` del template, e lo scanner di Tailwind non estrae ciò che è
 * incollato a `${`. Il separatore aveva lo spessore ma non il colore, e
 * ripiegava su `currentColor`: quasi bianco in scuro. Nessun controllo lo
 * vedeva, perché la classe esisteva — scritta in un altro file.
 *
 * Controprova: togliere lo spazio prima di `${` nella classe dei separatori.
 * ⚠️ Solo su una BUILD: in sviluppo Tailwind accumula le classi già generate,
 * e il difetto sparisce (#114).
 */
test("@desktop i separatori delle impostazioni hanno il colore del bordo", async ({ page, account }) => {
	await seedBasic(account);
	await login(page, account);
	await open(page, "/impostazioni");

	const separators = await page.evaluate(() => {
		const groups = [...document.querySelectorAll<HTMLElement>("div")].filter((d) =>
			d.className.includes("[&>*+*]:border-t"),
		);
		return groups.flatMap((g) => {
			// `var(--border)` risolto DENTRO il gruppo: la zona pericolo lo ridefinisce.
			const probe = document.createElement("span");
			probe.style.color = "var(--border)";
			g.appendChild(probe);
			const border = getComputedStyle(probe).color;
			probe.remove();
			return [...g.children].slice(1).map((row) => {
				const cs = getComputedStyle(row);
				return { width: cs.borderTopWidth, color: cs.borderTopColor, border, text: cs.color };
			});
		});
	});
	// Un gruppo con una riga sola non ha separatori: ne servono almeno alcuni,
	// o il controllo passerebbe senza aver guardato niente.
	expect(separators.length).toBeGreaterThanOrEqual(3);
	for (const s of separators) {
		expect(s.width).toBe("1px");
		expect(s.color, "il separatore ha il colore di var(--border)").toBe(s.border);
		expect(s.color, "il separatore NON ha il colore del testo").not.toBe(s.text);
	}
});

/**
 * Nessun bordo traslucido su un angolo arrotondato, nelle pagine principali
 * (#81).
 *
 * ⚠️ Il difetto che custodisce: in Firefox un `border-color` traslucido insieme
 * a `border-radius` lascia un quadratino sull'angolo. Invisibile in Chrome e in
 * Safari, quindi rimasto a lungo; la correzione è un ANELLO
 * (`box-shadow: inset 0 0 0 1px`) al posto del bordo. La causa si legge dallo
 * stile calcolato in qualunque motore: il controllo gira in Firefox perché è
 * lì che il difetto si VEDE, e lo scatto di un fallimento lo mostra.
 *
 * Unica eccezione dichiarata: il riquadro tratteggiato dell'import, perché un
 * `box-shadow` non sa disegnare un tratteggio (CLAUDE.md, «Issue #81»).
 *
 * Controprova: rimettere `border border-subtle` sulla card di `SettingsGroup`.
 */
test("@firefox nessun bordo traslucido sugli angoli arrotondati", async ({ page, account }) => {
	const s = await seedBasic(account);
	await insertMovements(account, [
		{ type: "entrata", amount: 1800, account_id: s.accounts.principale, category_id: s.cat("Stipendio") },
		{ type: "spesa", amount: 64, account_id: s.accounts.principale, category_id: s.cat("Alimentari"), notes: "spesa" },
		{ type: "risparmio", amount: 150, account_id: s.accounts.principale, category_id: s.cat("Vacanza") },
		{ type: "investimento", amount: 300, account_id: s.accounts.principale, category_id: s.cat("ETF") },
	]);
	await login(page, account);

	const offenders: string[] = [];
	for (const path of ["/?conto=", "/transazioni?conto=", "/risparmi", "/investimenti?conto=", "/analisi?conto=", "/conti", "/impostazioni"]) {
		await open(page, path);
		for (const o of await translucentRoundedBorders(page)) offenders.push(`${path} ${o}`);
	}
	expect(offenders).toEqual([]);
});

/** Gli elementi visibili con un bordo traslucido (né opaco né trasparente) e un raggio. */
function translucentRoundedBorders(page: Page) {
	return page.evaluate(() => {
		const alpha = (c: string) => {
			const m = c.match(/rgba?\(([^)]+)\)/);
			if (!m) return 1;
			const parts = m[1].split(/[\s,/]+/).filter(Boolean);
			return parts.length === 4 ? Number(parts[3]) : 1;
		};
		const found: string[] = [];
		for (const el of document.querySelectorAll<HTMLElement>("body *")) {
			const cs = getComputedStyle(el);
			if (cs.display === "none" || cs.visibility === "hidden") continue;
			const rect = el.getBoundingClientRect();
			if (rect.width === 0 || rect.height === 0) continue;
			const radius = parseFloat(cs.borderTopLeftRadius) || parseFloat(cs.borderBottomRightRadius);
			if (!radius) continue;
			for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
				const width = parseFloat(cs.getPropertyValue(`border-${side.toLowerCase()}-width`));
				const style = cs.getPropertyValue(`border-${side.toLowerCase()}-style`);
				const a = alpha(cs.getPropertyValue(`border-${side.toLowerCase()}-color`));
				if (width > 0 && style !== "none" && style !== "dashed" && a > 0 && a < 1) {
					found.push(`<${el.tagName.toLowerCase()} class="${el.className}">`);
					break;
				}
			}
		}
		return found;
	});
}
