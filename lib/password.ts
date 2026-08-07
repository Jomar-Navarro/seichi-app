/**
 * Regole e valutazione delle password — condivise fra client e server.
 *
 * La validazione gira SEMPRE anche lato server: quella client è solo feedback
 * immediato, e una server action è raggiungibile con una POST diretta.
 */

export const PASSWORD_MIN_LENGTH = 8;

export type PasswordScore = 0 | 1 | 2 | 3;

export interface PasswordStrength {
	score: PasswordScore;
	/** Riempimento delle barre: l'accento pieno. */
	color: string;
	/** L'etichetta sotto le barre: l'inchiostro, o in chiaro resta a ~3,4:1. */
	ink: string;
}

/**
 * ⚠️ Niente `label` qui dentro (Fase 19).
 *
 * Questo modulo è condiviso fra client e server e contiene regole, non copy:
 * l'etichetta vive in `t.password.strength[score]`, indicizzata dallo stesso
 * punteggio. Il colore invece resta, perché è una proprietà del livello e non
 * cambia con la lingua — stessa divisione che c'è fra `TIPO_COLOR` e
 * `t.types` in `lib/transaction-utils.ts`.
 */
const STRENGTH: Record<PasswordScore, Omit<PasswordStrength, "score">> = {
	0: { color: "var(--text-muted)", ink: "var(--text-muted)" },
	1: { color: "var(--color-aka)", ink: "var(--ink-aka)" },
	2: { color: "var(--color-kin)", ink: "var(--ink-kin)" },
	3: { color: "var(--color-midori)", ink: "var(--ink-midori)" },
};

/** Punteggio 0–3: lunghezza + varietà di caratteri. */
export function scorePassword(password: string): PasswordStrength {
	if (password.length < PASSWORD_MIN_LENGTH) return { score: 0, ...STRENGTH[0] };

	let points = 0;
	if (password.length >= 12) points++;
	if (password.length >= 16) points++;
	if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++;
	if (/\d/.test(password)) points++;
	if (/[^A-Za-z0-9]/.test(password)) points++;

	const score: PasswordScore = points >= 4 ? 3 : points >= 2 ? 2 : 1;
	return { score, ...STRENGTH[score] };
}

/**
 * Cosa c'è che non va nella coppia di password.
 *
 * Un CODICE e non una frase: la frase la compone il chiamante col proprio
 * dizionario. Entrambi i chiamanti sono server action, che il dizionario ce
 * l'hanno già — e restituire testo da qui avrebbe significato che una funzione
 * di regole debba conoscere la lingua dell'utente per fare il proprio lavoro.
 */
export type PasswordProblem = "tooShort" | "mismatch";

/** Ritorna il problema, oppure null se la coppia è valida. */
export function validateNewPassword(password: string, confirm: string): PasswordProblem | null {
	if (password.length < PASSWORD_MIN_LENGTH) return "tooShort";
	if (password !== confirm) return "mismatch";
	return null;
}
