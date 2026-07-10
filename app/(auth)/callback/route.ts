import { NextResponse } from "next/server";

// The client you created from the Server-Side Auth instructions
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
	const { searchParams, origin } = new URL(request.url);
	const code = searchParams.get("code");
	// if "next" is in param, use it as the redirect URL
	let next = searchParams.get("next") ?? "/";
	if (!next.startsWith("/")) {
		// if "next" is not a relative URL, use the default
		next = "/";
	}

	if (code) {
		const supabase = await createClient();
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
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
