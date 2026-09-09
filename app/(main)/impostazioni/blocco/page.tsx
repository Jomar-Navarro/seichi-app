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
		// pb-34 qui: è il valore giusto per il riposo (barra presente, come
		// ogni altra pagina di `(main)`). Durante il wizard la barra sparisce
		// (`fullScreenActive`, vedi BottomNav.tsx) e lo spazio che le
		// riserverebbe sarebbe vuoto — `AppLockSettings` lo corregge da sé sul
		// proprio contenitore per i soli passi attivi, perché è l'unico punto
		// che sa in quale stato si trova.
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			<PageHeader title={t.settings.pinLock} backHref="/impostazioni" />
			<AppLockSettings initialHasPin={initialHasPin} />
		</div>
	);
}
