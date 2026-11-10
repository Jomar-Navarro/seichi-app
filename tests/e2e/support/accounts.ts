import { randomBytes, randomUUID } from "node:crypto";
import { localSupabase, TEST_EMAIL_DOMAIN } from "./env";

/**
 * Gli account di prova (#156). Ogni test ne crea uno suo e lo elimina alla
 * fine: niente stato condiviso fra test, quindi possono girare in parallelo e
 * in qualunque ordine.
 *
 * L'utente nasce dall'API admin del Supabase LOCALE (con la sua chiave
 * segreta, che è quella pubblica della CLI) già confermato, così non dipende da
 * *Confirm email*. Il resto lo scrive col PROPRIO token, sotto RLS, come
 * farebbe l'app: un dato che la RLS rifiuterebbe all'utente non deve entrare
 * nei test dalla porta di servizio. La registrazione dal form vero la prova il
 * suo scenario.
 */
export type TestAccount = {
	id: string;
	email: string;
	password: string;
	token: string;
	/** REST di PostgREST col token dell'utente. Solleva su una risposta non 2xx. */
	rest: <T = unknown>(method: string, path: string, body?: unknown, prefer?: string) => Promise<T>;
};

function admin(path: string, init: RequestInit = {}) {
	const sb = localSupabase();
	return fetch(`${sb.url}/auth/v1/admin/${path}`, {
		...init,
		headers: { apikey: sb.secretKey, Authorization: `Bearer ${sb.secretKey}`, "Content-Type": "application/json", ...init.headers },
	});
}

export function testEmail() {
	return `e2e-${randomUUID().slice(0, 8)}@${TEST_EMAIL_DOMAIN}`;
}

export function testPassword() {
	return `Prova-${randomBytes(9).toString("base64url")}!7`;
}

/** Il token di una sessione, dal login con password (quello che fa il form). */
export async function passwordToken(email: string, password: string) {
	const sb = localSupabase();
	const res = await fetch(`${sb.url}/auth/v1/token?grant_type=password`, {
		method: "POST",
		headers: { apikey: sb.publishableKey, "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
	const body = await res.json();
	if (!res.ok) throw new Error(`login di ${email}: ${res.status} ${JSON.stringify(body)}`);
	return body as { access_token: string; user: { id: string } };
}

export function restAs(token: string): TestAccount["rest"] {
	const sb = localSupabase();
	return async (method, path, body, prefer = "return=representation") => {
		const res = await fetch(`${sb.url}/rest/v1/${path}`, {
			method,
			headers: {
				apikey: sb.publishableKey,
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				Prefer: prefer,
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const text = await res.text();
		if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text}`);
		return (text ? JSON.parse(text) : null) as never;
	};
}

export async function createTestAccount(fullName = "Prova Collaudo"): Promise<TestAccount> {
	const email = testEmail();
	const password = testPassword();
	const res = await admin("users", {
		method: "POST",
		// `full_name` lo copia in `profiles` il trigger `handle_new_user()`.
		body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
	});
	if (!res.ok) throw new Error(`creazione di ${email}: ${res.status} ${await res.text()}`);
	const { access_token, user } = await passwordToken(email, password);
	return { id: user.id, email, password, token: access_token, rest: restAs(access_token) };
}

/** Utente per utente: le FK verso `auth.users` sono in cascata. */
export async function deleteUser(id: string) {
	const res = await admin(`users/${id}`, { method: "DELETE" });
	if (!res.ok && res.status !== 404) throw new Error(`eliminazione di ${id}: ${res.status} ${await res.text()}`);
}

export async function findUserByEmail(email: string) {
	return (await listTestUsers()).find((u) => u.email === email) ?? null;
}

/** Tutti gli utenti col dominio dei test, a pagine (l'API ne dà 50 per volta). */
export async function listTestUsers() {
	const found: { id: string; email: string }[] = [];
	for (let page = 1; page < 100; page++) {
		const res = await admin(`users?page=${page}&per_page=200`);
		if (!res.ok) throw new Error(`elenco utenti: ${res.status} ${await res.text()}`);
		const { users } = (await res.json()) as { users: { id: string; email: string }[] };
		found.push(...users.filter((u) => u.email?.endsWith(`@${TEST_EMAIL_DOMAIN}`)));
		if (users.length < 200) break;
	}
	return found;
}
