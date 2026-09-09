import { cookies } from "next/headers";
import PageHeader from "@/components/UI/PageHeader";
import AppLockSettings from "@/components/features/AppLockSettings";
import AppLockPageShell from "@/components/features/AppLockPageShell";
import { getI18n } from "@/lib/i18n/server";
import { APP_LOCK_ENABLED_COOKIE } from "@/lib/app-lock";

export default async function BloccoPage() {
	const { t } = await getI18n();
	// Solo un suggerimento per il primo render, non la fonte di verità: il
	// PIN vero sta in localStorage, che il server non può leggere. Il client
	// verifica da sé al mount ed è quella la risposta che conta — questo
	// serve solo a evitare un lampo "Imposta PIN" su chi ne ha già uno.
	const initialHasPin = (await cookies()).get(APP_LOCK_ENABLED_COOKIE)?.value === "1";

	return (
		// Il `pb-*` giusto dipende da `fullScreenActive` (barra presente a
		// riposo, assente durante il wizard) — solo il client lo sa, da qui
		// il wrapper dedicato invece di un className statico qui.
		<AppLockPageShell>
			<PageHeader title={t.settings.pinLock} backHref="/impostazioni" />
			<AppLockSettings initialHasPin={initialHasPin} />
		</AppLockPageShell>
	);
}
