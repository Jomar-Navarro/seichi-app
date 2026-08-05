"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
	applyThemeClass,
	resolveTheme,
	writeThemeCookies,
	type ResolvedTheme,
	type ThemeChoice,
} from "@/lib/theme";

interface ThemeContextValue {
	/** Cosa ha scelto l'utente — può essere "system". */
	choice: ThemeChoice;
	/** Cosa si sta effettivamente vedendo — mai "system". */
	resolved: ResolvedTheme;
	setChoice: (next: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error("useTheme va usato dentro <ThemeProvider>");
	return ctx;
}

interface ThemeProviderProps {
	/** Letti dai cookie nel root layout, così il primo render è già corretto. */
	initialChoice: ThemeChoice;
	initialResolved: ResolvedTheme;
	children: React.ReactNode;
}

export default function ThemeProvider({
	initialChoice,
	initialResolved,
	children,
}: ThemeProviderProps) {
	const [choice, setChoiceState] = useState<ThemeChoice>(initialChoice);
	const [resolved, setResolved] = useState<ResolvedTheme>(initialResolved);

	// Con la scelta su "sistema" il tema può cambiare mentre l'app è aperta (al
	// tramonto, su iOS). L'ascolto vive qui e non nel CSS perché il valore va
	// anche riscritto nel cookie: al prossimo caricamento deve saperlo il server.
	useEffect(() => {
		if (choice !== "system") return;

		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const sync = () => {
			const next: ResolvedTheme = mq.matches ? "dark" : "light";
			setResolved(next);
			applyThemeClass(next);
			writeThemeCookies("system", next);
		};

		// Anche subito, non solo al cambio: il cookie risolto può essere vecchio
		// di un'app chiusa e un sistema passato a chiaro nel frattempo.
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, [choice]);

	const setChoice = useCallback((next: ThemeChoice) => {
		const nextResolved = resolveTheme(next);
		setChoiceState(next);
		setResolved(nextResolved);
		// La classe cambia nel fotogramma corrente, il cookie serve al prossimo
		// caricamento: nessun round-trip al server, nessun refresh da attendere.
		applyThemeClass(nextResolved);
		writeThemeCookies(next, nextResolved);
	}, []);

	const value = useMemo(
		() => ({ choice, resolved, setChoice }),
		[choice, resolved, setChoice],
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
