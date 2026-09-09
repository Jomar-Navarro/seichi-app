"use client";

import type { ReactNode } from "react";
import { useUIStore } from "@/store/useUIStore";

/**
 * Il contenitore di `/impostazioni/blocco` — separato dalla pagina (Server
 * Component) perché il `pb-*` giusto dipende da `fullScreenActive`
 * (Zustand), che solo il client conosce.
 *
 * ⚠️ Trovato dal code-review: il primo tentativo di correggere lo spazio
 * vuoto sotto il wizard applicava un `margin-bottom` NEGATIVO al contenuto
 * di `AppLockSettings`, sperando di "annullare" il `pb-34` della pagina.
 * Non poteva funzionare — misurato: zero effetto, ~130px di vuoto restavano
 * identici. Margine e padding sono due proprietà del box model
 * INDIPENDENTI: il margine di un figlio non riduce il padding di un
 * antenato, può solo spostare la posizione del figlio stesso. L'unico modo
 * corretto è cambiare il `pb-*` VERO, e per farlo serve sapere
 * `fullScreenActive` — che un Server Component non può leggere.
 */
export default function AppLockPageShell({ children }: { children: ReactNode }) {
	const fullScreenActive = useUIStore((s) => s.fullScreenActive);

	return (
		// pb-34 a riposo (barra presente, come ogni altra pagina di `(main)`),
		// pb-12 durante il wizard (barra assente, stesso valore di
		// `/analisi/report` — Fase 23b, la stessa idea di "route documento"
		// applicata qui a un solo STATO invece che all'intera pagina).
		<div className={`flex flex-col min-h-dvh px-5 pt-7 ${fullScreenActive ? "pb-12" : "pb-34"}`}>
			{children}
		</div>
	);
}
