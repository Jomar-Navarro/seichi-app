"use client";

import { useI18n } from "@/components/features/I18nProvider";
import { fill } from "@/lib/i18n/format";
import { NOTES_COUNTER_FROM, NOTES_MAX, notesLength } from "@/lib/notes";

/**
 * Il contatore sotto il campo descrizione (#220): «230/255».
 *
 * Compare solo da `NOTES_COUNTER_FROM` caratteri: sotto, su ogni movimento,
 * sarebbe rumore. Serve perché il campo si ferma al limite (`limitNotesInput`), e un
 * testo incollato più lungo verrebbe tagliato senza che nessuno se ne accorga:
 * il contatore a «255/255» è ciò che lo dice.
 *
 * Al limite passa all'inchiostro ambra (`text-kin-ink`), mai all'accento pieno:
 * sul chiaro l'accento sta a circa 3:1. Sotto è `text-muted`.
 *
 * Per lo screen reader la frase intera («230 caratteri su 255»), al posto della
 * barra. Non è una regione live: annuncerebbe ogni tasto premuto.
 */
export default function NotesCounter({ value }: { value: string }) {
	const { t } = useI18n();
	const n = notesLength(value);
	if (n < NOTES_COUNTER_FROM) return null;

	return (
		<p
			className={
				n >= NOTES_MAX
					? "mt-1 text-right text-[11px] tabular-nums text-kin-ink"
					: "mt-1 text-right text-[11px] tabular-nums text-muted"
			}
		>
			<span aria-hidden="true">{fill(t.common.notesCounter, { n, max: NOTES_MAX })}</span>
			<span className="sr-only">{fill(t.common.notesCounterLabel, { n, max: NOTES_MAX })}</span>
		</p>
	);
}
