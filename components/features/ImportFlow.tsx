"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, FileText, Info, Plus, Undo2, Upload } from "lucide-react";
import Select from "@/components/UI/Select";
import { useI18n } from "@/components/features/I18nProvider";
import { fill, formatDate, formatNumber, lookup, plural } from "@/lib/i18n/format";
import { categoryTypeFor, formatAmount, TIPO_COLOR, TIPO_INK } from "@/lib/transaction-utils";
import type { AmountSign } from "@/lib/transaction-utils";
import { accountColor } from "@/lib/accounts";
import type { Locale } from "@/lib/i18n/config";
import { analyzeImport, runImport, undoImport } from "@/app/(main)/impostazioni/importa/actions";
import { createAccount } from "@/app/(main)/conti/actions";
import type {
	GenericMapping,
	GroupDecision,
	GroupTarget,
	ImportAnalysis,
	ImportOutcome,
	ImportSummary,
	ParsedGroup,
	ParsedRow,
	ParseResult,
} from "@/lib/import";

export interface ImportAccount {
	id: string;
	name: string;
	type: string | null;
	icon: string | null;
	color: string | null;
}

export interface ImportCategory {
	id: string;
	name: string;
	type: string;
	icon: string;
}

interface Props {
	accounts: ImportAccount[];
	categories: ImportCategory[];
	/** Gli import già eseguiti, da cui si annulla. */
	previous: ImportSummary[];
}

/** Valore sentinella del selettore conto: "creane uno nuovo". */
const NEW_ACCOUNT = "__nuovo__";

type Step = "file" | "gruppi" | "riepilogo" | "fatto";

/** Quale segmento della barra è acceso. `fatto` resta sul terzo: è la fine. */
const STEP_INDEX: Record<Step, number> = { file: 0, gruppi: 1, riepilogo: 2, fatto: 2 };

/**
 * Il flusso di import in tre passi — file, gruppi, conferma.
 *
 * ⚠️ **Il passo centrale decide per GRUPPO, non per riga**, ed è lo scostamento
 * voluto dal mockup, che mostrava una lista di transazioni con una pastiglia
 * "seleziona categoria" ciascuna. Su un estratto vero — tre anni di Trade
 * Republic, circa duecento righe — quella forma chiede duecento scelte per
 * ottenerne quindici: tutti gli acquisti sono investimenti, tutti gli interessi
 * sono entrate, tutti i bonifici da uno stesso IBAN vengono dallo stesso conto.
 * Le righe restano ispezionabili aprendo il gruppo; è la DECISIONE che si
 * accorpa, non l'informazione.
 */
