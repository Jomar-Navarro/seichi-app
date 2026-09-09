import { cookies } from "next/headers";
import BottomNav from "@/components/UI/BottomNav";
import TransactionModal from "@/components/UI/TransactionModal";
import AppLockProvider from "@/components/features/AppLockProvider";
import PwaStatus from "@/components/features/PwaStatus";
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
				<PwaStatus />
				{children}
				<BottomNav />
				<TransactionModal />
			</AppLockProvider>
		</div>
	);
}
