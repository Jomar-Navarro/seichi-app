import { cookies } from "next/headers";
import BottomNav from "@/components/UI/BottomNav";
import Sidebar from "@/components/UI/Sidebar";
import MainContentShell from "@/components/UI/MainContentShell";
import TransactionModal from "@/components/UI/TransactionModal";
import AppLockProvider from "@/components/features/AppLockProvider";
import PwaStatus from "@/components/features/PwaStatus";
import { getSidebarProfile } from "@/lib/account";
import {
	APP_LOCK_ACTIVE_UNTIL_COOKIE,
	APP_LOCK_ENABLED_COOKIE,
	isLockedFromCookies,
} from "@/lib/app-lock";

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	/*
	 * Il footer della sidebar (issue #108) — avatar, nome, "N conti attivi" — e
	 * il suo costo, deciso qui in chiaro.
	 *
	 * La promise NON si attende: parte qui e arriva alla Sidebar come prop, che
	 * la legge con `use()` dentro un <Suspense> attorno al SOLO footer
	 * (node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md,
	 * "Streaming data with the `use` API"). Queste query non ritardano quindi
	 * la pagina: nel caso peggiore il footer mostra il segnaposto per un istante.
	 *
	 * Quanto costa: una HEAD count su `accounts` più la lettura di `profiles`,
	 * che però è CONDIVISA con la home via `cache()` (`loadProfileHeader` in
	 * lib/account.ts) — layout e pagina girano nello stesso render. E NON a ogni
	 * vista: questo layout non si ri-renderizza nelle navigazioni lato client
	 * (…/01-getting-started/03-layouts-and-pages.md: "On navigation, layouts
	 * preserve state, remain interactive, and do not rerender"), ma solo al
	 * caricamento completo, a `router.refresh()` e a `revalidatePath("/",
	 * "layout")` — che quasi ogni mutazione di questa app chiama, comprese
	 * quelle che cambiano ciò che il footer mostra (nome e foto in
	 * `impostazioni/account/actions.ts`, creazione, archiviazione ed
	 * eliminazione dei conti in `conti/actions.ts`): è ciò che lo tiene
	 * fresco. Il costo è per render del LAYOUT, non per pagina vista.
	 *
	 * ⚠️ Residuo dichiarato: la rail è `hidden lg:flex`, quindi sul telefono le
	 * due query girano per un footer che nessuno vede. Accettato perché quella
	 * su `profiles` è condivisa con la home — la pagina mobile principale, che
	 * la paga comunque — e il conteggio è una HEAD su una tabella minuscola.
	 *
	 * ⚠️ `getSidebarProfile()` non rifiuta mai e non fa mai `redirect()`: il
	 * perché è sulla funzione.
	 */
	const sidebarProfile = getSidebarProfile();

	// Fase 26a — letti qui, non nel client, per lo stesso motivo del tema
	// (Fase 18): il server deve già sapere se mostrare il velo, o un
	// fotogramma di dashboard vera passerebbe prima che il JS si idrati.
	// Vedi lib/app-lock.ts per cosa portano davvero questi due cookie.
	const store = await cookies();
	const initialLocked = isLockedFromCookies(
		store.get(APP_LOCK_ENABLED_COOKIE)?.value,
		store.get(APP_LOCK_ACTIVE_UNTIL_COOKIE)?.value,
	);

	return (
		<div
			className="overflow-x-hidden min-h-lvh flex flex-col"
			// issue #86 — nessuna pagina di `(main)` ha un header FISSO: sono tutte
			// scroll naturale con lo stesso `pt-7`/`pt-8` di apertura, copiato in
			// ~15 file. Un solo punto qui, ADDITIVO al padding di ognuna (0 su un
			// device senza notch, quindi nessun cambiamento lì), evita di toccarli
			// tutti per lo stesso motivo. In basso lo stesso ragionamento vale per
			// il margine oltre `BottomNav` — che ora galleggia più in alto della
			// home indicator, vedi BottomNav.tsx.
			style={{
				background: "var(--background)",
				color: "var(--text-primary)",
				paddingTop: "env(safe-area-inset-top)",
				paddingBottom: "env(safe-area-inset-bottom)",
			}}
		>
			<AppLockProvider initialLocked={initialLocked}>
				<Sidebar profile={sidebarProfile} />
				{/*
					⚠️ `PwaStatus` sta DENTRO il gutter, non accanto: fino alla 28a era
					un fratello di `MainContentShell`, quindi da `lg:` in su i suoi
					avvisi (rete assente, nuova versione) partivano da x = 20px — sotto
					la sidebar fissa, coperti per i primi 236px. Sotto `lg:` il
					contenitore non ha padding, e l'avviso resta dov'era: sopra la
					pagina, con lo stesso `px-5 pt-3`.
				*/}
				<MainContentShell>
					<PwaStatus />
					{children}
				</MainContentShell>
				<BottomNav />
				<TransactionModal />
			</AppLockProvider>
		</div>
	);
}
