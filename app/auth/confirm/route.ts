import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";
import { markRecoverySession } from "@/lib/recovery";

/**
 * Gestisce i link email in forma `token_hash` + `type`.
 *
 * È la rotta usata dal recupero password, e non /callback, per un motivo
 * preciso: qui il tipo del token arriva esplicito da Supabase, quindi possiamo
 * emettere il marcatore di recupero SOLO per un vero token `recovery`.
 * Su /callback avremmo solo un `code` opaco, e qualunque scambio riuscito
 * (compreso un login OAuth costruito ad arte) sarebbe indistinguibile.
 *
 * Richiede che il template email "Reset Password" su Supabase punti qui —
 * vedi CLAUDE.md, sezione Auth Flow.
 */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const token_hash = searchParams.get("token_hash");
	const type = searchParams.get("type") as EmailOtpType | null;
	const next = safeNext(searchParams.get("next"));

	// Redirect ripulito dal token, che non deve finire nella cronologia
	const redirectTo = request.nextUrl.clone();
	redirectTo.pathname = next;
	redirectTo.search = "";

	if (token_hash && type) {
		const supabase = await createClient();

		const { error } = await supabase.auth.verifyOtp({ type, token_hash });
		if (!error) {
			if (type === "recovery") {
				await markRecoverySession();
			}
			return NextResponse.redirect(redirectTo);
		}
	}

	redirectTo.pathname = "/error";
	return NextResponse.redirect(redirectTo);
}
