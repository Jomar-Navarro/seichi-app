import { describe, expect, it } from "vitest";

import { en } from "./i18n/dictionaries/en";
import { it as itDict } from "./i18n/dictionaries/it";
import { notificationMeta, renderNotification } from "./notifications";
import type { AppNotification } from "@/types";

/**
 * La notifica della regola saltata dal job notturno (#173): la frase nasce
 * dal payload alla lettura, nella lingua e nella valuta di chi legge.
 */
function skipped(payload: Record<string, unknown>): AppNotification {
	return {
		id: "n1",
		type: "ricorrente_saltata",
		payload: payload as AppNotification["payload"],
		destination: "/impostazioni/ricorrenti",
		read: false,
		created_at: "2026-11-22T03:00:00Z",
	};
}

const ctx = { currency: "EUR", locale: "it" as const, t: itDict, today: "2026-11-22" };

describe("renderNotification — ricorrente_saltata", () => {
	it("dice quale ricorrenza, l'importo e la data dell'occorrenza bloccata", () => {
		expect(renderNotification(skipped({ name: "Affitto", amount: 750, date: "2026-11-05" }), ctx)).toEqual({
			title: 'Movimento ricorrente "Affitto" non registrato',
			body: "€ 750 del 5 novembre: ci riproviamo ogni notte. Controlla la regola.",
		});
	});

	// La regola ha perso la categoria: la frase non inventa un nome, e non
	// scrive «Movimento ricorrente "null"».
	it("senza nome non ne inventa uno", () => {
		expect(renderNotification(skipped({ name: null, amount: 12, date: "2026-11-05" }), ctx).title).toBe(
			"Un movimento ricorrente non è stato registrato",
		);
	});

	it("senza una data leggibile dice l'importo, non una data inventata", () => {
		expect(renderNotification(skipped({ name: "Affitto", amount: 750 }), ctx).body).toBe(
			"€ 750: ci riproviamo ogni notte. Controlla la regola.",
		);
	});

	it("in inglese, dallo stesso payload", () => {
		expect(
			renderNotification(skipped({ name: "Rent", amount: 750, date: "2026-11-05" }), { ...ctx, locale: "en", t: en }),
		).toEqual({
			title: 'Recurring transaction "Rent" not recorded',
			body: "€ 750 on 5 November: we'll retry every night. Check the rule.",
		});
	});

	// Senza una voce in META la riga cadrebbe sul ripiego (campanella grigia):
	// il tipo nuovo deve avere la sua icona.
	it("ha la sua icona, non il ripiego", () => {
		expect(notificationMeta("ricorrente_saltata").color).toBe("var(--color-kin)");
	});
});
