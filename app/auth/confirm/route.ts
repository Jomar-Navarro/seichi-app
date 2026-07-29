import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";

// Gestisce i link via token_hash: conferma email e recupero password.
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const token_hash = searchParams.get("token_hash");
	const type = searchParams.get("type") as EmailOtpType | null;

	// Il recupero password passa `next=/reimposta-password`; per gli altri
	// link (conferma email) si resta sul default.
	const next = safeNext(searchParams.get("next"));

	// Redirect ripulito dal token, che non deve finire nella cronologia
	const redirectTo = request.nextUrl.clone();
	redirectTo.pathname = next;
	redirectTo.search = "";

	if (token_hash && type) {
		const supabase = await createClient();

		const { error } = await supabase.auth.verifyOtp({ type, token_hash });
		if (!error) {
			return NextResponse.redirect(redirectTo);
		}
	}

	redirectTo.pathname = "/error";
	return NextResponse.redirect(redirectTo);
}
