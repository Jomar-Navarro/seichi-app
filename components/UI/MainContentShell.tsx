"use client";

import type { ReactNode } from "react";
import { useNavHidden } from "./useNavVisibility";

/**
 * Il gutter della sidebar (Fase 28a) — `{children}` di `(main)/layout.tsx`
 * passa da qui perché la larghezza riservata dipende da `fullScreenActive`
 * (Zustand), che un Server Component non può leggere.
 *
 * Stessa condizione di `Sidebar.tsx` (`useNavHidden`): il gutter sparisce
 * esattamente quando la sidebar sparisce — mai uno spazio vuoto lasciato da
 * chi non c'è più a riempirlo.
 */
export default function MainContentShell({ children }: { children: ReactNode }) {
	const hidden = useNavHidden();

	return <div className={`flex flex-col flex-1 min-w-0 ${hidden ? "" : "lg:pl-64"}`}>{children}</div>;
}
