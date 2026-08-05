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
	label: string;
	/** Riempimento delle barre: l'accento pieno. */
	color: string;
	/** L'etichetta sotto le barre: l'inchiostro, o in chiaro resta a ~3,4:1. */
	ink: string;
}

const STRENGTH: Record<PasswordScore, Omit<PasswordStrength, "score">> = {
	0: { label: "troppo corta", color: "var(--text-muted)", ink: "var(--text-muted)" },
	1: { label: "sicurezza bassa", color: "var(--color-aka)", ink: "var(--ink-aka)" },
	2: { label: "sicurezza media", color: "var(--color-kin)", ink: "var(--ink-kin)" },
	3: { label: "sicurezza alta", color: "var(--color-midori)", ink: "var(--ink-midori)" },
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

/** Ritorna il messaggio d'errore, oppure null se la coppia è valida. */
export function validateNewPassword(password: string, confirm: string): string | null {
	if (password.length < PASSWORD_MIN_LENGTH) {
		return `La password deve essere di almeno ${PASSWORD_MIN_LENGTH} caratteri`;
	}
	if (password !== confirm) return "Le password non corrispondono";
	return null;
}
