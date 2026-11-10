import { describe, expect, it } from "vitest";

import { en } from "./en";
import { it as itDict } from "./it";

/*
 * Il controllo 3 della Fase 19, versionato. `en.ts: Dictionary` fa già fallire
 * la build su una chiave mancante; restano fuori due cose che compilano
 * benissimo e si vedono solo a schermo:
 *
 *   · un SEGNAPOSTO perso in una lingua: `fill()` lascia `{n}` dov'è, o una
 *     frase perde la cifra senza che nessuno lo noti;
 *   · una traduzione DIMENTICATA, cioè l'italiano ricopiato nell'inglese.
 */

/** Ogni foglia del dizionario, col suo percorso: `common.save` → "Salva". */
function leaves(node: unknown, path = ""): Map<string, string> {
	const out = new Map<string, string>();
	if (typeof node === "string") {
		out.set(path, node);
		return out;
	}
	for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
		for (const [p, v] of leaves(value, path ? `${path}.${key}` : key)) out.set(p, v);
	}
	return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/*
 * Le foglie che possono restare identiche nelle due lingue, una per una.
 * ⚠️ Un nome, una sigla, una parola internazionale: se ne compare una nuova, il
 * test la nomina e va decisa qui — tradotta, o aggiunta con il suo perché.
 */
const SAME_IN_BOTH = new Set<string>([
	// Il nome.
	"meta.title",
	// Parole che l'italiano usa così come sono.
	"nav.home",
	"auth.signIn.email",
	"auth.signIn.password",
	"account.email.password",
	"budget.sectionTitle",
	"settings.groups.budget",
	"analytics.report.title",
	"coach.title",
	"presetCategories.freelance.title",
	"presetCategories.bonus.title",
	"presetCategories.streaming.title",
	"presetCategories.streaming.subtitle",
	"iconLabels.entrata.Award",
	"iconLabels.entrata.Coins",
	"iconLabels.entrata.Handshake",
	"iconLabels.spesa.Wifi",
	"iconLabels.abbonamento.Tv",
	"iconLabels.abbonamento.Cloud",
	"iconLabels.abbonamento.Gamepad2",
	// Sigle e asset.
	"presetCategories.etf.title",
	"presetCategories.crypto.title",
	"investments.types.etf",
	"investments.types.crypto",
	"iconLabels.investimento.Bitcoin",
	// Nomi delle valute.
	"settings.currencies.EUR",
	"settings.currencies.JPY",
	// Formati senza parole.
	"categories.iconSet",
	"import.file.recognised",
]);

const IT = leaves(itDict);
const EN = leaves(en);

describe("dizionari it/en", () => {
	it("hanno le stesse foglie", () => {
		expect([...EN.keys()].sort()).toEqual([...IT.keys()].sort());
	});

	it("nessuna foglia è vuota", () => {
		const vuote = [...IT, ...EN].filter(([, v]) => v.trim() === "").map(([p]) => p);
		expect(vuote).toEqual([]);
	});

	it("ogni frase porta gli stessi segnaposto nelle due lingue", () => {
		const diversi = [...IT]
			.filter(([p, v]) => placeholders(v).join() !== placeholders(EN.get(p) ?? "").join())
			.map(([p, v]) => `${p}: it ${placeholders(v)} / en ${placeholders(EN.get(p) ?? "")}`);
		expect(diversi).toEqual([]);
	});

	it("le uguali sono solo quelle dichiarate", () => {
		const uguali = [...IT].filter(([p, v]) => EN.get(p) === v).map(([p]) => p);
		expect(uguali.filter((p) => !SAME_IN_BOTH.has(p))).toEqual([]);
		// E l'elenco non trattiene voci che nel frattempo sono state tradotte.
		expect([...SAME_IN_BOTH].filter((p) => !uguali.includes(p))).toEqual([]);
	});
});
