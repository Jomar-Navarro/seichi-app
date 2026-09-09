"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Check, ChevronDown, Clock, Fingerprint, Lock, TriangleAlert } from "lucide-react";
import PinPad from "@/components/UI/PinPad";
import SubmitButton from "@/components/UI/SubmitButton";
import { SwitchVisual } from "@/components/UI/Switch";
import SettingsRow, { SettingsGroup } from "@/components/UI/SettingsRow";
import { useI18n } from "@/components/features/I18nProvider";
import { fill, plural } from "@/lib/i18n/format";
import { useUIStore } from "@/store/useUIStore";
import {
	APP_LOCK_GRACE_DEFAULT_MS,
	APP_LOCK_GRACE_OPTIONS_MS,
	APP_LOCK_PIN_LENGTH,
	APP_LOCK_REJECT_DISPLAY_MS,
	clearPin,
	hasStoredPin,
	isAppLockGraceMs,
	readGraceMs,
	readStoredPin,
	savePin,
	writeGraceMs,
} from "@/lib/app-lock";

/**
 * `/impostazioni/blocco` (Fase 26a) — imposta, cambia o rimuove il PIN.
 *
 * Dal design (`PinSetupCard.dc.html`): badge + titolo + sottotitolo che
 * cambiano per passo, indicatore di progresso a 3 tappe, schermata finale
 * "PIN impostato" con un bottone esplicito invece di tornare subito al
 * riposo. Il riposo stesso segue "Seichi Blocco PIN Impostazioni.dc.html":
 * una card con la riga interruttore, il bottone (o i due bottoni), e sotto
 * o l'elenco "cosa succede dopo" (spento) o l'avviso sulla rimozione
 * (acceso).
 *
 * ⚠️ Il design mostra anche uno switch biometrico funzionante: non
 * adottato — il biometrico non esiste ancora (Fase 26b), e mostrarlo
 * prometterebbe una funzione che l'app non ha. Resta "presto" come sulla
 * pagina impostazioni principale.
 *
 * La riga "richiedi il PIN dopo" INVECE è toccabile, su richiesta esplicita
 * (era stata prima una costante fissa).
 *
 * ⚠️ Il primo tentativo copiava `PreferencesSection` (valuta/lingua): una
 * `<select>` nativa invisibile sopra la riga. Corretto — il picker che ne
 * esce è quello del SISTEMA OPERATIVO, non del design system, e su Zen
 * Glass scuro si vede: un menu grigio piatto sopra una card di vetro. Qui è
 * un menu DISEGNATO a mano, `position: fixed` con le coordinate calcolate
 * al tocco (come `Select.tsx`), non `position: absolute` dentro la card:
 * `SettingsGroup` ha `overflow-hidden` per ritagliare gli angoli delle
 * righe, e un menu `absolute` verrebbe tagliato via lì sotto. `fixed` non
 * ne risente — esce dal flusso e si posiziona rispetto al VIEWPORT, non
 * rispetto a un antenato con `overflow-hidden` (a meno che quell'antenato
 * non abbia `transform`/`filter`, che `SettingsGroup` non ha).
 *
 * ⚠️ La barra di navigazione NON dipende dalla rotta ma da `step`: il
 * design la vuole assente durante il wizard (crea/conferma/done) e presente
 * sul riposo, che è la STESSA route. `fullScreenActive` (useUIStore) è lo
 * stato condiviso che lo dice a `BottomNav`, un componente fratello di
 * questa pagina — vedi l'effetto qui sotto.
 *
 * ⚠️ `mismatch` NON è un valore di `step`, ed è deliberato: è un booleano
 * (`mismatchShowing`) sovrapposto allo step "create-confirm". Se fosse un
 * terzo `step`, `key={step}` sul PinPad (sotto) rimonterebbe un'istanza
 * NUOVA — vuota — proprio nell'istante in cui il design vuole mostrare le 6
 * cifre appena digitate, piene e rosse. Restando sullo stesso step il pad è
 * la STESSA istanza per tutta la finestra di lettura dell'errore, e passa a
 * "create-enter" (quindi si svuota) solo alla fine di quella finestra.
 */
type Step = "idle" | "create-enter" | "create-confirm" | "done" | "verify-current";

const badgeIcon: Record<"lock" | "alert" | "check", ReactNode> = {
	lock: <Lock size={26} strokeWidth={1.7} />,
	alert: <TriangleAlert size={26} strokeWidth={1.7} />,
	check: <Check size={28} strokeWidth={2} />,
};

