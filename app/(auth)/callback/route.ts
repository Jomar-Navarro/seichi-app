import { NextResponse } from "next/server";

// The client you created from the Server-Side Auth instructions
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";
import { markRecoverySession } from "@/lib/recovery";

const RESET_PATH = "/reimposta-password";

export async function GET(request: Request) {
	const { searchParams, origin } = new URL(request.url);
	const code = searchParams.get("code");
	// `next` arriva dall'URL: accettiamo solo percorsi interni (no open redirect)
	let next = safeNext(searchParams.get("next"));

	if (code) {
		const supabase = await createClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			// Il link di recupero password è l'unica cosa che punta qui con questo
			// `next`: solo in quel caso emettiamo il marcatore che sblocca il
			// cambio password senza conoscere quella attuale.
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
