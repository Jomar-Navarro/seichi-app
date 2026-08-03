"use client";

import { useEffect, useState } from "react";
import { Repeat } from "lucide-react";
import { getFixedOutflows, getGlobalBudget, setBudget } from "@/app/(main)/budget-actions";
import { clientClock } from "@/lib/dates";

const euro = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 });

/**
 * Stesso involucro di PreferencesSection e SettingsGroup: card `bg-card`,
 * righe alte `h-15.5`, pastiglia icona `w-9 h-9`, valore a destra in
 * `text-[13px] text-muted`. Non usa SettingsRow perché il valore qui è un
 * campo scrivibile, non un testo — ma tutto il resto resta allineato.
 *
 * ⚠️ Carica i dati da sé invece di riceverli dalla pagina, che è un server
 * component. I periodi di budget si calcolano sul fuso dell'UTENTE, e un server
 * component non lo conosce: su Vercel direbbe UTC. Solo qui, nel browser,
 * `clientClock()` restituisce l'orologio giusto.
 */
export default function GlobalBudgetSection() {
	const [amount, setAmount] = useState("");
	/** valore confermato dal server: il confronto evita scritture inutili */
	const [current, setCurrent] = useState<number | null>(null);
	const [fixedOutflows, setFixedOutflows] = useState(0);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	/** una lettura fallita NON è "nessun limite": senza distinguerle, il campo
	 *  mostrerebbe vuoto a chi un limite ce l'ha, e basterebbe scriverci sopra
	 *  per sostituirlo senza essersi accorti di nulla */
	const [loadFailed, setLoadFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const clock = clientClock();

		Promise.all([getGlobalBudget(clock), getFixedOutflows(clock)]).then(
			([budgetRes, fixedRes]) => {
				if (cancelled) return;

				if ("error" in budgetRes) {
					setLoadFailed(true);
					setError(budgetRes.error);
				} else {
					setCurrent(budgetRes.data);
					setAmount(budgetRes.data === null ? "" : String(budgetRes.data));
				}

				if ("error" in fixedRes) {
					setLoadFailed(true);
					setError((prev) => prev ?? fixedRes.error);
				} else {
					setFixedOutflows(fixedRes.data);
				}

				setLoading(false);
			},
		);

		return () => { cancelled = true; };
	}, []);

	/**
	 * Salva all'uscita dal campo, come le preferenze salvano al cambio della
	 * select: un bottone "Salva" per un solo numero è un passo in più che le
	 * altre righe di questa pagina non chiedono.
	 */
	async function commit() {
		const parsed = amount.trim() === "" ? null : Number(amount.replace(",", "."));

		if (parsed === current) return;
		if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
			setError("Inserisci un importo maggiore di zero");
			return;
		}

		setSaving(true);
		setError(null);
		try {
			const res = await setBudget({
				categoryId: null,
				period: "mensile",
				amount: parsed,
				clock: clientClock(),
			});
			if ("error" in res) {
				setError(res.error);
				return;
			}
			setCurrent(parsed);
		} finally {
			setSaving(false);
		}
	}

	const disabled = loading || saving || loadFailed;

	return (
		<>
			<div
				className="rounded-[22px] bg-card border border-subtle card-shadow overflow-hidden"
				aria-busy={loading || saving}
			>
				{/*
					<label> e non <div>: così un tocco ovunque sulla riga porta il fuoco
					sul campo. L'input da solo sarebbe alto quanto una riga di testo,
					molto sotto i 44px di area toccabile — la riga è alta 62px.
				*/}
				<label className="flex items-center gap-3 h-15.5 px-4 border-b border-subtle cursor-text">
					<span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-control">
						<span className="text-[15px] font-semibold text-secondary">€</span>
					</span>
					<span className="flex-1 min-w-0">
						<span className="block text-sm font-medium">Limite mensile</span>
						{/*
							"spese variabili" e non "spese totali": affitto e utenze sono
							categorie di tipo abbonamento e restano fuori da questo limite.
							Un numero che sembra il totale ma non lo è smette di essere creduto.
						*/}
						<span className="block text-xs text-muted truncate mt-0.5">
							Solo spese variabili
						</span>
					</span>
					<span className="inline-flex items-center gap-1.5 shrink-0">
						{/*
							Sfondo `bg-input`, lo stesso di ogni altro campo dell'app: senza,
							il numero è indistinguibile dal valore di sola lettura di Valuta
							e Lingua, e nessuno prova a toccarlo.
						*/}
						<input
							type="text"
							inputMode="decimal"
							placeholder={loading ? "…" : loadFailed ? "—" : "nessuno"}
							value={amount}
							disabled={disabled}
							onChange={(e) => {
								setAmount(e.target.value);
								setError(null);
							}}
							onBlur={commit}
							onKeyDown={(e) => {
								if (e.key === "Enter") e.currentTarget.blur();
							}}
							aria-label="Limite di spesa mensile"
							className="w-20 px-2.5 py-1.5 rounded-lg text-right bg-input border border-subtle text-[13px] outline-none focus:border-muted placeholder:text-muted/60 disabled:opacity-50"
						/>
						<span className="text-[13px] text-muted">/ mese</span>
					</span>
				</label>

				{/* Uscite fisse — sola lettura */}
				<div className="flex items-center gap-3 h-15.5 px-4">
					<span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-control">
						<Repeat size={17} className="text-secondary" />
					</span>
					<span className="flex-1 min-w-0">
						<span className="block text-sm font-medium">Uscite fisse previste</span>
						<span className="block text-xs text-muted truncate mt-0.5">
							Abbonamenti di questo mese, fuori dal limite
						</span>
					</span>
					<span className="text-[13px] text-muted shrink-0">
						{loading ? "…" : loadFailed ? "—" : `€ ${euro.format(fixedOutflows)}`}
					</span>
				</div>
			</div>

			{error && (
				<p className="text-[11.5px] mt-2 ml-1" style={{ color: "var(--color-aka)" }}>
					{loadFailed ? `Impossibile leggere il budget: ${error}` : error}
				</p>
			)}
		</>
	);
}