export default function ImportFlow({ accounts, categories, previous }: Props) {
	const { t, locale } = useI18n();
	const router = useRouter();

	const [step, setStep] = useState<Step>("file");
	const [file, setFile] = useState<File | null>(null);
	const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
	const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
	const [mapping, setMapping] = useState<GenericMapping | null>(null);
	const [decisions, setDecisions] = useState<Map<string, GroupDecision>>(new Map());
	const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [undone, setUndone] = useState(false);
	const [confirmUndo, setConfirmUndo] = useState(false);
	/*
	 * ⚠️ I conti creati durante il flusso si tengono a parte e si FONDONO con la
	 * prop, invece di sostituirla. `createAccount()` fa `revalidatePath`, quindi
	 * prima o poi il conto nuovo arriva anche dal server: sovrascrivere la lista
	 * lo farebbe comparire due volte, ignorare la prop lo farebbe sparire al
	 * primo aggiornamento. La fusione per id regge entrambi i casi.
	 */
	const [created, setCreated] = useState<ImportAccount[]>([]);
	const known = useMemo(() => {
		const byId = new Map(accounts.map((a) => [a.id, a]));
		for (const a of created) if (!byId.has(a.id)) byId.set(a.id, a);
		return [...byId.values()];
	}, [accounts, created]);

	const inputRef = useRef<HTMLInputElement>(null);

	/*
	 * ⚠️ Il file si ANALIZZA appena scelto, non al "Continua", e lo spostamento
	 * ha una ragione precisa: solo dopo l'analisi si sa QUALE profilo è — e
	 * quindi si può avvertire che un estratto Trade Republic vuole il conto
	 * Trade Republic. Analizzando dopo, quell'avviso arriverebbe a scelta già
	 * fatta, cioè troppo tardi per servire a qualcosa.
	 */
	/**
	 * ⚠️ Il numero d'ordine dell'ultima analisi chiesta.
	 *
	 * Scegliendo due file in rapida successione, la risposta del PRIMO può
	 * arrivare dopo quella del secondo e sovrascriverla: si finirebbe con il file
	 * B in mano e i gruppi del file A, cioè decisioni prese su righe che non
	 * verranno importate. Solo la risposta più recente ha diritto di scrivere.
	 */
	const analysisSeq = useRef(0);

	async function pickFile(next: File | null) {
		analysisSeq.current += 1;
		setFile(next);
		setAnalysis(null);
		setMapping(null);
		setDecisions(new Map());
		setError(null);
		if (next) await analyse(next, null);
	}

	async function analyse(f: File, m: GenericMapping | null): Promise<ImportAnalysis | null> {
		const seq = (analysisSeq.current += 1);
		setPending(true);
		setError(null);

		const form = new FormData();
		form.set("file", f);
		if (m) form.set("mapping", JSON.stringify(m));

		try {
			const res = await analyzeImport(form);
			// Una scelta più recente ha già vinto: questa risposta è vecchia.
			if (seq !== analysisSeq.current) return null;

			if ("error" in res) {
				setError(res.error);
				setAnalysis(null);
				return null;
			}

			setAnalysis(res.data);
			return res.data;
		} catch {
			if (seq === analysisSeq.current) setError(t.common.genericError);
			return null;
		} finally {
			/*
			 * ⚠️ `finally`, non una riga dopo l'await: se la server action rifiuta
			 * — rete caduta, deploy in corso — `pending` resterebbe `true` e il
			 * flusso si bloccherebbe senza un messaggio e senza un modo di uscirne.
			 * È la forma usata da ogni altro componente di questo repo.
			 */
			if (seq === analysisSeq.current) setPending(false);
		}
	}

	/**
	 * Le decisioni partono dai suggerimenti del profilo. I gruppi senza proposta
	 * (`suggested === null`) restano fuori dalla mappa: è ciò che tiene spento il
	 * pulsante finché l'utente non li guarda.
	 */
	function startGroups(parsed: ParseResult) {
		const next = new Map<string, GroupDecision>();
		for (const g of parsed.groups) {
			if (g.suggested !== null) {
				next.set(g.id, {
					groupId: g.id,
					target: g.suggested,
					categoryId: null,
					counterpartAccountId: null,
				});
			}
		}
		setDecisions(next);
		setStep("gruppi");
	}

	async function continueFromFile() {
		if (!file || !accountId) return;
		if (analysis?.kind === "letto") {
			startGroups(analysis.result);
			return;
		}
		// Profilo non riconosciuto: si rilegge con la mappatura appena indicata.
		if (mapping) {
			const a = await analyse(file, mapping);
			if (a?.kind === "letto") startGroups(a.result);
		}
	}

	function decide(groupId: string, patch: Partial<GroupDecision>) {
		setDecisions((prev) => {
			const next = new Map(prev);
			const current = next.get(groupId) ?? {
				groupId,
				target: "ignora" as GroupTarget,
				categoryId: null,
				counterpartAccountId: null,
			};
			const merged = { ...current, ...patch };
			// Cambiando bersaglio, categoria e controparte del bersaglio
			// precedente non hanno più senso: tenerle vorrebbe dire spedire al
			// server una categoria di tipo sbagliato, che l'action rifiuta.
			if (patch.target !== undefined && patch.target !== current.target) {
				merged.categoryId = null;
				merged.counterpartAccountId = null;
			}
			next.set(groupId, merged);
			return next;
		});
	}

	const result = analysis?.kind === "letto" ? analysis.result : null;

	/** Un gruppo è risolto se ha una decisione, e se un trasferimento ha l'altro capo. */
	function resolved(g: ParsedGroup): boolean {
		const d = decisions.get(g.id);
		if (!d) return false;
		if (d.target === "trasferimento") return Boolean(d.counterpartAccountId);
		return true;
	}

	const pendingGroups = result?.groups.filter((g) => !resolved(g)) ?? [];

	/**
	 * Quante righe verrebbero scritte.
	 *
	 * ⚠️ Non è il numero che comparirà alla fine, e la differenza è dichiarata
	 * invece che nascosta: quante di queste risultino già presenti lo decide il
	 * vincolo di unicità nel database, quindi si sa solo DOPO. Il mockup metteva
	 * "42 da importare · 3 duplicati ignorati" nella stessa schermata di conferma,
	 * cioè prometteva prima dell'import un numero conoscibile solo dopo.
	 */
	const toImport =
		result?.rows.filter((r) => {
			const d = decisions.get(r.groupId);
			return d && d.target !== "ignora";
		}).length ?? 0;

	const ignored = (result?.rows.length ?? 0) - toImport;

	async function confirm() {
		if (!file || !result) return;
		setPending(true);
		setError(null);

		const form = new FormData();
		form.set("file", file);
		form.set("accountId", accountId);
		form.set("decisions", JSON.stringify([...decisions.values()]));
		if (mapping) form.set("mapping", JSON.stringify(mapping));

		try {
			const res = await runImport(form);
			if ("error" in res) {
				setError(res.error);
				return;
			}
			setOutcome(res.data);
			setStep("fatto");
		} catch {
			setError(t.common.genericError);
		} finally {
			setPending(false);
		}
	}

	async function undo() {
		if (!outcome?.importId) return;
		setPending(true);
		setError(null);
		try {
			const res = await undoImport(outcome.importId);
			if ("error" in res) {
				setError(res.error);
				return;
			}
			setConfirmUndo(false);
			setUndone(true);
		} catch {
			setError(t.common.genericError);
		} finally {
			setPending(false);
		}
	}

	if (accounts.length === 0) {
		return (
			<p className="text-sm text-muted rounded-3xl bg-card border border-subtle p-5">
				{t.import.file.noAccounts}
			</p>
		);
	}

	return (
		<div className="flex flex-col grow">
			<StepBar index={STEP_INDEX[step]} />

			{error && (
				<p
					className="text-[13px] rounded-2xl px-4 py-3 mb-4 border"
					style={{
						color: "var(--ink-aka)",
						borderColor: "color-mix(in srgb, var(--color-aka) 30%, transparent)",
						background: "color-mix(in srgb, var(--color-aka) 10%, transparent)",
					}}
				>
					{error}
				</p>
			)}

			{step === "file" && (
				<FileStep
					file={file}
					accounts={known}
					accountId={accountId}
					onAccount={setAccountId}
					onCreated={(a) => setCreated((prev) => [...prev, a])}
					onPick={pickFile}
					inputRef={inputRef}
					analysis={analysis}
					mapping={mapping}
					onMapping={setMapping}
					pending={pending}
					onContinue={continueFromFile}
					previous={previous}
					onUndone={() => router.refresh()}
				/>
			)}

			{step === "gruppi" && result && (
				<>
					<div className="mb-4">
						<p className="text-base font-semibold">
							{plural(t.import.preview.found, result.rows.length, locale)}
						</p>
						<p className="text-[12.5px] text-muted mt-0.5">{t.import.preview.explain}</p>
					</div>

					<div className="flex flex-col gap-3">
						{result.groups.map((g, i) => (
							<GroupCard
								key={g.id}
								group={g}
								decision={decisions.get(g.id) ?? null}
								rows={result.rows.filter((r) => r.groupId === g.id)}
								accounts={known}
								onCreated={(a) => setCreated((prev) => [...prev, a])}
								categories={categories}
								fileAccountId={accountId}
								onChange={(patch) => decide(g.id, patch)}
								/*
								 * ⚠️ z-index decrescente, e senza non si vedrebbe.
								 * Ogni card ha `backdrop-blur`, che crea un CONTESTO DI
								 * IMPILAMENTO: il menu a tendina di un `Select` resta
								 * quindi confinato dentro la propria card, e la card
								 * successiva — che viene dopo nel DOM — ci finisce sopra.
								 * Il menu del primo gruppo sparirebbe sotto il secondo,
								 * senza che nulla nel codice del `Select` sia sbagliato.
								 */
								zIndex={result.groups.length - i}
							/>
						))}
					</div>

					<div className="grow" />
					{/*
						⚠️ NON sticky, e la prima versione lo era. Un `bottom-0` mette il
						pulsante esattamente dove sta la `BottomNav` — che è `fixed`,
						z-40, con una fascia sfocata sopra — quindi il comando principale
						della schermata finiva sotto la navigazione. Combattere quello
						stack a colpi di z-index avrebbe funzionato; stare nel flusso,
						come ogni altra pagina di questa app, funziona senza spiegazioni.
					*/}
					<div className="pt-6">
						{pendingGroups.length > 0 && (
							<p className="text-[12.5px] text-muted text-center mb-2">
								{plural(t.import.preview.undecided, pendingGroups.length, locale)}
							</p>
						)}
						<button
							type="button"
							disabled={pendingGroups.length > 0 || toImport === 0}
							onClick={() => setStep("riepilogo")}
							className="btn-primary w-full h-13 rounded-[17px] text-[15px] font-semibold disabled:opacity-40"
						>
							{t.import.preview.continue}
						</button>
					</div>
				</>
			)}

			{step === "riepilogo" && result && (
				<div className="flex flex-col grow justify-center gap-6">
					<div className="rounded-[26px] bg-surface border border-subtle card-shadow backdrop-blur-xl overflow-hidden">
						<div className="flex items-center gap-3 p-4.5 border-b border-subtle">
							<span className="w-9 h-9 rounded-xl bg-control flex items-center justify-center shrink-0">
								<FileText size={16} className="text-secondary" />
							</span>
							<div className="min-w-0">
								<p className="text-[13.5px] font-medium truncate">{file?.name}</p>
								<p className="text-[11.5px] text-muted mt-0.5">
									{formatKb(file?.size ?? 0, locale)}
								</p>
							</div>
						</div>
						<div className="p-5 flex flex-col gap-3.5">
							<SummaryLine
								tone={TIPO_COLOR.entrata}
								text={plural(t.import.summary.toImport, toImport, locale)}
							/>
							{ignored > 0 && (
								<SummaryLine muted text={plural(t.import.summary.ignored, ignored, locale)} />
							)}
							{result.unreadable > 0 && (
								<SummaryLine
									muted
									text={plural(t.import.summary.unreadable, result.unreadable, locale)}
								/>
							)}
						</div>
					</div>

					<button
						type="button"
						disabled={pending}
						onClick={confirm}
						className="btn-primary w-full h-13 rounded-[18px] text-[15.5px] font-semibold disabled:opacity-50"
					>
						{pending ? t.import.summary.importing : t.import.summary.confirm}
					</button>
				</div>
			)}

			{step === "fatto" && outcome && (
				<div className="flex flex-col grow justify-center gap-6">
					<div className="rounded-[26px] bg-surface border border-subtle card-shadow backdrop-blur-xl p-6 flex flex-col gap-3.5">
						<p className="text-lg font-semibold">{t.import.done.title}</p>
						{outcome.imported === 0 ? (
							<p className="text-sm text-muted">{t.import.done.nothing}</p>
						) : (
							<SummaryLine
								tone={TIPO_COLOR.entrata}
								text={plural(t.import.done.imported, outcome.imported, locale)}
							/>
						)}
						{outcome.skipped > 0 && (
							<SummaryLine muted text={plural(t.import.done.skipped, outcome.skipped, locale)} />
						)}
					</div>

					{outcome.importId && !undone && (
						<div className="flex flex-col gap-3">
							{confirmUndo ? (
								<div className="rounded-[22px] border border-subtle bg-card p-4.5">
									<p className="text-sm font-semibold mb-1">{t.import.done.undoTitle}</p>
									<p className="text-[12.5px] text-muted mb-4">{t.import.done.undoBody}</p>
									<div className="flex gap-2.5">
										<button
											type="button"
											onClick={() => setConfirmUndo(false)}
											className="flex-1 h-11 rounded-2xl border border-subtle bg-control text-sm font-medium"
										>
											{t.import.done.undoCancel}
										</button>
										<button
											type="button"
											disabled={pending}
											onClick={undo}
											className="flex-1 h-11 rounded-2xl text-sm font-semibold disabled:opacity-50"
											style={{
												color: "var(--on-accent)",
												background: "var(--color-aka)",
											}}
										>
											{t.import.done.undoConfirm}
										</button>
									</div>
								</div>
							) : (
								<button
									type="button"
									onClick={() => setConfirmUndo(true)}
									className="text-[13px] font-medium"
									style={{ color: "var(--ink-aka)" }}
								>
									{t.import.done.undo}
								</button>
							)}
						</div>
					)}

					<Link
						href="/impostazioni"
						className="btn-primary w-full h-13 rounded-[17px] text-[15px] font-semibold flex items-center justify-center"
					>
						{t.import.done.backToSettings}
					</Link>
				</div>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------ passi --- */

function StepBar({ index }: { index: number }) {
	return (
		<div className="flex gap-1.5 mb-7">
			{[0, 1, 2].map((i) => (
				<span
					key={i}
					className="flex-1 h-1 rounded-full"
					style={{
						background: i <= index ? "var(--text-primary)" : "var(--border)",
					}}
				/>
			))}
		</div>
	);
}

interface FileStepProps {
	file: File | null;
	accounts: ImportAccount[];
	accountId: string;
	onAccount: (id: string) => void;
	onCreated: (a: ImportAccount) => void;
	onPick: (f: File | null) => void;
	inputRef: React.RefObject<HTMLInputElement | null>;
	analysis: ImportAnalysis | null;
	mapping: GenericMapping | null;
	onMapping: (m: GenericMapping) => void;
	pending: boolean;
	onContinue: () => void;
	previous: ImportSummary[];
	onUndone: () => void;
}

function FileStep({
	file,
	accounts,
	accountId,
	onAccount,
	onCreated,
	onPick,
	inputRef,
	analysis,
	mapping,
	onMapping,
	pending,
	onContinue,
	previous,
	onUndone,
}: FileStepProps) {
	const { t, locale } = useI18n();
	const [dragging, setDragging] = useState(false);

	const needsMapping = analysis?.kind === "mappatura" ? analysis : null;
	const read = analysis?.kind === "letto" ? analysis.result : null;

	const columnOptions = (allowNone: boolean) => [
		...(allowNone ? [{ value: "-1", label: t.import.mapping.none, icon: null }] : []),
		...(needsMapping?.header ?? []).map((h, i) => ({
			value: String(i),
			label: h || `#${i + 1}`,
			icon: null,
		})),
	];

	/*
	 * ⚠️ Serve un'analisi RIUSCITA, non solo un file scelto. La prima versione
	 * chiedeva `file && conto && (niente mappatura || mappatura completa)`: dopo
	 * un'analisi fallita — file illeggibile, rete caduta — `analysis` è `null`,
	 * quindi la condizione era vera e il pulsante si accendeva su un
	 * `continueFromFile()` che non ha alcun ramo da eseguire. Un comando vivo che
	 * non fa niente è peggio di uno spento: quello almeno dice che manca qualcosa.
	 */
	const mappingReady = mapping !== null && mapping.date >= 0 && mapping.amount >= 0;
	const ready =
		Boolean(file) && Boolean(accountId) && (read !== null || (needsMapping !== null && mappingReady));

	return (
		<div className="flex flex-col grow">
			<div
				onDragOver={(e) => {
					e.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={(e) => {
					e.preventDefault();
					setDragging(false);
					const dropped = e.dataTransfer.files?.[0];
					if (dropped) onPick(dropped);
				}}
				onClick={() => inputRef.current?.click()}
				className="rounded-[28px] border-[1.5px] border-dashed bg-card backdrop-blur-xl flex flex-col items-center justify-center text-center px-7 py-12 gap-4 cursor-pointer"
				style={{
					borderColor: dragging ? "var(--color-midori)" : "var(--border)",
				}}
			>
				<span className="w-16 h-16 rounded-[20px] bg-control flex items-center justify-center">
					{file ? (
						<FileText size={26} className="text-secondary" />
					) : (
						<Upload size={26} className="text-secondary" />
					)}
				</span>
				{file ? (
					<>
						<p className="text-[15.5px] font-semibold leading-snug break-all">{file.name}</p>
						<p className="text-xs text-muted">{t.import.file.change}</p>
					</>
				) : (
					<>
						<p className="text-[15.5px] font-semibold leading-snug">
							{t.import.file.drop}
							<br />
							{t.import.file.or}
						</p>
						<p className="text-xs text-muted leading-relaxed max-w-55">{t.import.file.hint}</p>
					</>
				)}
			</div>

			<input
				ref={inputRef}
				type="file"
				accept=".csv,text/csv"
				className="hidden"
				onChange={(e) => onPick(e.target.files?.[0] ?? null)}
			/>

			{/*
				⚠️ Il conto sta QUI, nello stesso passo del file, e non era nel
				mockup: `transactions.account_id` è NOT NULL dalla 20a, quindi senza
				questo campo l'import non potrebbe scrivere una sola riga. È una
				proprietà dell'ESTRATTO, non delle singole righe — per questo si
				chiede una volta e non per gruppo.
			*/}
			<div className="mt-4">
				{/*
					Il profilo riconosciuto, appena scelto il file: risponde alla domanda
					che viene subito dopo — "di quale conto è questo?" — prima che venga
					posta. È anche il motivo per cui l'analisi si fa alla scelta del file
					e non al "Continua".
				*/}
				{read && (
					<p className="text-[12.5px] text-muted mb-3 ms-1">
						{fill(t.import.file.recognised, {
							source: lookup(t.import.file.sources, read.source, (v) => v, read.source),
							n: plural(t.import.history.rows, read.rows.length, locale),
						})}
					</p>
				)}

				<AccountPicker
					title={t.import.file.accountLabel}
					accounts={accounts}
					selected={accountId}
					onChange={onAccount}
					onCreated={onCreated}
				/>

				{/*
					⚠️ L'avviso compare solo per gli estratti di broker, e non è
					pedanteria: un file Trade Republic caricato sul conto corrente
					attribuisce a quel conto acquisti, interessi e pagamenti avvenuti
					altrove, e manda i bonifici in arrivo a carico di un conto scelto per
					esclusione. È già successo, con 216 movimenti e un saldo negativo di
					2.618 € su un conto che non aveva mosso un euro.
				*/}
				{read?.source === "trade_republic" && (
					<p
						className="text-[12px] leading-relaxed mt-2.5 rounded-2xl px-3.5 py-2.5 border"
						style={{
							color: "var(--ink-kin)",
							borderColor: "color-mix(in srgb, var(--color-kin) 32%, transparent)",
							background: "color-mix(in srgb, var(--color-kin) 10%, transparent)",
						}}
					>
						{t.import.file.brokerHint}
					</p>
				)}

				<p className="text-[11.5px] text-muted mt-1.5 ms-1">{t.import.file.accountHint}</p>
			</div>

			{needsMapping && (
				<div className="mt-6 rounded-[22px] border border-subtle bg-card p-4.5 flex flex-col gap-4">
					<div>
						<p className="text-sm font-semibold">{t.import.mapping.title}</p>
						<p className="text-[12.5px] text-muted mt-1">{t.import.mapping.hint}</p>
					</div>
					<Select
						variant="compact"
						title={t.import.mapping.date}
						selected={String(mapping?.date ?? -1)}
						onChange={(v) =>
							onMapping({
								date: Number(v),
								amount: mapping?.amount ?? -1,
								description: mapping?.description ?? null,
							})
						}
						options={columnOptions(false)}
					/>
					<Select
						variant="compact"
						title={t.import.mapping.amount}
						selected={String(mapping?.amount ?? -1)}
						onChange={(v) =>
							onMapping({
								date: mapping?.date ?? -1,
								amount: Number(v),
								description: mapping?.description ?? null,
							})
						}
						options={columnOptions(false)}
					/>
					<Select
						variant="compact"
						title={t.import.mapping.description}
						selected={String(mapping?.description ?? -1)}
						onChange={(v) =>
							onMapping({
								date: mapping?.date ?? -1,
								amount: mapping?.amount ?? -1,
								description: Number(v) < 0 ? null : Number(v),
							})
						}
						options={columnOptions(true)}
					/>
				</div>
			)}

			<div className="grow" />
			<button
				type="button"
				disabled={!ready || pending}
				onClick={onContinue}
				className="btn-primary w-full h-13 rounded-[17px] text-[15px] font-semibold mt-8 disabled:opacity-40"
			>
				{t.import.file.continue}
			</button>

			{/*
				Lo storico compare solo PRIMA di scegliere un file: chi è a metà di un
				import nuovo non ha niente da farci, e sotto il pulsante sarebbe rumore.
			*/}
			{!file && previous.length > 0 && (
				<ImportHistory items={previous} accounts={accounts} onUndone={onUndone} />
			)}
		</div>
	);
}

/**
 * Il selettore di conto che sa anche CREARNE uno.
 *
 * ⚠️ Esiste per un difetto pagato. Senza, chi importa un estratto Trade Republic
 * senza avere un conto Trade Republic deve sceglierne un altro — e per la
 * controparte dei bonifici, con due soli conti in tutto, il menu offriva
 * esattamente **una** voce. Non era una scelta: era l'unica riga disponibile, e
 * ha prodotto 216 movimenti attribuiti al conto sbagliato.
 *
 * Uscire a creare il conto e tornare non era una via d'uscita: il file scelto
 * vive nello stato di questo componente e si sarebbe perso.
 */
function AccountPicker({
	title,
	accounts,
	selected,
	exclude,
	onChange,
	onCreated,
	onOpenChange,
}: {
	title: string;
	accounts: ImportAccount[];
	selected: string;
	exclude?: string;
	onChange: (id: string) => void;
	onCreated: (a: ImportAccount) => void;
	/** Inoltrata a `Select`: serve alla card per alzarsi sopra la bottom nav. */
	onOpenChange?: (open: boolean) => void;
}) {
	const { t } = useI18n();
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	const usable = accounts.filter((a) => a.id !== exclude);

	async function create() {
		const clean = name.trim();
		if (clean === "") return;
		setBusy(true);
		setErr(null);
		/*
		 * Nessun tipo e saldo iniziale a zero: sono decisioni che appartengono alla
		 * pagina conti, e sceglierle qui vorrebbe dire scrivere un dato che nessuno
		 * ha deciso — la regola sui DEFAULT già pagata tre volte in questo progetto.
		 * `accounts.type` è comunque decorativo, quindi NULL non toglie nulla.
		 */
		const res = await createAccount({ name: clean, type: null, initialBalance: 0 });
		setBusy(false);
		/*
		 * ⚠️ Il controllo è su `id`, non su `error`, e non è pignoleria: il tipo di
		 * ritorno di `createAccount` comprende un terzo ramo — l'oggetto validato
		 * `{ name }` — che a runtime non esce mai, ma che `"error" in res` non
		 * esclude. Restringere su ciò che serve DAVVERO (l'id del conto appena
		 * creato) rende il codice corretto qualunque cosa faccia quella firma.
		 */
		const id = "id" in res ? res.id : undefined;
		if (!id) {
			setErr("error" in res && res.error ? res.error : t.common.genericError);
			return;
		}
		onCreated({ id, name: clean, type: null, icon: null, color: null });
		onChange(id);
		setName("");
		setCreating(false);
	}

	return (
		<div>
			<Select
				variant="compact"
				title={title}
				onOpenChange={onOpenChange}
				selected={creating ? "" : selected}
				onChange={(v) => (v === NEW_ACCOUNT ? setCreating(true) : onChange(v))}
				options={[
					...usable.map((a) => ({
						value: a.id,
						label: a.name,
						icon: <Dot color={accountColor(a.type, a.color)} />,
					})),
					{
						value: NEW_ACCOUNT,
						label: t.import.file.newAccount,
						icon: <Plus size={11} className="text-muted" />,
					},
				]}
			/>
			{creating && (
				<div className="mt-2 flex gap-2">
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder={t.import.file.newAccountName}
						maxLength={50}
						className="flex-1 min-w-0 h-11 px-3.5 rounded-2xl bg-input border border-subtle text-sm"
					/>
					<button
						type="button"
						disabled={busy || name.trim() === ""}
						onClick={create}
						className="btn-primary h-11 px-4 rounded-2xl text-sm font-semibold disabled:opacity-40"
					>
						{t.import.file.create}
					</button>
				</div>
			)}
			{err && (
				<p className="text-[12px] mt-1.5 ms-1" style={{ color: "var(--ink-aka)" }}>
					{err}
				</p>
			)}
		</div>
	);
}

/**
 * Gli import già eseguiti, con il comando che li annulla.
 *
 * ⚠️ Il conteggio è quello di ADESSO, non quello del momento dell'import: se
 * qualche riga è stata cancellata a mano, qui si vede il numero rimasto. È la
 * ragione per cui `imports` non ha una colonna `row_count`.
 */
function ImportHistory({
	items,
	accounts,
	onUndone,
}: {
	items: ImportSummary[];
	accounts: ImportAccount[];
	onUndone: () => void;
}) {
	const { t, locale } = useI18n();
	const [confirming, setConfirming] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const name = new Map(accounts.map((a) => [a.id, a.name]));

	const [err, setErr] = useState<string | null>(null);

	/*
	 * ⚠️ L'esito si GUARDA. La prima versione scartava il valore di ritorno:
	 * un annullamento fallito chiudeva la conferma e ricaricava la pagina
	 * esattamente come uno riuscito, lasciando il lotto e le sue transazioni al
	 * loro posto. L'utente vedeva il gesto compiersi e i dati restare —
	 * l'unica prova sarebbe stata riaprire la pagina e ricontare.
	 */
	async function run(id: string) {
		setBusy(true);
		setErr(null);
		try {
			const res = await undoImport(id);
			if ("error" in res) {
				setErr(res.error);
				return;
			}
			setConfirming(null);
			onUndone();
		} catch {
			setErr(t.common.genericError);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="mt-9">
			<p className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-disabled mb-2.5 ms-0.5">
				{t.import.history.title}
			</p>
			{err && (
				<p className="text-[12px] mb-2 ms-0.5" style={{ color: "var(--ink-aka)" }}>
					{err}
				</p>
			)}
			<div className="flex flex-col gap-2.5">
				{items.map((it) => (
					<div key={it.id} className="rounded-[20px] border border-subtle bg-card p-4">
						<div className="flex items-center gap-3">
							<span className="w-8 h-8 rounded-[10px] bg-control flex items-center justify-center shrink-0">
								<FileText size={14} className="text-secondary" />
							</span>
							<div className="flex-1 min-w-0">
								<p className="text-[13px] font-medium truncate">{it.filename}</p>
								<p className="text-[11.5px] text-muted mt-0.5 truncate">
									{formatDate(it.createdAt, locale)} ·{" "}
									{plural(t.import.history.rows, it.rows, locale)} ·{" "}
									{name.get(it.accountId) ?? "—"}
								</p>
							</div>
						</div>
						{confirming === it.id ? (
							<div className="mt-3">
								<p className="text-[12px] text-muted mb-2.5">{t.import.done.undoBody}</p>
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => setConfirming(null)}
										className="flex-1 h-10 rounded-xl border border-subtle bg-control text-[13px] font-medium"
									>
										{t.import.done.undoCancel}
									</button>
									<button
										type="button"
										disabled={busy}
										onClick={() => run(it.id)}
										className="flex-1 h-10 rounded-xl text-[13px] font-semibold disabled:opacity-50"
										style={{ color: "var(--on-accent)", background: "var(--color-aka)" }}
									>
										{t.import.done.undoConfirm}
									</button>
								</div>
							</div>
						) : (
							<button
								type="button"
								onClick={() => setConfirming(it.id)}
								className="mt-2.5 text-[12px] font-medium flex items-center gap-1.5"
								style={{ color: "var(--ink-aka)" }}
							>
								<Undo2 size={12} />
								{t.import.done.undo}
							</button>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

/* ----------------------------------------------------------------- gruppi --- */

interface GroupCardProps {
	group: ParsedGroup;
	decision: GroupDecision | null;
	rows: ParsedRow[];
	accounts: ImportAccount[];
	categories: ImportCategory[];
	fileAccountId: string;
	onChange: (patch: Partial<GroupDecision>) => void;
	onCreated: (a: ImportAccount) => void;
	zIndex: number;
}

function GroupCard({
	group,
	decision,
	rows,
	accounts,
	categories,
	fileAccountId,
	onChange,
	onCreated,
	zIndex,
}: GroupCardProps) {
	const { t, locale } = useI18n();
	const [open, setOpen] = useState(false);

	/*
	 * ⚠️ Quante tendine sono aperte dentro questa card — un contatore e non un
	 * booleano, perché `Select` non si chiude quando se ne apre un'altra: aprendo
	 * la categoria mentre il tipo è ancora aperto, un booleano tornerebbe `false`
	 * alla prima chiusura e farebbe ricadere la card sotto la bottom nav mentre
	 * una tendina è ancora a schermo.
	 */
	const [openMenus, setOpenMenus] = useState(0);
	const menuToggle = (isOpen: boolean) =>
		setOpenMenus((n) => Math.max(0, n + (isOpen ? 1 : -1)));

	/*
	 * ⚠️ Il totale porta il SEGNO, e senza non si distinguono due gruppi.
	 * "Imposte e bolli" compare due volte — il bollo addebitato e il suo storno —
	 * con lo stesso titolo, nessun dettaglio e importi diversi: senza il segno
	 * sono due card che sembrano un errore di duplicazione. La direzione è
	 * un'informazione del file, non una conseguenza della scelta ancora da fare.
	 */
	const sign: AmountSign = group.direction === "entrata" ? "+" : "−";

	const target = decision?.target ?? null;
	const isTransfer = target === "trasferimento";
	const usable = target && target !== "ignora" && !isTransfer;
	// ⚠️ Senza la mappatura il selettore sarebbe VUOTO per il gruppo delle
	// vendite, e quel gruppo resterebbe non decidibile: un bersaglio proponibile
	// che non si può completare. Vedi `categoryTypeFor`.
	const forType = usable
		? categories.filter((c) => c.type === categoryTypeFor(target))
		: [];

	/** L'accento del bersaglio scelto; neutro finché non c'è una scelta. */
	const accent = target && target !== "ignora" ? TIPO_COLOR[target] : "var(--color-kiri)";
	const ink = target && target !== "ignora" ? TIPO_INK[target] : "var(--ink-kiri)";

	return (
		/*
		 * ⚠️ Con una tendina aperta la card sale SOPRA la `BottomNav` (z-40), non
		 * solo sopra le card vicine.
		 *
		 * `backdrop-blur` crea un contesto di impilamento, quindi il menu è
		 * confinato al livello della card: con `zIndex` fra 1 e 14 finiva sotto la
		 * navigazione, e le ultime voci di una lista di categorie erano coperte
		 * dalla pastiglia e dal FAB. Nessuno z-index scritto dentro `Select` può
		 * rimediare — l'unico che può alzare la card è chi la disegna.
		 */
		<div
			className="relative rounded-[22px] border border-subtle bg-card backdrop-blur-xl"
			style={{ zIndex: openMenus > 0 ? 60 : zIndex }}
		>
			<div className="p-4.5">
				<div className="flex items-start gap-3">
					<span
						className="w-2 h-2 rounded-full mt-1.5 shrink-0"
						style={{ background: accent }}
					/>
					<div className="flex-1 min-w-0">
						<p className="text-sm font-semibold leading-snug">{t.import.groups[group.kind]}</p>
						{group.detail !== null ? (
							<p className="text-[12px] text-muted mt-0.5 truncate">{group.detail}</p>
						) : (
							(group.kind === "trasferimentoIn" || group.kind === "trasferimentoOut") && (
								<p className="text-[12px] text-muted mt-0.5">{t.import.preview.noDetail}</p>
							)
						)}
					</div>
					<div className="text-right shrink-0">
						<p className="text-[13px] font-semibold" style={{ color: ink }}>
							{/* I gruppi senza cassa non hanno un totale da mostrare: sarebbe
							    "€ 0,00", cioè un numero che sembra un importo e non lo è. */}
							{group.locked ? "—" : formatAmount(group.total, sign, locale)}
						</p>
						<p className="text-[11.5px] text-muted mt-0.5">
							{plural(t.import.preview.rows, group.count, locale)}
						</p>
					</div>
				</div>

				{group.noteKey && (
					<p className="text-[12px] text-muted leading-relaxed mt-3 flex gap-2">
						<Info size={13} className="shrink-0 mt-0.5" />
						{/* `lookup()` e non l'accesso diretto: `noteKey` è una stringa che
						    arriva dal profilo di lettura, non un tipo garantito. Un
						    profilo futuro che ne inventasse una nuova mostrerebbe il
						    ripiego invece di schiantare la pagina. */}
						<span>{lookup(t.import.notes, group.noteKey, (s) => s, "")}</span>
					</p>
				)}

				{!group.locked && (
					<div className="mt-4 flex flex-col gap-3">
						<Select
							variant="compact"
							/* ⚠️ "Tipo di movimento" e non "Diventa": `Select` compone il
							   segnaposto come "Seleziona {etichetta}", quindi l'etichetta va
							   scelta INSIEME alla frase che la conterrà. È la regola emersa
							   dalla 20b, dove "Dal conto" produceva "Seleziona dal conto". */
							title={t.import.preview.becomes}
							onOpenChange={menuToggle}
							selected={target ?? ""}
							onChange={(v) => onChange({ target: v as GroupTarget })}
							options={group.allowed.map((a) => ({
								value: a,
								label: a === "ignora" ? t.import.targets.ignora : t.transactionTypes[a].label,
								icon: (
									<Dot color={a === "ignora" ? "var(--color-kiri)" : TIPO_COLOR[a]} />
								),
							}))}
						/>

						{isTransfer && (
							/*
								⚠️ `AccountPicker` e non `Select`, ed è la correzione del
								difetto più costoso di questa fase: con due soli conti, il
								menu della controparte conteneva UNA voce — quella sbagliata —
								e il gruppo era proposto come `trasferimento`. La "scelta"
								era già fatta, e ha spostato 5.777 € fra due conti che non
								c'entravano. Poter creare qui il conto mancante è ciò che
								trasforma un vicolo cieco in una decisione.

								Etichette PIENE: `Select` compone "Seleziona {etichetta}",
								quindi "Dal conto" darebbe "Seleziona dal conto" — la mezza
								frase già corretta nella 20b.
							*/
							<AccountPicker
								title={
									group.direction === "entrata"
										? t.import.preview.counterpart
										: t.import.preview.counterpartOut
								}
								accounts={accounts}
								onOpenChange={menuToggle}
								exclude={fileAccountId}
								selected={decision?.counterpartAccountId ?? ""}
								onChange={(v) => onChange({ counterpartAccountId: v })}
								onCreated={onCreated}
							/>
						)}

						{usable && forType.length > 0 && (
							<Select
								variant="compact"
								title={t.import.preview.category}
								onOpenChange={menuToggle}
								selected={decision?.categoryId ?? ""}
								onChange={(v) => onChange({ categoryId: v === "" ? null : v })}
								options={[
									{ value: "", label: t.import.preview.noCategory, icon: null },
									...forType.map((c) => ({
										value: c.id,
										label: c.name,
										icon: <Dot color={accent} />,
									})),
								]}
							/>
						)}
					</div>
				)}

				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					className="mt-3.5 text-[12px] text-muted flex items-center gap-1.5"
				>
					{open ? t.import.preview.hideRows : t.import.preview.showRows}
					<ChevronDown
						size={12}
						style={{ transform: open ? "rotate(180deg)" : undefined }}
					/>
				</button>
			</div>

			{open && (
				<div className="border-t border-subtle rounded-b-[22px] overflow-hidden">
					{rows.slice(0, 40).map((r) => (
						<div
							key={r.key}
							className="flex items-center gap-3 px-4.5 py-2.5 border-b border-subtle last:border-b-0"
						>
							<span className="text-[11px] text-muted w-14 shrink-0">
								{formatDate(r.date, locale)}
							</span>
							<span className="text-[12.5px] flex-1 min-w-0 truncate">{r.description}</span>
							<span className="text-[12.5px] font-medium shrink-0" style={{ color: ink }}>
								{formatAmount(r.amount, sign, locale)}
							</span>
						</div>
					))}
					{rows.length > 40 && (
						/*
							⚠️ "+ 160 altre righe", non "160 righe". La seconda forma si legge
							come il totale del gruppo e contraddice l'intestazione tre righe
							sopra, che ne dichiara 200: due numeri diversi per la stessa cosa,
							a un centimetro di distanza.
						*/
						<p className="px-4.5 py-2.5 text-[11.5px] text-disabled">
							{plural(t.import.preview.more, rows.length - 40, locale)}
						</p>
					)}
				</div>
			)}
		</div>
	);
}

/* ------------------------------------------------------------------ pezzi --- */

function Dot({ color }: { color: string }) {
	return (
		<span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
	);
}

function SummaryLine({ text, tone, muted }: { text: string; tone?: string; muted?: boolean }) {
	return (
		<div className="flex items-center gap-3">
			<span
				className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
				style={{
					background: muted
						? "var(--color-control)"
						: `color-mix(in srgb, ${tone} 14%, transparent)`,
				}}
			>
				<Dot color={muted ? "var(--color-kiri)" : (tone ?? "var(--color-kiri)")} />
			</span>
			<span className={`text-[14.5px] font-medium ${muted ? "text-muted" : ""}`}>{text}</span>
		</div>
	);
}

/**
 * Il peso del file.
 *
 * Nessuna voce di dizionario e nessun `new Intl.NumberFormat` cablato: `Intl`
 * sa già dire "2,1 kB" in ogni lingua, e `formatNumber` è il punto unico da cui
 * questa app parla di numeri.
 *
 * ⚠️ Il mockup scriveva "estratto_conto_giugno.csv · 2,1 MB" per 42
 * transazioni. Un CSV di 42 righe pesa una manciata di kilobyte: era un difetto
 * dei dati d'esempio, e faceva sembrare sensato un limite di 10 MB.
 */
function formatKb(bytes: number, locale: Locale): string {
	return formatNumber(bytes / 1024, locale, {
		style: "unit",
		unit: "kilobyte",
		maximumFractionDigits: 1,
	});
}
