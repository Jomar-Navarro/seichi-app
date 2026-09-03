"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, ArrowRight } from "lucide-react";
import { useI18n } from "@/components/features/I18nProvider";
import { DISPLAY_CURRENCY, formatMoney, plural } from "@/lib/i18n/format";
import { accountTypeLabel, rememberAccount } from "@/lib/accounts";
import type { AccountWithBalance } from "@/types";

interface AccountSelectorProps {
	accounts: AccountWithBalance[];
	/** null = tutti i conti. La fonte è il server: search param, o cookie. */
	selectedId: string | null;
	/**
	 * La pagina su cui riatterrare dopo la scelta. Il selettore filtra *questa*
	 * schermata, non necessariamente la home.
	 */
	basePath?: string;
	/**
	 * Gli altri parametri da conservare (es. `periodo` su `/analisi`).
	 *
	 * ⚠️ Dati semplici, NON una funzione che costruisca l'URL. Il selettore è un
	 * client component istanziato da un server component, e una prop funzione fa
	 * fallire la serializzazione RSC — l'errore che `tsc` e `next build` non
	 * vedono e che compare solo aprendo la pagina (regola della Fase 19).
	 */
	keepParams?: Record<string, string>;
}

/**
 * Il selettore "Tutti i conti" in cima alla home.
 *
 * Fa due lavori che il mockup tiene insieme deliberatamente: filtra i totali
 * della home **e** mostra i saldi dei conti. Il secondo è ciò che lo rende anche
 * l'ingresso alla pagina conti — un elenco di saldi senza un modo per aprirli
 * sarebbe un vicolo cieco, e la bottom nav è già a quattro voci più il FAB.
 *
 * ⚠️ La selezione vive nell'URL (`?conto=<id>`), non in uno stato locale: i
 * totali li calcola un server component e devono essere ricalcolati dal server.
 * Uno stato client avrebbe richiesto di spostare il fetch nel browser, cioè di
 * disfare il lavoro di `dashboard_totals`.
 *
 * ⚠️ Il pannello si MONTA, non si nasconde (regola del progetto): niente prop
 * `isOpen` con un `return null` dentro, o lo stato sopravviverebbe alla chiusura
 * e andrebbe riazzerato a mano in un effetto.
 */
export default function AccountSelector({
	accounts,
	selectedId,
	basePath = "/",
	keepParams,
}: AccountSelectorProps) {
	const { locale, t } = useI18n();
	const router = useRouter();
	const [open, setOpen] = useState(false);

	// Gli archiviati restano fuori dal selettore: sono conti che non ricevono più
	// movimenti, e proporli come filtro suggerirebbe il contrario. Restano
	// leggibili nella pagina conti, dove la domanda è un'altra.
	const selectable = accounts.filter((a) => !a.archived);
	/*
	 * ⚠️ Il conto selezionato si cerca fra TUTTI, non fra i selezionabili.
	 *
	 * Archiviando il conto su cui si è filtrati, `selectable` non lo contiene
	 * più: il chip tornava a dire "Tutti i conti" e la spunta finiva su quella
	 * riga, mentre la pagina restava filtrata su quel conto. Etichetta e dati che
	 * si contraddicono — lo stesso difetto già corretto sui movimenti recenti.
	 * Resta scegliibile solo ciò che è attivo; resta LEGGIBILE ciò che è
	 * selezionato.
	 */
	const selected = accounts.find((a) => a.id === selectedId) ?? null;

	function choose(id: string | null) {
		setOpen(false);

		/*
		 * ⚠️ Il cookie si scrive PRIMA della navigazione, e l'ordine conta: la
		 * pagina di destinazione è un server component, quindi legge i cookie
		 * della richiesta che `router.push` sta per fare. Scrivendolo dopo, il
		 * primo render userebbe ancora il valore vecchio.
		 *
		 * Scegliere "Tutti i conti" CANCELLA la memoria invece di lasciarla
		 * ferma: altrimenti tornando in home dalla bottom nav — che punta a `/`
		 * senza parametri — il cookie riapplicherebbe il conto appena
		 * deselezionato, e l'unico modo di vedere tutto sarebbe restare sulla
		 * schermata senza mai uscirne.
		 */
		rememberAccount(id);

		const params = new URLSearchParams(keepParams);
		// `?conto=` sparisce del tutto per "tutti i conti": un parametro vuoto
		// nell'URL è rumore, e il server lo leggerebbe comunque come assente.
		if (id) params.set("conto", id);
		const qs = params.toString();
		router.push(qs ? `${basePath}?${qs}` : basePath);
	}

	return (
		<div className="relative">
			{/* ⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto. */}
			<button
				onClick={() => setOpen((o) => !o)}
				className={`relative rounded-2xl overflow-hidden ring-border ${open ? "z-50" : ""}`}
			>
				<span className="absolute inset-0 bg-surface backdrop-blur-md" />
				<span className="relative flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-secondary">
					{selected ? selected.name : t.accounts.all}
					<ChevronDown size={13} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
				</span>
			</button>

			{open && (
				<>
					<button
						aria-label={t.common.close}
						onClick={() => setOpen(false)}
						className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1.5px]"
					/>
					{/* ⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto. */}
					<div className="absolute left-0 top-full mt-2 z-50 w-[min(20rem,calc(100vw-2.5rem))] rounded-3xl overflow-hidden modal-shadow-ring">
						<div
							className="absolute inset-0 backdrop-blur-2xl"
							style={{ background: "color-mix(in srgb, var(--color-deep) 94%, transparent)" }}
						/>
						<div className="relative">
							<AccountRow
								label={t.accounts.all}
								sublabel={plural(t.accounts.activeCount, selectable.length, locale)}
								amount={selectable.reduce((sum, a) => sum + a.balance, 0)}
								active={selected === null}
								onClick={() => choose(null)}
								locale={locale}
							/>

							<div className="h-px bg-subtle mx-4" />

							{selectable.map((a) => (
								<AccountRow
									key={a.id}
									label={a.name}
									sublabel={accountTypeLabel(a.type, t)}
									amount={a.balance}
									active={a.id === selected?.id}
									onClick={() => choose(a.id)}
									locale={locale}
								/>
							))}

							<Link
								href="/conti"
								onClick={() => setOpen(false)}
								className="flex items-center justify-between px-4 py-3.5 border-t border-subtle text-xs font-semibold text-ao-ink"
							>
								{t.accounts.manage}
								<ArrowRight size={14} />
							</Link>
						</div>
					</div>
				</>
			)}
		</div>
	);
}

function AccountRow({
	label,
	sublabel,
	amount,
	active,
	onClick,
	locale,
}: {
	label: string;
	sublabel: string;
	amount: number;
	active: boolean;
	onClick: () => void;
	locale: Parameters<typeof formatMoney>[1]["locale"];
}) {
	return (
		<button
			onClick={onClick}
			className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
		>
			<span className="min-w-0">
				<span className="flex items-center gap-1.5">
					<span className="text-sm font-medium text-foreground truncate">{label}</span>
					{active && <Check size={13} className="shrink-0 text-ao-ink" />}
				</span>
				<span className="block text-[11px] text-muted">{sublabel}</span>
			</span>
			<span className="text-sm font-semibold text-foreground shrink-0">
				{formatMoney(amount, { locale, currency: DISPLAY_CURRENCY, decimals: 2 })}
			</span>
		</button>
	);
}
