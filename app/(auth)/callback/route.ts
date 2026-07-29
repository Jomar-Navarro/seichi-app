import { NextResponse } from "next/server";

// The client you created from the Server-Side Auth instructions
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";
import { markRecoverySession } from "@/lib/recovery";

const RESET_PATH = "/reimposta-password";

// LIMITE NOTO: qui arriva un `code` opaco, e uno scambio riuscito non dice nulla
// sul tipo di token. Emettere il marcatore di recupero in base al solo `next`
// significa che un login OAuth costruito a mano con `next=/reimposta-password`
// otterrebbe lo stesso marcatore, scavalcando la riautenticazione che protegge
// il cambio password.
//
// La chiusura pulita è far passare il recupero da /auth/confirm, dove
// `type=recovery` è esplicito — ma richiede un template email custom, che
// Supabase concede solo con SMTP personalizzato. Finché non c'è, si accetta
// questo residuo: l'attacco richiede accesso fisico a un dispositivo sbloccato
// più la costruzione manuale dell'URL di authorize.
export async function GET(request: Request) {
	const { searchParams, origin } = new URL(request.url);
	const code = searchParams.get("code");
	// `next` arriva dall'URL: accettiamo solo percorsi interni (no open redirect)
	let next = safeNext(searchParams.get("next"));

	if (code) {
		const supabase = await createClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			if (next === RESET_PATH) {
				await markRecoverySession();
			}

			// Redirect new users (no onboarding completed) to /start
			if (next === "/") {
				const { data: { user } } = await supabase.auth.getUser();
				if (user) {
					const { data: profile } = await supabase
						.from("profiles")
						.select("currency")
						.eq("id", user.id)
						.single();
					if (!profile?.currency) {
						next = "/start";
					}
				}
			}

			const forwardedHost = request.headers.get("x-forwarded-host");
			const isLocalEnv = process.env.NODE_ENV === "development";
			if (isLocalEnv) {
				return NextResponse.redirect(`${origin}${next}`);
			} else if (forwardedHost) {
				return NextResponse.redirect(`https://${forwardedHost}${next}`);
			} else {
				return NextResponse.redirect(`${origin}${next}`);
			}
		}
	}

	// return the user to an error page with instructions
	return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
