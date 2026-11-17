import { describe, expect, it } from "vitest";

import { en } from "./i18n/dictionaries/en";
import { it as itDict } from "./i18n/dictionaries/it";
import { RATE_LIMITED_SQLSTATE, rateLimitMessage, retryAfterFromError } from "./rate-limit";

describe("retryAfterFromError (#161)", () => {
	it("legge i secondi dal rifiuto del tetto dell'import", () => {
		expect(retryAfterFromError({ code: RATE_LIMITED_SQLSTATE, details: "754" })).toBe(754);
	});

	it("ogni altro errore resta un guasto", () => {
		expect(retryAfterFromError({ code: "23503", details: "754" })).toBeNull();
		expect(retryAfterFromError({ code: undefined, details: null })).toBeNull();
	});

	it("un SR429 senza un numero valido non inventa un'attesa", () => {
		expect(retryAfterFromError({ code: RATE_LIMITED_SQLSTATE, details: null })).toBeNull();
		expect(retryAfterFromError({ code: RATE_LIMITED_SQLSTATE, details: "" })).toBeNull();
		expect(retryAfterFromError({ code: RATE_LIMITED_SQLSTATE, details: "0" })).toBeNull();
		expect(retryAfterFromError({ code: RATE_LIMITED_SQLSTATE, details: "1.5" })).toBeNull();
	});
});

describe("rateLimitMessage (#161)", () => {
	it("compone azione e attesa nella lingua dell'utente", () => {
		expect(rateLimitMessage(itDict, "it", "avatar", 754)).toBe(
			"Hai cambiato la foto profilo molte volte nell'ultima ora. Potrai cambiarla di nuovo tra 13 minuti.",
		);
		expect(rateLimitMessage(en, "en", "import", 7200)).toBe(
			"You've imported a lot of files in the last 24 hours. You can import again in 2 hours.",
		);
	});
});
