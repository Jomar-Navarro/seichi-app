import { createClient } from "@/lib/supabase/server";
import { clearCurrencyCookie } from "@/lib/i18n/server";
import { revalidatePath } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
	const supabase = await createClient();

	// Check if a user's logged in
	const { data: claimsData } = await supabase.auth.getClaims();

	if (claimsData?.claims) {
		await supabase.auth.signOut();
	}
	// La valuta è dei dati di chi esce, non del dispositivo (#171).
	await clearCurrencyCookie();

	revalidatePath("/", "layout");
	return NextResponse.redirect(new URL("/sign", req.url), {
		status: 302,
	});
}
