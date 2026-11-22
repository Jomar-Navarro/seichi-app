/**
 * La descrizione di un movimento o di una regola ricorrente (#220).
 *
 * `transactions.notes` è `varchar(255)`, e dalla `20261123` anche
 * `recurring_rules.notes` ha il suo CHECK `char_length(notes) <= 255`: prima
 * era `text`, e una ricorrenza con una nota più lunga si salvava e poi falliva
 * a ogni generazione (#173).
 *
 * ⚠️ **Si contano i caratteri come li conta Postgres, non come li conta
 * JavaScript.** `char_length` e `varchar(n)` contano i code point; `.length`
 * conta le unità UTF-16, e un'emoji fuori dal piano base («🏠») vale 2. Con
 * `.length`, una nota di 200 emoji risulterebbe di 400 «caratteri»: il form la
 * rifiuterebbe mentre il database la accetta. Per lo stesso motivo il campo non
 * usa l'attributo `maxLength`, che conta le unità UTF-16: il contatore direbbe
 * «250/255» e il campo smetterebbe di accettare testo. Form, action e database
 * contano allo stesso modo, con `[...s]`, che itera per code point.
 */

/** Il limite della colonna. */
export const NOTES_MAX = 255;

/** Da qui il contatore compare: prima sarebbe rumore su ogni movimento. */
export const NOTES_COUNTER_FROM = 200;

/** I caratteri di `s` come `char_length()` di Postgres: i code point. */
export function notesLength(s: string): number {
	return [...s].length;
}

/**
 * Il testo tagliato al limite, per code point: non spezza mai una coppia di
 * surrogati a metà, che il database rifiuterebbe come UTF-8 non valido.
 */
export function clampNotes(s: string): string {
	const points = [...s];
	return points.length <= NOTES_MAX ? s : points.slice(0, NOTES_MAX).join("");
}

/** La nota si può scrivere così com'è: assente, o entro il limite. */
export function isStorableNotes(s: string | null | undefined): boolean {
	return s == null || notesLength(s) <= NOTES_MAX;
}

/**
 * Il nuovo valore del campo, tenuto entro il limite tagliando SOLO ciò che si
 * è appena inserito (review della #220).
 *
 * ⚠️ `clampNotes` da sola taglia la FINE: con la nota già al limite, una
 * parola scritta o incollata in mezzo spingeva fuori le ultime, che sparivano
 * senza avviso. `maxLength` si comporta diversamente — rifiuta ciò che non
 * entra e lascia stare il resto — ed è quello che ci si aspetta da un campo.
 *
 * Si trova la parte inserita confrontando i due valori: il prefisso e il
 * suffisso comuni sono il testo che c'era, il resto è l'inserimento (un tasto,
 * un incolla, una sostituzione della selezione). Si tiene dell'inserimento
 * solo ciò che entra. Tutto per code point, come `notesLength`.
 */
export function limitNotesInput(prev: string, next: string): string {
	const n = [...next];
	if (n.length <= NOTES_MAX) return next;
	const p = [...prev];
	let start = 0;
	while (start < p.length && start < n.length && p[start] === n[start]) start++;
	let end = 0;
	while (
		end < p.length - start &&
		end < n.length - start &&
		p[p.length - 1 - end] === n[n.length - 1 - end]
	) {
		end++;
	}
	const inserted = n.slice(start, n.length - end);
	const kept = n.length - inserted.length;
	// Il testo che c'era supera già il limite (non dovrebbe: tutte le colonne
	// ce l'hanno): si taglia la fine, l'unica scelta rimasta.
	if (kept > NOTES_MAX) return clampNotes(next);
	return [...n.slice(0, start), ...inserted.slice(0, NOTES_MAX - kept), ...n.slice(n.length - end)].join("");
}
