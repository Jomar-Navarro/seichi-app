/**
 * URL pubblico dell'app, base di ogni link che finisce dentro un'email:
 * conferma registrazione, recupero password, conferma cambio email.
 *
 * Nessun fallback su localhost. Un default silenzioso significherebbe che un
 * deploy senza `NEXT_PUBLIC_SITE_URL` continua a funzionare in apparenza ma
 * spedisce link a `http://localhost:3000` — e le action rispondono comunque
 * `{ success: true }`, quindi la UI dice "controlla la tua email" mentre
 * l'utente riceve un indirizzo che sul suo dispositivo non porta da nessuna
 * parte. Il recupero password sarebbe irraggiungibile senza un solo errore da
 * nessuna parte. Meglio fallire al build, come già fa next.config.ts con
 * NEXT_PUBLIC_SUPABASE_URL.
 *
 * In sviluppo basta la riga già presente in .env.local.
 */
if (!process.env.NEXT_PUBLIC_SITE_URL) {
	throw new Error(
		"NEXT_PUBLIC_SITE_URL non è definita: è la base dei link inviati per email (conferma registrazione, recupero password, cambio email). Controlla .env.local (o le env del deploy).",
	);
}

/** Senza slash finale: i chiamanti concatenano path che iniziano già con "/". */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
