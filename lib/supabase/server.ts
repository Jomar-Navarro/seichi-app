import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Il client Supabase di QUESTA richiesta.
 *
 * ⚠️ `cache()` non è un'ottimizzazione cosmetica. Senza, ogni loader ne creava
 * uno suo: la home ne istanziava cinque in parallelo (totali, transazioni,
 * obiettivi, account, notifiche), ognuno con la propria copia dei cookie e il
 * proprio client GoTrue. Con un'istanza sola per richiesta il rinnovo del token
 * scaduto avviene una volta, dentro il lock interno di GoTrue, invece che in
 * cinque corse parallele sullo stesso refresh token — che è monouso (la stessa
 * classe di difetto documentata nel proxy).
 *
 * La funzione non prende argomenti, quindi la memoizzazione è banalmente
 * corretta: c'è una sola chiave possibile.
 */
export const createClient = cache(async () => {
	const cookieStore = await cookies();

	return createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			cookies: {
				getAll() {
					return cookieStore.getAll();
				},
				setAll(cookiesToSet) {
					try {
						cookiesToSet.forEach(({ name, value, options }) =>
							cookieStore.set(name, value, options),
						);
					} catch {
						// The `setAll` method was called from a Server Component.
						// This can be ignored if you have middleware refreshing
						// user sessions.
					}
				},
			},
		},
	);
});

/** Il tipo del client, per gli helper che lo ricevono come parametro. */
export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
