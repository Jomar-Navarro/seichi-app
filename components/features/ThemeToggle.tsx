"use client";

import { Sun } from "lucide-react";
import Switch from "@/components/UI/Switch";
import { useTheme } from "./ThemeProvider";

/**
 * Scorciatoia nel menu profilo (dal mockup "Seichi Dashboard").
 *
 * È binario, quindi non sa esprimere "sistema": riflette ciò che si sta
 * VEDENDO e, se toccato, fissa una scelta esplicita. Chi vuole tornare a
 * seguire il sistema lo fa da /impostazioni, dove i tre stati ci stanno.
 */
export default function ThemeToggle() {
	const { resolved, setChoice } = useTheme();
	const dark = resolved === "dark";

	return (
		<div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-subtle">
			<span className="flex items-center gap-3 text-sm font-medium">
				<Sun size={16} className="text-secondary" />
				Modalità scura
			</span>
			<Switch
				checked={dark}
				onChange={(next) => setChoice(next ? "dark" : "light")}
				label="Modalità scura"
			/>
		</div>
	);
}
