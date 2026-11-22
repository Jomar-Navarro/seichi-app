import { describe, expect, it } from "vitest";

import { NOTES_MAX, clampNotes, isStorableNotes, limitNotesInput, notesLength } from "./notes";

/**
 * La descrizione (#220): si conta come `char_length()` di Postgres, per code
 * point. Un'emoji fuori dal piano base vale 1, non 2 come per `.length`.
 */
const HOUSE = "🏠"; // U+1F3E0: due unità UTF-16, un code point

describe("notesLength — come char_length() di Postgres", () => {
	it("un'emoji conta 1, non 2", () => {
		expect(HOUSE.length).toBe(2); // la premessa: .length sbaglierebbe
		expect(notesLength(HOUSE)).toBe(1);
	});

	it("lettere accentate e testo semplice", () => {
		expect(notesLength("perché")).toBe(6);
		expect(notesLength("")).toBe(0);
	});
});

describe("isStorableNotes — il limite della colonna", () => {
	it("255 caratteri sì, 256 no", () => {
		expect(isStorableNotes("a".repeat(NOTES_MAX))).toBe(true);
		expect(isStorableNotes("a".repeat(NOTES_MAX + 1))).toBe(false);
	});

	// 255 emoji sono 510 unità UTF-16, ma 255 caratteri per il database: con
	// `.length` l'action rifiuterebbe ciò che la colonna accetta.
	it("255 emoji sì, 256 no", () => {
		expect(isStorableNotes(HOUSE.repeat(NOTES_MAX))).toBe(true);
		expect(isStorableNotes(HOUSE.repeat(NOTES_MAX + 1))).toBe(false);
	});

	it("una nota assente si scrive", () => {
		expect(isStorableNotes(null)).toBe(true);
		expect(isStorableNotes(undefined)).toBe(true);
	});
});

describe("clampNotes — il campo si ferma al limite", () => {
	it("entro il limite il testo resta identico", () => {
		const s = "Affitto " + HOUSE;
		expect(clampNotes(s)).toBe(s);
	});

	it("oltre il limite si taglia a 255 caratteri", () => {
		expect(clampNotes("a".repeat(300))).toBe("a".repeat(NOTES_MAX));
	});

	// Il taglio per unità UTF-16 spezzerebbe l'emoji a cavallo del limite e
	// lascerebbe un surrogato orfano, che non è UTF-8 valido.
	it("non spezza un'emoji a cavallo del limite", () => {
		const s = "a".repeat(NOTES_MAX - 1) + HOUSE + "b";
		const clamped = clampNotes(s);
		expect(notesLength(clamped)).toBe(NOTES_MAX);
		expect(clamped.endsWith(HOUSE)).toBe(true);
	});
});

describe("limitNotesInput — taglia solo ciò che si è appena inserito (review #220)", () => {
	const full = "a".repeat(250) + "FINE!"; // 255

	it("entro il limite il valore passa così com'è", () => {
		expect(limitNotesInput("ciao", "ciao!")).toBe("ciao!");
	});

	// Il difetto: con `clampNotes` la parola scritta in mezzo spingeva fuori la
	// fine, che spariva senza avviso.
	it("al limite, una parola scritta in mezzo non porta via la fine", () => {
		const typed = "a".repeat(100) + "XYZ" + "a".repeat(150) + "FINE!";
		expect(limitNotesInput(full, typed)).toBe(full);
	});

	it("un incolla in mezzo tiene ciò che entra e lascia la fine", () => {
		const prev = "a".repeat(250); // 5 posti liberi
		const next = "a".repeat(100) + "0123456789" + "a".repeat(150);
		const out = limitNotesInput(prev, next);
		expect(notesLength(out)).toBe(NOTES_MAX);
		expect(out).toBe("a".repeat(100) + "01234" + "a".repeat(150));
	});

	it("un incolla in fondo si tronca come prima", () => {
		const out = limitNotesInput("ciao ", "ciao " + "b".repeat(300));
		expect(out).toBe("ciao " + "b".repeat(250));
	});

	// La selezione sostituita: si tolgono 10 caratteri e se ne incollano 30.
	it("una selezione sostituita conta i posti liberati", () => {
		const prev = "a".repeat(245) + "0123456789"; // 255
		const next = "a".repeat(245) + "x".repeat(30);
		expect(limitNotesInput(prev, next)).toBe("a".repeat(245) + "x".repeat(10));
	});

	it("non spezza un'emoji inserita al limite", () => {
		const prev = "a".repeat(254);
		const out = limitNotesInput(prev, prev + HOUSE + HOUSE);
		expect(out).toBe(prev + HOUSE);
		expect(notesLength(out)).toBe(NOTES_MAX);
	});
});
