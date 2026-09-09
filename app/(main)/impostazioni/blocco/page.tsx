import { cookies } from "next/headers";
import PageHeader from "@/components/UI/PageHeader";
import AppLockSettings from "@/components/features/AppLockSettings";
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
		// `pb-12`, non `pb-34` come le altre pagine (main)`: questa route è in
		// `DOCUMENT_ROUTES` (BottomNav.tsx), la barra non c'è, e lo spazio che
		// le altre le riservano sarebbe vuoto e basta — la stessa scelta della
		// Fase 23b per `/analisi/report`.
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-12">
			<PageHeader title={t.settings.pinLock} backHref="/impostazioni" />
			<AppLockSettings initialHasPin={initialHasPin} />
		</div>
	);
}
