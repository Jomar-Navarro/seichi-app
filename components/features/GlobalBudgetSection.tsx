"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbulb, Repeat, Wallet } from "lucide-react";
import { getAvailableThisMonth, getGlobalBudget, setBudget } from "@/app/(main)/budget-actions";
import { useI18n } from "@/components/features/I18nProvider";
import { DISPLAY_CURRENCY, currencySymbol, fill, formatMoney } from "@/lib/i18n/format";
import { clientClock } from "@/lib/dates";

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
 *
 * Dalla **Fase 24a** la card porta anche il *disponibile* — entrate del mese
 * meno uscite fisse — e il suggerimento dell'importo, che la 17a aveva
 * esplicitamente rimandato. Sta qui e non in una schermata a sé perché un
 * importo consigliato lontano dal campo che dovrebbe riempire è un numero che
 * non si può accettare con un tocco.
 */
export default function GlobalBudgetSection() {
	const { locale, t } = useI18n();
	const [amount, setAmount] = useState("");
	/** valore confermato dal server: il confronto evita scritture inutili */
	const [current, setCurrent] = useState<number | null>(null);
	const [fixedOutflows, setFixedOutflows] = useState(0);
	/** `null` finché non letto: distingue "non lo so ancora" da "zero" */
	const [income, setIncome] = useState<number | null>(null);
	const [available, setAvailable] = useState<number | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	/** una lettura fallita NON è "nessun limite": senza distinguerle, il campo
	 *  mostrerebbe vuoto a chi un limite ce l'ha, e basterebbe scriverci sopra
	 *  per sostituirlo senza essersi accorti di nulla */
	const [loadFailed, setLoadFailed] = useState(false);
	/**
	 * ⚠️ Il tocco sul suggerimento arriva DOPO il blur del campo.
	 *
	 * Se hai scritto qualcosa nel campo e poi tocchi il suggerimento, il browser
	 * emette prima `blur` → `commit()`, che chiama `save()` e con `setSaving(true)`
	 * **disabilita il bottone**: il tocco viene ingoiato e viene salvato il valore
	 * DIGITATO invece di quello toccato — cioè l'opposto del gesto. Con tempi di
	 * flush diversi le due scritture si accavallano e il campo può mostrare un
	 * numero mentre il database ne contiene un altro.
	 *
	 * Il ref segna l'intenzione prima che il blur parta, e `commit()` gli cede il
	 * passo. Non è una preferenza di stile: due strade che scrivono lo stesso
	 * campo devono avere una precedenza dichiarata, non dedotta dall'ordine degli
	 * eventi del browser.
	 */
	const suggerimentoPremuto = useRef(false);

	useEffect(() => {
		let cancelled = false;
		const clock = clientClock();

		/*
		 * ⚠️ `getAvailableThisMonth` porta ANCHE le uscite fisse, quindi ha preso
		 * il posto di `getFixedOutflows`: chiamarle entrambe avrebbe calcolato due
		 * volte lo stesso numero, in due richieste, nella stessa schermata.
		 */
		Promise.all([getGlobalBudget(clock), getAvailableThisMonth(clock)]).then(
			([budgetRes, availRes]) => {
				if (cancelled) return;

				if ("error" in budgetRes) {
					setLoadFailed(true);
					setError(budgetRes.error);
				} else {
					setCurrent(budgetRes.data);
					setAmount(budgetRes.data === null ? "" : String(budgetRes.data));
				}

				if ("error" in availRes) {
					setLoadFailed(true);
					setError((prev) => prev ?? availRes.error);
				} else {
					setFixedOutflows(availRes.data.fixedOutflows);
					setIncome(availRes.data.income);
					setAvailable(availRes.data.available);
				}

				setLoading(false);
			},
		).catch((e) => {
			/*
			 * ⚠️ Senza questo ramo una server action che RIFIUTA — rete giù,
			 * eccezione non gestita a monte — lascia `loading` a `true` per
			 * sempre: campo disabilitato, le due righe ferme su "…", `loadFailed`
			 * mai alzato e nessun messaggio. Un'attesa che non finisce e non si
			 * spiega è la stessa classe già corretta nella Fase 21 (le server
			 * action dell'import senza `try/finally`) e nella 22.
			 */
			if (cancelled) return;
			setLoadFailed(true);
			setError(e instanceof Error ? e.message : String(e));
			setLoading(false);
		});

		return () => { cancelled = true; };
	}, []);

	/** La scrittura vera, condivisa fra il campo e il suggerimento: due strade
	 *  per lo stesso effetto non possono avere due gestioni dell'errore. */
	async function save(parsed: number | null): Promise<boolean> {
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
				return false;
			}
			setCurrent(parsed);
			return true;
		} catch (e) {
			/*
			 * ⚠️ `try/finally` senza `catch` spegneva `saving` e basta: una
			 * promise rifiutata non arrivava mai a `setError`, quindi il tocco sul
			 * suggerimento non faceva niente **e non diceva niente**. È il difetto
			 * peggiore possibile qui — chi lo usa conclude che il comando non
			 * esista, non che sia rotto — ed è quello già registrato nella Fase 22
			 * per `crypto.randomUUID()`.
			 */
			setError(fill(t.budget.saveFailed, { reason: e instanceof Error ? e.message : String(e) }));
			return false;
		} finally {
			setSaving(false);
		}
	}

	/**
	 * Salva all'uscita dal campo, come le preferenze salvano al cambio della
	 * select: un bottone "Salva" per un solo numero è un passo in più che le
	 * altre righe di questa pagina non chiedono.
	 */
	async function commit() {
		// Il suggerimento ha la precedenza: vedi la nota su `suggerimentoPremuto`.
		if (suggerimentoPremuto.current) return;

		const parsed = amount.trim() === "" ? null : Number(amount.replace(",", "."));

		if (parsed === current) return;
		if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
			setError(t.budget.amountMustBePositive);
			return;
		}

		await save(parsed);
	}

	const disabled = loading || saving || loadFailed;
	const negative = available !== null && available < 0;

	/*
	 * ⚠️ Il suggerimento compare SOLO quando un limite non c'è.
	 *
	 * Proporlo a chi ne ha già impostato uno più basso significherebbe invitarlo
	 * ad alzarlo — cioè a spendere di più — e quel limite più basso è una scelta
	 * deliberata, non una svista da correggere. Il disponibile è un TETTO, non
	 * un obiettivo da raggiungere: la differenza sta anche nel testo che
	 * accompagna il bottone.
	 */
	/*
	 * ⚠️ Si propone l'euro INTERO PER DIFETTO, e la ragione si è vista solo
	 * guardando lo schermo.
	 *
	 * La card arrotonda gli importi all'euro (`€ 52` per 51,90), quindi il
	 * disponibile esatto 5855,68 si legge «€ 5856». Proponendo il valore esatto,
	 * il bottone avrebbe detto «Imposta il limite a € 5856» e scritto nel campo
	 * 5855.68: un comando che dichiara un numero e ne applica un altro.
	 *
	 * Per DIFETTO e non al più vicino: arrotondando si proporrebbe un tetto più
	 * alto del disponibile reale — cioè un limite che, se speso tutto, manda il
	 * mese in negativo. Un tetto si abbassa, non si alza.
	 */
	const proposta = available === null ? 0 : Math.floor(available);
	const suggestion =
		!loading && !loadFailed && current === null && proposta >= 1 ? proposta : null;

	/** Il valore mostrato a destra, con i due stati di lettura già gestiti. */
	function readout(value: number) {
		if (loading) return "…";
		if (loadFailed) return "—";
		return formatMoney(value, { locale, currency: DISPLAY_CURRENCY });
	}

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
						<span className="text-[15px] font-semibold text-secondary">{currencySymbol(DISPLAY_CURRENCY, locale)}</span>
					</span>
					<span className="flex-1 min-w-0">
						<span className="block text-sm font-medium">{t.budget.monthlyLimit}</span>
						{/*
							"spese variabili" e non "spese totali": affitto e utenze sono
							categorie di tipo abbonamento e restano fuori da questo limite.
							Un numero che sembra il totale ma non lo è smette di essere creduto.
						*/}
						<span className="block text-xs text-muted truncate mt-0.5">
							{t.budget.variableOnly}
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
							placeholder={loading ? "…" : loadFailed ? "—" : t.budget.none}
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
							aria-label={t.budget.limitAriaLabel}
							className="w-20 px-2.5 py-1.5 rounded-lg text-right bg-input border border-subtle text-[13px] outline-none focus:border-muted placeholder:text-muted/60 disabled:opacity-50"
						/>
						<span className="text-[13px] text-muted">{t.budget.perMonth}</span>
					</span>
				</label>

				{/* Uscite fisse — sola lettura */}
				<div className="flex items-center gap-3 h-15.5 px-4 border-b border-subtle">
					<span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-control">
						<Repeat size={17} className="text-secondary" />
					</span>
					<span className="flex-1 min-w-0">
						<span className="block text-sm font-medium">{t.budget.fixedOutflows}</span>
						<span className="block text-xs text-muted truncate mt-0.5">
							{t.budget.fixedOutflowsHint}
						</span>
					</span>
					<span className="text-[13px] text-muted shrink-0">
						{readout(fixedOutflows)}
					</span>
				</div>

				{/*
					Disponibile — sola lettura (Fase 24a).

					⚠️ Il nome NON nomina lo stipendio: l'app non sa quale entrata lo
					sia, quindi somma tutte le entrate del mese. Vedi la nota su
					`getAvailableThisMonth()`.
				*/}
				<div className="flex items-center gap-3 h-15.5 px-4">
					<span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-control">
						<Wallet size={17} className="text-secondary" />
					</span>
					<span className="flex-1 min-w-0">
						<span className="block text-sm font-medium">{t.budget.available}</span>
						{/*
							⚠️ Con zero entrate registrate la sottrazione dà un numero
							negativo che è VERO ma si legge come un buco nei conti. Nei primi
							giorni del mese è invece il caso normale — lo stipendio non è
							ancora arrivato — e la frase lo dice al posto della formula.
						*/}
						<span className="block text-xs text-muted truncate mt-0.5">
							{income === 0 ? t.budget.availableNoIncome : t.budget.availableHint}
						</span>
					</span>
					{/*
						⚠️ Negativo in inchiostro, non in accento pieno: `--ink-aka` sta
						sopra 4,5:1 anche in tema chiaro, `--color-aka` no. E il positivo
						resta NEUTRO — avere margine non è un merito da premiare in verde,
						è semplicemente quanto resta.
					*/}
					<span className={`text-[13px] shrink-0 ${negative ? "text-aka-ink" : "text-muted"}`}>
						{available === null ? (loadFailed ? "—" : "…") : readout(available)}
					</span>
				</div>
			</div>

			{suggestion !== null && (
				<button
					type="button"
					onPointerDown={() => { suggerimentoPremuto.current = true; }}
					// Se il dito parte dal bottone e poi scivola via il click non
					// arriva: senza questo, `commit()` resterebbe zittito per sempre.
					onPointerLeave={() => { suggerimentoPremuto.current = false; }}
					onClick={() => {
						void (async () => {
							try {
								if (await save(suggestion)) setAmount(String(suggestion));
							} finally {
								suggerimentoPremuto.current = false;
							}
						})();
					}}
					disabled={saving}
					className="w-full mt-2 flex items-center gap-3 h-15.5 px-4 rounded-[22px] bg-card border border-subtle card-shadow text-left disabled:opacity-50"
				>
					<span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-control">
						{/*
							⚠️ Una lampadina, non una scintilla: questo numero è aritmetica,
							non un modello. Un'icona che promette l'AI su un calcolo
							deterministico è la stessa classe di difetto di un fumetto di chat
							sopra un referto — l'icona va scelta insieme a ciò che fa.
						*/}
						<Lightbulb size={17} className="text-secondary" />
					</span>
					<span className="flex-1 min-w-0">
						<span className="block text-sm font-medium">
							{fill(t.budget.useAvailable, {
								amount: formatMoney(suggestion, { locale, currency: DISPLAY_CURRENCY }),
							})}
						</span>
						<span className="block text-xs text-muted mt-0.5">
							{t.budget.useAvailableHint}
						</span>
					</span>
				</button>
			)}

			{error && (
				<p className="text-[11.5px] mt-2 ml-1" style={{ color: "var(--ink-aka)" }}>
					{loadFailed ? fill(t.budget.readFailed, { reason: error }) : error}
				</p>
			)}
		</>
	);
}