export default function AppLockSettings({ initialHasPin }: { initialHasPin: boolean }) {
	const { t, locale } = useI18n();
	const setFullScreenActive = useUIStore((s) => s.setFullScreenActive);

	// `hasPin` è DERIVATO da localStorage, non uno stato proprio: niente
	// `useEffect`+`setState` (render a cascata, vietato dal lint) per
	// riconciliare server e client — lo stesso pattern già in `PwaStatus`.
	// Il cookie letto dal server (`initialHasPin`) è solo il suggerimento per
	// il PRIMO render; da lì `hasStoredPin()` viene riletta a ogni render,
	// compreso quello che segue `savePin()`/`clearPin()` più sotto.
	const hasPin = useSyncExternalStore(
		() => () => {},
		hasStoredPin,
		() => initialHasPin,
	);

	// Stessa ragione di `hasPin`: `readGraceMs()` tocca `localStorage`, che
	// non esiste durante il render sul server — da qui il default SICURO
	// (`APP_LOCK_GRACE_DEFAULT_MS`) come terzo argomento, mai la lettura
	// diretta in un inizializzatore di `useState`.
	const storedGraceMs = useSyncExternalStore(
		() => () => {},
		readGraceMs,
		() => APP_LOCK_GRACE_DEFAULT_MS,
	);
	// `writeGraceMs()` non è stato di React: non farebbe ri-renderizzare
	// nulla da sé. Questo scavalca il valore sincronizzato SUBITO dopo una
	// scelta, senza dover forzare un re-render con un contatore fittizio.
	const [graceOverride, setGraceOverride] = useState<number | null>(null);
	const graceMs = graceOverride ?? storedGraceMs;

	function onGraceChange(next: number) {
		if (!isAppLockGraceMs(next)) return;
		writeGraceMs(next);
		setGraceOverride(next);
	}

	function formatGrace(ms: number) {
		return ms < 60_000
			? plural(t.appLock.graceSeconds, ms / 1000, locale)
			: plural(t.appLock.graceMinutes, ms / 60_000, locale);
	}

	// Menu disegnato a mano per "richiedi il PIN dopo" — vedi il commento in
	// testa al file sul perché non è una `<select>` nativa. La posizione si
	// calcola al TOCCO, non al render: la riga sta dentro una card che può
	// scorrere in pagina, stesso principio di `Select.tsx`.
	const graceTriggerRef = useRef<HTMLButtonElement>(null);
	const [graceOpen, setGraceOpen] = useState(false);
	const [graceMenuRect, setGraceMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);

	function openGraceMenu() {
		const rect = graceTriggerRef.current?.getBoundingClientRect();
		if (rect) setGraceMenuRect({ top: rect.bottom + 6, left: rect.left, width: rect.width });
		setGraceOpen(true);
	}
	function closeGraceMenu() {
		setGraceOpen(false);
	}

	const [step, setStep] = useState<Step>("idle");
	const [afterVerify, setAfterVerify] = useState<"change" | "remove" | null>(null);
	const [firstPin, setFirstPin] = useState<string | null>(null);
	const [rejected, setRejected] = useState(false);
	const [mismatchShowing, setMismatchShowing] = useState(false);

	// Sincronizza uno STORE ESTERNO (Zustand), non lo stato di React: è
	// l'eccezione che la stessa regola del lint ammette esplicitamente —
	// iscriversi a/scrivere su un sistema esterno da un effetto è il caso
	// per cui l'effetto esiste, diverso da un `setState` di QUESTO
	// componente dentro il proprio effetto. La pulizia riporta la barra
	// quando l'utente esce dalla pagina a metà wizard (freccia in alto),
	// non solo quando il flusso finisce da sé.
	useEffect(() => {
		setFullScreenActive(step !== "idle");
		return () => setFullScreenActive(false);
	}, [step, setFullScreenActive]);

	function reset() {
		setStep("idle");
		setAfterVerify(null);
		setFirstPin(null);
		setRejected(false);
		setMismatchShowing(false);
	}

	function onVerifyCurrent(pin: string) {
		if (pin !== readStoredPin()) {
			setRejected(true);
			setTimeout(() => setRejected(false), APP_LOCK_REJECT_DISPLAY_MS);
			return;
		}
		if (afterVerify === "remove") {
			clearPin();
			reset();
			return;
		}
		// afterVerify === "change": il PIN attuale è confermato, si passa a
		// scegliere quello nuovo — la STESSA schermata dell'impostazione.
		setStep("create-enter");
	}

	function onCreateFirst(pin: string) {
		setFirstPin(pin);
		setStep("create-confirm");
	}

	function onCreateConfirm(pin: string) {
		if (pin !== firstPin) {
			setRejected(true);
			setMismatchShowing(true);
			setTimeout(() => {
				setRejected(false);
				setMismatchShowing(false);
				setFirstPin(null);
				setStep("create-enter");
			}, APP_LOCK_REJECT_DISPLAY_MS);
			return;
		}
		savePin(pin);
		setStep("done");
	}

	/* ---------------------------------------------------------- i quattro/cinque passi --- */

	if (step !== "idle") {
		const length = APP_LOCK_PIN_LENGTH;
		const content =
			step === "verify-current"
				? {
						badge: "lock" as const,
						title: t.appLock.currentTitle,
						subtitle: rejected ? t.appLock.wrongPin : t.appLock.currentSubtitle,
					}
				: step === "create-enter"
					? {
							badge: "lock" as const,
							title: t.appLock.createTitle,
							subtitle: fill(t.appLock.createSubtitle, { length }),
						}
					: step === "create-confirm" && mismatchShowing
						? {
								badge: "alert" as const,
								title: t.appLock.mismatchTitle,
								subtitle: t.appLock.mismatchSubtitle,
							}
						: step === "create-confirm"
							? {
									badge: "lock" as const,
									title: t.appLock.confirmTitle,
									subtitle: fill(t.appLock.confirmSubtitle, { length }),
								}
							: {
									badge: "check" as const,
									title: t.appLock.doneTitle,
									subtitle: fill(t.appLock.doneSubtitle, { length }),
								};

		// Tre tappe: create → confirm → done. "mismatch" resta sulla tappa 2,
		// perché è ancora lo step "create-confirm" (vedi sopra). "verify-current"
		// non fa parte di questo percorso — non è un passo verso un PIN nuovo,
		// è il cancello prima di raggiungerlo, quindi niente indicatore.
		const stepIndex =
			step === "create-enter" ? 1 : step === "create-confirm" ? 2 : step === "done" ? 3 : 0;

		const onComplete =
			step === "verify-current"
				? onVerifyCurrent
				: step === "create-enter"
					? onCreateFirst
					: onCreateConfirm;

		return (
			<div className="flex flex-col items-center pt-4">
				{stepIndex > 0 && (
					<div className="flex justify-center gap-1.75 mb-8">
						{[1, 2, 3].map((i) => (
							<span
								key={i}
								className="w-6.5 h-0.75 rounded-full transition-colors"
								style={{ background: i <= stepIndex ? "var(--color-midori)" : "var(--border)" }}
							/>
						))}
					</div>
				)}

				<div
					className="w-15 h-15 rounded-[22px] flex items-center justify-center mb-5 ring-border"
					style={{
						background: "var(--card)",
						color: content.badge === "alert" ? "var(--color-aka)" : "var(--text-primary)",
						boxShadow:
							content.badge === "alert"
								? "var(--color-aka) 0px 0px 0px 1px inset"
								: undefined,
					}}
				>
					{badgeIcon[content.badge]}
				</div>

				<h2 className="text-lg font-semibold mb-1.5 text-center">{content.title}</h2>
				<p className="text-[12.5px] text-muted leading-relaxed mb-7 text-center max-w-65 min-h-8.5">
					{content.subtitle}
				</p>

				{step === "done" ? (
					<SubmitButton label={t.appLock.doneContinue} onClick={reset} className="mt-2" />
				) : (
					<>
						<PinPad
							key={step}
							length={APP_LOCK_PIN_LENGTH}
							onComplete={onComplete}
							rejected={rejected}
							deleteLabel={t.appLock.deleteKey}
						/>
						{!mismatchShowing && (
							<button
								type="button"
								onClick={reset}
								className="text-[13px] font-medium text-muted underline underline-offset-2 mt-6"
							>
								{t.common.cancel}
							</button>
						)}
					</>
				)}
			</div>
		);
	}

	/* ---------------------------------------------------------- riposo --- */

	function startCreate() {
		setStep("create-enter");
	}
	function startRemove() {
		setAfterVerify("remove");
		setStep("verify-current");
	}

	return (
		<div>
			<p className="text-[13px] text-muted leading-relaxed mb-7">{t.appLock.disclaimer}</p>

			<SettingsGroup>
				{/* La riga È il comando (`onClick` sulla riga stessa): l'interruttore
				    dentro è `SwitchVisual`, non `<Switch>` — un `<button
				    role="switch">` annidato in un'altra riga-bottone sarebbe markup
				    interattivo dentro markup interattivo. Stesso motivo per cui
				    `SwitchVisual` esiste separata da `Switch` (vedi Switch.tsx). */}
				<SettingsRow
					icon={<Lock size={17} className="text-secondary" />}
					label={t.settings.pinLock}
					subtitle={hasPin ? fill(t.appLock.onSubtitle, { length: APP_LOCK_PIN_LENGTH }) : t.appLock.offSubtitle}
					value={<SwitchVisual checked={hasPin} />}
					onClick={hasPin ? startRemove : startCreate}
				/>
				{hasPin && (
					<>
						{/* Non uno switch VERO — "presto" come sulla pagina impostazioni
						    principale: il biometrico non esiste ancora (Fase 26b). */}
						<SettingsRow
							icon={<Fingerprint size={17} className="text-secondary" />}
							label={t.settings.biometricLock}
							value={t.settings.comingSoon}
							disabled
						/>
						<button
							ref={graceTriggerRef}
							type="button"
							onClick={() => (graceOpen ? closeGraceMenu() : openGraceMenu())}
							className="flex items-center gap-3 h-15.5 px-4 w-full text-left active:opacity-80"
						>
							<span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-control">
								<Clock size={17} className="text-secondary" />
							</span>
							<span className="flex-1 text-sm font-medium">{t.appLock.graceLabel}</span>
							<span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
								{formatGrace(graceMs)}
								<ChevronDown
									size={12}
									className={`transition-transform ${graceOpen ? "rotate-180" : ""}`}
								/>
							</span>
						</button>
					</>
				)}
			</SettingsGroup>

			{graceOpen && graceMenuRect && (
				<>
					{/* Backdrop trasparente a schermo intero: chiude il menu al tap
					    fuori, stesso meccanismo del pannello conti (Fase 20b). */}
					<div className="fixed inset-0 z-45" onClick={closeGraceMenu} />
					{/* issue #81 — anello (`box-shadow-ring`), mai un `border` vero su
					    un elemento arrotondato. Guscio → vetro → contenuto: il guscio
					    ritaglia e fa l'ombra, il vetro sfoca SENZA un proprio raggio. */}
					<div
						className="fixed z-46 rounded-2xl overflow-hidden box-shadow-ring"
						style={{ top: graceMenuRect.top, left: graceMenuRect.left, width: graceMenuRect.width }}
					>
						<div className="absolute inset-0 bg-deep backdrop-blur-[30px]" />
						<div className="relative p-1.5">
							{APP_LOCK_GRACE_OPTIONS_MS.map((ms) => (
								<button
									key={ms}
									type="button"
									onClick={() => {
										onGraceChange(ms);
										closeGraceMenu();
									}}
									className="w-full flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl text-sm active:opacity-70"
								>
									<span>{formatGrace(ms)}</span>
									{ms === graceMs && <Check size={15} className="text-midori" />}
								</button>
							))}
						</div>
					</div>
				</>
			)}

			{!hasPin ? (
				<SubmitButton label={t.appLock.setPin} onClick={startCreate} />
			) : (
				<div className="space-y-3">
					<SubmitButton
						label={t.appLock.changePin}
						variant="ghost"
						onClick={() => {
							setAfterVerify("change");
							setStep("verify-current");
						}}
					/>
					<SubmitButton label={t.appLock.removePin} danger onClick={startRemove} />
				</div>
			)}

			{!hasPin ? (
				<div className="mt-8">
					<p className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-disabled mb-3">
						{t.appLock.howItWorksTitle}
					</p>
					<div className="space-y-3">
						{[
							fill(t.appLock.howItWorksStep1, { length: APP_LOCK_PIN_LENGTH }),
							t.appLock.howItWorksStep2,
							t.appLock.howItWorksStep3,
						].map((step, i) => (
							<div key={i} className="flex gap-3 items-start">
								<span className="w-5.5 h-5.5 rounded-lg bg-control flex items-center justify-center text-[11px] font-semibold text-secondary shrink-0">
									{i + 1}
								</span>
								<span className="text-[12.5px] text-muted leading-relaxed">{step}</span>
							</div>
						))}
					</div>
				</div>
			) : (
				<p className="text-xs text-muted leading-relaxed mt-5">{t.appLock.activeDisclaimer}</p>
			)}
		</div>
	);
}
