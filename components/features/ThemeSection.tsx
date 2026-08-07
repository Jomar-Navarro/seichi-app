"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { type ThemeChoice } from "@/lib/theme";
import { fill } from "@/lib/i18n/format";
import { useI18n } from "./I18nProvider";
import { useTheme } from "./ThemeProvider";

/* "Siamo già idratati?" — `false` sul server e durante l'idratazione, `true`
   dopo. Non cambia mai, quindi non c'è nulla a cui iscriversi. Un
   useEffect+setState darebbe lo stesso risultato ma è un render a cascata, che
   il lint di React vieta: qui la differenza fra i due render è proprio ciò che
   useSyncExternalStore esiste per esprimere. */
const neverChanges = () => () => {};
const onClient = () => true;
const onServer = () => false;

const OPTIONS: { value: ThemeChoice; icon: typeof Sun }[] = [
	{ value: "light", icon: Sun },
	{ value: "dark", icon: Moon },
	{ value: "system", icon: Monitor },
];

export default function ThemeSection() {
	const { choice, resolved, setChoice } = useTheme();
	const { t } = useI18n();

	/*
	 * Con "sistema" `resolved` arriva dal server, che `prefers-color-scheme` non
	 * lo riceve negli header: alla primissima visita è un'ipotesi (scuro), e
	 * solo ThemeProvider la corregge al mount. Per i colori è il lampo già messo
	 * in conto; qui sarebbe una FRASE che dichiara il contrario di ciò che si
	 * vede ("ora scuro" su una pagina chiara). Fino al mount si dice quindi solo
	 * la parte che è vera comunque, e l'icona resta il monitor invece di
	 * scegliere fra sole e luna.
	 *
	 * Vale solo per "sistema": con una scelta esplicita il cookie è la fonte, e
	 * il primo render è già quello giusto.
	 */
	const hydrated = useSyncExternalStore(neverChanges, onClient, onServer);
	const knowsResolved = choice !== "system" || hydrated;

	const detail =
		choice === "system"
			? knowsResolved
				? fill(t.theme.followsSystemNow, { theme: t.theme[resolved] })
				: t.theme.followsSystem
			: fill(t.theme.always, { theme: t.theme[choice] });

	return (
		// La card e l'etichetta di sezione le mette SettingsGroup: rifarle qui
		// significava tenere allineati a mano quattro punti a ogni ritocco.
		<div className="p-4">
			<div className="flex items-center gap-3 mb-3.5">
				<span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-control">
					{!knowsResolved ? (
						<Monitor size={17} className="text-secondary" />
					) : resolved === "dark" ? (
						<Moon size={17} className="text-secondary" />
					) : (
						<Sun size={17} className="text-secondary" />
					)}
				</span>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium">{t.settings.groups.appearance}</p>
					<p className="text-[12.5px] text-muted mt-0.5 truncate">{detail}</p>
				</div>
			</div>

			<div
				className="grid grid-cols-3 gap-1 p-1 rounded-2xl segment-tab"
				role="radiogroup"
				aria-label={t.settings.groups.appearance}
			>
				{OPTIONS.map(({ value, icon: Icon }) => {
					const active = choice === value;
					return (
						<button
							key={value}
							type="button"
							role="radio"
							aria-checked={active}
							onClick={() => setChoice(value)}
							className={`flex items-center justify-center gap-2 h-10 rounded-xl text-[13px] font-medium cursor-pointer ${
								active ? "active-tab" : "text-muted active:opacity-70"
							}`}
						>
							<Icon size={15} />
							{t.theme[value]}
						</button>
					);
				})}
			</div>
		</div>
	);
}
