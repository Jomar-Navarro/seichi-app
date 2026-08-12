"use client";

import { useState } from "react";
import { X, Check, Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { createAccount, updateAccount, setAccountArchived } from "@/app/(main)/conti/actions";
import { useI18n } from "./I18nProvider";
import { DISPLAY_CURRENCY, currencySymbol } from "@/lib/i18n/format";
import {
	ACCOUNT_ICON_FALLBACK,
	ACCOUNT_TYPE_COLOR,
	ACCOUNT_TYPE_ICON,
	accountColor,
	accountTypeLabel,
} from "@/lib/accounts";
import { ACCOUNT_TYPES, type AccountTypeId, type AccountWithBalance } from "@/types";

/**
 * ⚠️ Nessuna prop `isOpen`: il pannello si MONTA, non si nasconde. È il
 * chiamante a decidere (`{open && <AccountSheet …/>}`), e montare È
 * l'azzeramento — gli inizializzatori di `useState` leggono `account` e non
 * serve nessun effetto che riscriva gli stati a ogni apertura. Regola del
 * progetto, vedi `GoalSheet` per il difetto che l'ha prodotta.
 */
interface AccountSheetProps {
	account: AccountWithBalance | null;
	/** Serve a sapere se "archivia" va offerto: l'ultimo conto attivo non si archivia. */
	canArchive: boolean;
	onClose: () => void;
}

/**
 * I colori proponibili. Sono gli accenti del design system, ma qui NON hanno il
 * loro significato finanziario: su un conto il blu non vuol dire "investimento",
 * vuol dire "blu". Che siano scegliibili a mano è la prova che non decidono
 * niente — vedi `lib/accounts.ts`.
 */
const COLOR_CHOICES = [
	{ value: "var(--color-ao)", key: "blue" },
	{ value: "var(--color-midori)", key: "green" },
	{ value: "var(--color-kin)", key: "gold" },
	{ value: "var(--color-murasaki)", key: "purple" },
	{ value: "var(--color-aka)", key: "red" },
] as const;

export default function AccountSheet({ account, canArchive, onClose }: AccountSheetProps) {
	const { locale, t } = useI18n();
	const router = useRouter();

	const [name, setName] = useState(() => account?.name ?? "");
	/*
	 * ⚠️ "corrente" solo per un conto NUOVO. Su uno esistente si tiene il suo
	 * tipo, `null` compreso: `accounts.type` è nullable per progetto, e il
	 * ripiego (`ACCOUNT_ICON_FALLBACK`, `t.accounts.typeless`) esiste apposta.
	 * Col default incondizionato, aprire un conto senza tipo per correggere un
	 * refuso nel nome gli assegnava "Corrente" al salvataggio — cambiando icona
	 * ed etichetta senza che l'utente avesse toccato quel campo, e senza un
	 * comando per tornare indietro.
	 */
	const [type, setType] = useState<AccountTypeId | null>(() =>
		account ? account.type : "corrente",
	);
	const [color, setColor] = useState<string | null>(() => account?.color ?? null);
	const [initialBalance, setInitialBalance] = useState(() =>
		account ? String(account.initial_balance) : "",
	);
	const [submitted, setSubmitted] = useState(false);
	const [loading, setLoading] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [confirmArchive, setConfirmArchive] = useState(false);

	const nameError = submitted && !name.trim();
	// Il saldo iniziale può essere NEGATIVO — una carta di credito ha giacenza
	// negativa — quindi si controlla solo che sia un numero, non il segno.
	const parsedBalance = initialBalance.trim() === "" ? 0 : Number(initialBalance);
	const balanceError = submitted && Number.isNaN(parsedBalance);

	// Lookup su mappa e non `accountIcon(type)`: vedi ACCOUNT_ICON_FALLBACK.
	const Icon = (type && ACCOUNT_TYPE_ICON[type]) || ACCOUNT_ICON_FALLBACK;
	const swatch = accountColor(type, color);

	async function handleSubmit() {
		setSubmitted(true);
		if (!name.trim() || Number.isNaN(parsedBalance)) return;

		setLoading(true);
		setServerError(null);
		const payload = {
			name: name.trim(),
			type,
			color,
			initialBalance: parsedBalance,
		};

		try {
			const result = account
				? await updateAccount(account.id, payload)
				: await createAccount(payload);
			if ("error" in result && result.error) {
				setServerError(result.error);
				return;
			}
			router.refresh();
			onClose();
		} finally {
			setLoading(false);
		}
	}

	async function handleArchive() {
		if (!account) return;
		if (!confirmArchive) {
			setConfirmArchive(true);
			return;
		}
		setLoading(true);
		setServerError(null);
		try {
			const result = await setAccountArchived(account.id, true);
			if ("error" in result && result.error) {
				setServerError(result.error);
				/*
				 * ⚠️ Si torna a "Archivia": la conferma è stata data e RESPINTA, e
				 * lasciarla accesa mostrerebbe due messaggi contraddittori insieme —
				 * l'errore che dice "non si può" sopra la riga che spiega cosa
				 * succede archiviando. Il rifiuto ha una causa rimediabile (spostare
				 * o mettere in pausa le ricorrenti), quindi il gesto va ricominciato
				 * dopo averla rimossa, non riconfermato a vuoto.
				 */
				setConfirmArchive(false);
				return;
			}
			router.refresh();
			onClose();
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-end">
			<div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

			<div
				className="relative w-full flex flex-col rounded-t-4xl pt-3.5 px-6 pb-8 modal-shadow border-t border-l border-r border-subtle bg-modal backdrop-blur-2xl"
				style={{ maxHeight: "90dvh", overflowY: "auto" }}
			>
				<div className="w-10 h-1 rounded-full mx-auto mb-1 bg-modal-handle shrink-0" />

				<div className="flex items-center justify-between mt-4 mb-6 shrink-0">
					<h2 className="text-xl font-semibold">
						{account ? t.accounts.editTitle : t.accounts.newTitle}
					</h2>
					<button
						onClick={onClose}
						className="w-8 h-8 flex items-center justify-center rounded-xl bg-control border border-subtle"
					>
						<X size={15} />
					</button>
				</div>

				<div className="flex flex-col gap-5">
					{/* Nome, con l'anteprima della pastiglia accanto: il colore e
					    l'icona si scelgono sotto, e vederli applicati evita di dover
					    chiudere per capire come verrà. */}
					<div>
						<label className="text-xs text-muted mb-2 block tracking-wide">
							{t.accounts.name}
						</label>
						<div className="flex items-center gap-3">
							<span
								className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
								style={{ background: `color-mix(in srgb, ${swatch} 16%, transparent)` }}
							>
								<Icon size={19} style={{ color: swatch }} />
							</span>
							<input
								type="text"
								placeholder={t.accounts.namePlaceholder}
								value={name}
								maxLength={50}
								onChange={(e) => setName(e.target.value)}
								className="flex-1 min-w-0 rounded-[18px] px-4 py-3.5 text-[14.5px] bg-input border border-subtle outline-none placeholder:text-muted/60"
								style={{ borderColor: nameError ? "var(--color-aka)" : undefined }}
							/>
						</div>
						{nameError && (
							<p className="text-xs mt-1.5 ml-1" style={{ color: "var(--ink-aka)" }}>
								{t.accounts.errors.nameRequired}
							</p>
						)}
					</div>

					{/* Tipo — decorativo: sceglie icona ed etichetta, nient'altro. */}
					<div>
						<label className="text-xs text-muted mb-2 block tracking-wide">
							{t.accounts.type}
						</label>
						<div className="flex flex-wrap gap-2">
							{ACCOUNT_TYPES.map((id) => {
								const active = type === id;
								return (
									<button
										key={id}
										onClick={() => setType(id)}
										className="px-3.5 py-2 rounded-full text-[12.5px] font-medium border transition-colors"
										style={{
											background: active
												? `color-mix(in srgb, ${ACCOUNT_TYPE_COLOR[id]} 16%, transparent)`
												: "var(--seg-bg)",
											borderColor: active ? ACCOUNT_TYPE_COLOR[id] : "var(--border)",
										}}
									>
										{accountTypeLabel(id, t)}
									</button>
								);
							})}
						</div>
					</div>

					{/* Colore */}
					<div>
						<label className="text-xs text-muted mb-2 block tracking-wide">
							{t.accounts.color}
						</label>
						<div className="flex items-center gap-2.5">
							{/*
								⚠️ L'`aria-label` è il NOME del colore, non il token. La prima
								stesura passava `aria-label={c}`, cioè faceva annunciare
								"var(--color-ao)" a chi usa uno screen reader: un bottone
								senza testo visibile ha come nome accessibile solo quello, e
								un token CSS non è una parola.
							*/}
							{COLOR_CHOICES.map(({ value, key }) => (
								<button
									key={key}
									onClick={() => setColor(color === value ? null : value)}
									aria-label={t.accounts.colors[key]}
									aria-pressed={color === value}
									className="w-8 h-8 rounded-full flex items-center justify-center border"
									style={{
										background: value,
										borderColor: color === value ? "var(--text-primary)" : "transparent",
									}}
								>
									{color === value && (
										// ⚠️ `--on-accent`, mai `#fff`: gli accenti invertono la
										// luminosità fra i temi, quindi ciò che ci sta sopra deve
										// invertirsi con loro.
										<Check size={14} style={{ color: "var(--on-accent)" }} strokeWidth={3} />
									)}
								</button>
							))}
						</div>
					</div>

					{/*
						Saldo iniziale.
						⚠️ Il segnaposto è "0" e non "0,00": la virgola decimale è
						italiana, in en-GB il separatore è il punto. Un segnaposto
						scritto a mano è testo cablato quanto una frase intera.
					*/}
					<div>
						<label className="text-xs text-muted mb-2 block tracking-wide">
							{t.accounts.initialBalance}
						</label>
						<div
							className="flex items-center gap-2 rounded-[18px] px-4 py-3.5 bg-input border border-subtle"
							style={{ borderColor: balanceError ? "var(--color-aka)" : undefined }}
						>
							<span className="text-[14.5px] text-muted">
								{currencySymbol(DISPLAY_CURRENCY, locale)}
							</span>
							<input
								type="number"
								inputMode="decimal"
								step="0.01"
								placeholder="0"
								value={initialBalance}
								onChange={(e) => setInitialBalance(e.target.value)}
								className="flex-1 bg-transparent outline-none text-[14.5px] placeholder:text-muted/60"
							/>
						</div>
						{/*
							⚠️ In modifica il campo RESTA, e il testo cambia per dire cosa
							fa. Il mockup lo nascondeva dopo la creazione, ma così un
							refuso diventa irreparabile: il conto non si cancella, il saldo
							deriva da qui, e l'unico rimedio sarebbe una transazione
							fittizia — cioè sporcare i movimenti reali per riparare un
							campo di configurazione.
						*/}
						<p className="text-[11px] text-disabled mt-1.5 ml-1 leading-relaxed">
							{account ? t.accounts.initialBalanceEditHint : t.accounts.initialBalanceHint}
						</p>
					</div>

					{serverError && (
						<p className="text-xs" style={{ color: "var(--ink-aka)" }}>
							{serverError}
						</p>
					)}

					<button
						onClick={handleSubmit}
						disabled={loading}
						className="btn-primary w-full py-4 rounded-2xl text-[14.5px] font-semibold disabled:opacity-60"
					>
						{loading ? t.accounts.saving : t.accounts.save}
					</button>

					{/*
						⚠️ "Archivia", azione SECONDARIA e mai rossa, mai "elimina". Un
						conto con storico non si cancella: `transactions.account_id` è
						`on delete no action` proprio perché cancellarlo porterebbe via
						anni di movimenti reali.
						Non compare sull'ultimo conto attivo: ogni movimento deve
						appartenere a un conto, e il form movimento non avrebbe più
						niente da proporre.
					*/}
					{account && !account.archived && (
						<>
							{/*
								⚠️ Sull'ULTIMO conto attivo il bottone resta VISIBILE e
								disabilitato, non sparisce.
								Nasconderlo era la prima stesura, ed è la scelta sbagliata:
								un comando che non c'è è indistinguibile da un comando
								rotto, e l'utente non ha modo di sapere che esiste una
								regola. Disabilitato più la ragione scritta sotto dice
								entrambe le cose — che si può fare, e perché adesso no.
							*/}
							<button
								onClick={handleArchive}
								disabled={loading || !canArchive}
								className="w-full flex items-center justify-center gap-2 py-3 text-[13px] font-medium text-muted disabled:opacity-40"
							>
								<Archive size={14} />
								{confirmArchive ? t.accounts.archiveConfirm : t.accounts.archive}
							</button>

							{(!canArchive || confirmArchive) && (
								<p className="text-[11px] text-disabled -mt-3 text-center leading-relaxed">
									{!canArchive ? t.accounts.errors.lastAccount : t.accounts.archiveBody}
								</p>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}
