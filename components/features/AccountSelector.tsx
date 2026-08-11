"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, ArrowRight } from "lucide-react";
import { useI18n } from "@/components/features/I18nProvider";
import { DISPLAY_CURRENCY, formatMoney, plural } from "@/lib/i18n/format";
import { accountTypeLabel } from "@/lib/accounts";
import type { AccountWithBalance } from "@/types";

interface AccountSelectorProps {
	accounts: AccountWithBalance[];
	/** null = tutti i conti. Arriva dal search param, quindi il server ne è la fonte. */
	selectedId: string | null;
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
export default function AccountSelector({ accounts, selectedId }: AccountSelectorProps) {
	const { locale, t } = useI18n();
	const router = useRouter();
	const [open, setOpen] = useState(false);

	// Gli archiviati restano fuori dal selettore: sono conti che non ricevono più
	// movimenti, e proporli come filtro suggerirebbe il contrario. Restano
	// leggibili nella pagina conti, dove la domanda è un'altra.
	const selectable = accounts.filter((a) => !a.archived);
	const selected = selectable.find((a) => a.id === selectedId) ?? null;

	function choose(id: string | null) {
		setOpen(false);
		// `?conto=` sparisce del tutto per "tutti i conti": un parametro vuoto
		// nell'URL è rumore, e il server lo leggerebbe comunque come assente.
		router.push(id ? `/?conto=${id}` : "/");
	}

	return (
		<div className="relative">
			<button
				onClick={() => setOpen((o) => !o)}
				className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-subtle bg-surface backdrop-blur-md text-xs font-medium text-secondary ${
					open ? "z-50 relative" : ""
				}`}
			>
				{selected ? selected.name : t.accounts.all}
				<ChevronDown size={13} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
			</button>

			{/*
				⚠️ Il saldo compare SOLO quando è selezionato un conto singolo, e
				l'asimmetria è deliberata.
				Mostrarlo anche su "tutti i conti" significherebbe rimettere in home
				la somma dei saldi, cioè esattamente il numero che questa fase ha
				tolto perché entrava in contraddizione con la pagina conti. Il saldo
				di UN conto è un'affermazione diversa: è attaccato al suo nome,
				etichettato, e risponde alla domanda che l'utente ha appena posto
				scegliendolo. Senza, filtrando un conto senza movimenti nel mese si
				vedono solo zeri e la pagina non dice più niente di utile.
			*/}
			{selected && (
				<p className="mt-1.5 ml-1 text-[11.5px] text-muted">
					{t.accounts.balanceHeading} ·{" "}
					<span className="font-semibold text-foreground">
						{formatMoney(selected.balance, {
							locale,
							currency: DISPLAY_CURRENCY,
							decimals: 2,
						})}
					</span>
				</p>
			)}

			{open && (
				<>
					<button
						aria-label={t.common.close}
						onClick={() => setOpen(false)}
						className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1.5px]"
					/>
					<div
						className="absolute left-0 top-full mt-2 z-50 w-[min(20rem,calc(100vw-2.5rem))] rounded-3xl border border-subtle modal-shadow backdrop-blur-2xl overflow-hidden"
						style={{ background: "color-mix(in srgb, var(--color-deep) 94%, transparent)" }}
					>
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
