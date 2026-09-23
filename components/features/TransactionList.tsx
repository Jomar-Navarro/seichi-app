"use client";
import { ICON_MAP } from "@/lib/icon-map";
import { GOAL_ICON_MAP } from "@/lib/goal-icons";
import { useUIStore } from "@/store/useUIStore";
import EmptyState from "@/components/UI/EmptyState";
import type { Transaction } from "@/types";
import {
	DIRECTION_ARROW,
	TIPO_COLOR,
	TIPO_INK,
	amountSign,
	formatDate,
	formatAmount,
} from "@/lib/transaction-utils";
import { ArrowLeftRightIcon } from "@/lib/seichi-icons";
// Graffetta da Lucide e non `ReceiptIcon` di seichi-icons: quella è già la voce
// "Transazioni" della bottom nav, e lo stesso segno per due significati diversi
// nella stessa schermata si legge come un errore.
import { Paperclip } from "lucide-react";
import { useI18n } from "./I18nProvider";

interface TransactionListProps {
	transactions: Transaction[];
	loading: boolean;
	/**
	 * Se è attivo almeno un filtro. Cambia il messaggio di lista vuota, e NON è
	 * un dettaglio di stile: senza, la pagina dichiara "non hai ancora
	 * registrato nulla" a chi ha centinaia di movimenti e ha semplicemente
	 * scelto un conto senza spese nel periodo. Un'affermazione falsa fa dubitare
	 * che i dati ci siano ancora.
	 */
	filtered?: boolean;
	/**
	 * Quanti allegati ha ciascun movimento (Fase 22), per id.
	 *
	 * ⚠️ Facoltativo e DEGRADA: un oggetto vuoto significa "non lo so", non
	 * "nessuno". Il segnaposto è un di più, e la lista deve restare leggibile
	 * anche se la query dei conteggi fallisce — è il motivo per cui
	 * `getAttachmentCounts()` restituisce `{}` invece di sollevare.
	 */
	attachmentCounts?: Record<string, number>;
	/**
	 * Serve a NOMINARE i conti di un trasferimento: un movimento che sposta
	 * denaro non ha una categoria da mostrare, e "—" al suo posto sarebbe una
	 * riga che non dice cosa è successo.
	 *
	 * ⚠️ Il nome si risolve qui e non con una join in `getTransactions()`. Il
	 * chiamante i conti li ha già — gli servono per il filtro — e imbarcarli
	 * nella query costerebbe due embed per riga; ma il motivo vero è un altro:
	 * PostgREST deriva il nome della relazione dal nome del VINCOLO, quindi la
	 * `select` andrebbe scritta `accounts!transactions_account_owner_fkey(name)`
	 * e si romperebbe in silenzio il giorno in cui una migration rinomina quella
	 * FK — cosa che la `20260815` ha appena fatto.
	 */
	accounts?: { id: string; name: string }[];
	/**
	 * Il conto attualmente selezionato, se uno solo.
	 *
	 * ⚠️ Decide il SEGNO degli importi, non solo quali righe compaiono. Con un
	 * conto davanti la lista è il suo estratto conto e il denaro che arriva è
	 * `+`; senza, è il diario di ciò che hai fatto e un trasferimento resta
	 * senza segno. Vedi `amountSign()`.
	 */
	viewedAccountId?: string | null;
}

/*
 * Da `lg:` in su ogni movimento è la card del mockup desktop di Movimenti
 * (issue #108): raggio 20, padding 15/18, vetro leggero, testi un filo più
 * grandi. Sotto `lg:` nulla cambia.
 *
 * ⚠️ Vale anche per `/conti/[id]`, che rende questa stessa lista: è voluto —
 * l'estratto di un conto e la lista di tutti i movimenti sono la stessa riga,
 * e due misure diverse per lo stesso oggetto si leggerebbero come due oggetti.
 *
 * Lo scheletro prende le stesse misure, o all'arrivo dei dati le card
 * cambierebbero forma sotto gli occhi.
 */
function Skeleton() {
	return (
		<div className="space-y-2">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-card ring-border animate-pulse lg:px-4.5 lg:py-3.75 lg:rounded-[20px] lg:bg-surface">
					<div className="w-10 h-10 rounded-xl bg-surface-elevated shrink-0 lg:rounded-[13px]" />
					<div className="flex-1 space-y-2">
						<div className="h-3 rounded-full bg-surface-elevated w-28" />
						<div className="h-2.5 rounded-full bg-surface-elevated w-16" />
					</div>
					<div className="h-3.5 rounded-full bg-surface-elevated w-16" />
				</div>
			))}
		</div>
	);
}

function TransactionsEmpty({ filtered }: { filtered: boolean }) {
	const { openTransactionModal } = useUIStore();
	const { t } = useI18n();

	// Con i filtri attivi non si offre "aggiungi movimento": il problema non è
	// che manchino i dati, è che questi filtri non li intercettano.
	if (filtered) {
		return (
			<div className="py-16">
				<EmptyState
					title={t.transactions.emptyFilteredTitle}
					description={t.transactions.emptyFilteredDescription}
				/>
			</div>
		);
	}

	return (
		<div className="py-16">
			<EmptyState
				title={t.transactions.emptyTitle}
				description={t.transactions.emptyDescription}
				actionLabel={t.transactions.addAction}
				onAction={openTransactionModal}
			/>
		</div>
	);
}

export default function TransactionList({
	transactions,
	loading,
	filtered = false,
	attachmentCounts = {},
	accounts = [],
	viewedAccountId = null,
}: TransactionListProps) {
	const { openEditModal } = useUIStore();
	const { locale, t } = useI18n();

	const accountName = new Map(accounts.map((a) => [a.id, a.name]));

	if (loading) return <Skeleton />;
	if (transactions.length === 0) return <TransactionsEmpty filtered={filtered} />;

	const groups = transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
		const key = formatDate(tx.date, locale);
		if (!acc[key]) acc[key] = [];
		acc[key].push(tx);
		return acc;
	}, {});

	return (
		<div className="space-y-5">
			{Object.entries(groups).map(([date, items]) => (
				<div key={date}>
					{/* Da `lg:` in su l'etichetta del giorno del mockup: 11px maiuscolo,
					    spaziatura 2px, colore da etichetta di sezione. Le distanze
					    restano quelle di sempre (20px sopra, 10px sotto), vicine a
					    quelle del mockup: cambia la voce, non il ritmo della lista. */}
					<p className="text-xs font-medium tracking-[1.6px] text-muted mb-2.5 ms-1 lg:text-[11px] lg:uppercase lg:tracking-[2px] lg:text-disabled">
						{date}
					</p>
					<div className="space-y-2">
						{items.map((tx) => {
							const isTransfer = tx.type === "trasferimento";
							const cat = tx.categories;
							/*
								Un trasferimento non ha categoria — è un CHECK del database,
								non un caso limite — quindi non ha nemmeno l'icona e il
								colore che da lei derivano. Prende i propri: due frecce
								opposte e il neutro, perché non è né un'entrata né un'uscita.
							*/
							const Icon = isTransfer
								? ArrowLeftRightIcon
								: cat
									? (ICON_MAP[cat.icon] ?? GOAL_ICON_MAP[cat.icon])
									: null;
							const color = isTransfer
								? TIPO_COLOR.trasferimento
								: `var(--color-${cat?.color ?? "kiri"})`;
							const amountColor = TIPO_INK[tx.type] ?? "var(--text-primary)";

							const toName = tx.to_account_id ? accountName.get(tx.to_account_id) : null;
							/*
								Il titolo di un trasferimento è la DIREZIONE: senza, due
								trasferimenti dello stesso importo nello stesso giorno sono
								righe identiche, e la lista non permette di distinguere quello
								sbagliato da correggere.
							*/
							const title = isTransfer
								? `${accountName.get(tx.account_id) ?? "—"} ${DIRECTION_ARROW} ${toName ?? "—"}`
								: (cat?.name ?? "—");

							/*
								Da `lg:` in su le ENTRATE hanno un velo verde (mockup #108).
								⚠️ Mescolato con `--surface` e non col trasparente: col
								trasparente, in tema chiaro, la card perderebbe il vetro
								bianco delle vicine e si leggerebbe come un buco nella lista
								invece che come una riga tinta.
								Solo `entrata`, come l'inchiostro dell'importo: è il TIPO a
								dire "reddito", non il segno — una vendita è un `+` ma non è
								reddito, e un trasferimento in arrivo nemmeno.
							*/
							const cardBg =
								tx.type === "entrata"
									? "lg:bg-[color-mix(in_srgb,var(--color-midori)_7%,var(--surface))]"
									: "lg:bg-surface";

							return (
								<button
									key={tx.id}
									onClick={() => openEditModal(tx)}
									// `lg:hover:` — col mouse la card deve dire da sé che si apre;
									// col dito lo dice già `active:opacity-75`.
									className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-card card-shadow-ring text-left active:opacity-75 transition-opacity lg:px-4.5 lg:py-3.75 lg:rounded-[20px] ${cardBg} lg:hover:bg-surface-elevated`}
								>
									<div
										className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 lg:rounded-[13px]"
										style={{ background: `color-mix(in srgb, ${color} 16%, transparent)` }}
									>
										{Icon
											? <Icon size={17} style={{ color }} />
											: <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
										}
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-semibold flex items-center gap-1.5 lg:text-[14.5px]">
											<span className="truncate">{title}</span>
											{/*
												⚠️ Il segnaposto sta accanto al TITOLO e non in fondo
												alla riga, dove vivono l'importo e la data: quella zona
												parla di quanto e quando, e una graffetta lì si
												leggerebbe come parte del numero. Qui dice invece "di
												questo movimento esiste una prova" — una proprietà del
												movimento, non del suo importo.
											*/}
											{(attachmentCounts[tx.id] ?? 0) > 0 && (
												<Paperclip size={12} className="text-muted shrink-0" />
											)}
										</p>
										<p className="text-xs text-muted mt-0.5 truncate">
											{tx.notes ? tx.notes : t.types[tx.type as keyof typeof t.types]}
											{/*
												⚠️ La destinazione di un risparmio o di un investimento
												si dice, e non è un vezzo: quel movimento SPOSTA denaro
												— è ciò che la 20b ha aggiunto — e senza scriverlo la
												riga sembra identica a un risparmio che non lo sposta,
												mentre i due lasciano saldi diversi.
											*/}
											{!isTransfer && toName && ` · ${DIRECTION_ARROW} ${toName}`}
										</p>
									</div>
									<p className="text-sm font-semibold shrink-0 lg:text-[15px]" style={{ color: amountColor }}>
										{formatAmount(tx.amount, amountSign(tx, viewedAccountId), locale)}
									</p>
								</button>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}
