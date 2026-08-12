"use client";
import { Search, ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { TRANSACTION_TYPES, type Account } from "@/types";
import { useI18n } from "./I18nProvider";

interface FilterBarProps {
	search: string;
	tipo: string;
	periodo: string;
	/** "" = tutti i conti. Vuoto anche quando l'utente ne ha uno solo (vedi sotto). */
	conto: string;
	accounts: Pick<Account, "id" | "name" | "archived">[];
	onSearchChange: (v: string) => void;
	onTipoChange: (v: string) => void;
	onPeriodoChange: (v: string) => void;
	onContoChange: (v: string) => void;
}

/**
 * ⚠️ `TIPO_FILTER_LABELS` non esiste più: era una copia esatta delle etichette
 * plurali dei tipi ("Uscite", "Entrate"…), tenuta qui perché
 * `TRANSACTION_TYPES[].label` è invece singolare. Ora la copia sparisce e si
 * legge direttamente `t.types`, che è la stessa fonte usata dalla lista e dalla
 * pagina categorie.
 */
const PERIOD_IDS = ["7d", "30d", "3m", "tutto"] as const;

export default function FilterBar({
	search,
	tipo,
	periodo,
	conto,
	accounts,
	onSearchChange,
	onTipoChange,
	onPeriodoChange,
	onContoChange,
}: FilterBarProps) {
	const { t } = useI18n();
	const [open, setOpen] = useState<"periodo" | "tipo" | "conto" | null>(null);
	const ref = useRef<HTMLDivElement>(null);

	const tipoOptions = [
		{ value: "", label: t.transactions.filterAll },
		...TRANSACTION_TYPES.map((type) => ({
			value: type.id,
			label: t.types[type.id as keyof typeof t.types],
		})),
	];

	const periodoOptions = PERIOD_IDS.map((id) => ({
		value: id,
		label: t.transactions.periods[id],
	}));

	useEffect(() => {
		function handleClick(e: PointerEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
		}
		document.addEventListener("pointerdown", handleClick);
		return () => document.removeEventListener("pointerdown", handleClick);
	}, []);

	/*
	 * ⚠️ Scegliibili solo gli attivi, ma il conto SELEZIONATO resta nell'elenco
	 * anche se archiviato.
	 *
	 * Filtrando via gli archiviati e basta, archiviare il conto su cui si è
	 * filtrati produceva due difetti insieme: il chip tornava a dire "Tutti i
	 * conti" su una lista che restava filtrata, e — con un solo conto attivo
	 * rimasto — l'intera tendina spariva (`accounts.length > 1`), rendendo il
	 * filtro **impossibile da azzerare**. È la correzione già applicata a
	 * `AccountSelector` e non portata qui: la stessa migrazione a campione che
	 * CLAUDE.md documenta dalla Fase 18.
	 */
	const selectable = accounts.filter((a) => !a.archived || a.id === conto);
	const contoOptions = [
		{ value: "", label: t.accounts.all },
		...selectable.map((a) => ({ value: a.id, label: a.name })),
	];

	const tipoLabel = tipoOptions.find((o) => o.value === tipo)?.label ?? t.transactions.filterAll;
	const contoLabel = contoOptions.find((o) => o.value === conto)?.label ?? t.accounts.all;
	const periodoLabel = periodoOptions.find((o) => o.value === periodo)?.label ?? t.transactions.periods["30d"];

	return (
		<div className="space-y-3" ref={ref}>
			{/* Search */}
			<div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-subtle">
				<Search size={15} className="text-muted shrink-0" />
				<input
					type="text"
					placeholder={t.transactions.searchPlaceholder}
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
					className="bg-transparent text-sm flex-1 outline-none placeholder:text-muted"
				/>
			</div>

			{/* Filtri */}
			<div className="flex items-center gap-2">
				{/* Periodo dropdown */}
				<div className="relative">
					<button
						onClick={() => setOpen(open === "periodo" ? null : "periodo")}
						className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card border border-subtle text-sm font-medium"
					>
						{periodoLabel}
						<ChevronDown size={13} className={`text-muted transition-transform ${open === "periodo" ? "rotate-180" : ""}`} />
					</button>
					{open === "periodo" && (
						<div className="absolute top-full mt-1.5 left-0 z-20 min-w-36 rounded-2xl bg-deep border border-subtle overflow-hidden card-shadow">
							{periodoOptions.map((opt) => (
								<button
									key={opt.value}
									onClick={() => { onPeriodoChange(opt.value); setOpen(null); }}
									className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-card"
								>
									{opt.label}
									{periodo === opt.value && <Check size={13} className="text-midori" />}
								</button>
							))}
						</div>
					)}
				</div>

				{/* Tipo dropdown */}
				<div className="relative">
					<button
						onClick={() => setOpen(open === "tipo" ? null : "tipo")}
						className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card border border-subtle text-sm font-medium"
					>
						{tipoLabel}
						<ChevronDown size={13} className={`text-muted transition-transform ${open === "tipo" ? "rotate-180" : ""}`} />
					</button>
					{open === "tipo" && (
						<div className="absolute top-full mt-1.5 left-0 z-20 min-w-40 rounded-2xl bg-deep border border-subtle overflow-hidden card-shadow">
							{tipoOptions.map((opt) => (
								<button
									key={opt.value}
									onClick={() => { onTipoChange(opt.value); setOpen(null); }}
									className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-card"
								>
									{opt.label}
									{tipo === opt.value && <Check size={13} className="text-midori" />}
								</button>
							))}
						</div>
					)}
				</div>

				{/*
					Conto — nascosto con un conto solo, perché il filtro avrebbe una
					sola scelta oltre a "tutti": un comando che non può cambiare
					niente, rumore per chi di conti ne ha uno.
					⚠️ Ma resta visibile se un filtro È attivo (`|| conto`), o
					archiviando l'unico altro conto la tendina sparirebbe lasciando la
					lista filtrata e nessun modo di azzerarla.
				*/}
				{(selectable.length > 1 || conto) && (
					<div className="relative">
						<button
							onClick={() => setOpen(open === "conto" ? null : "conto")}
							className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card border border-subtle text-sm font-medium"
						>
							{contoLabel}
							<ChevronDown size={13} className={`text-muted transition-transform ${open === "conto" ? "rotate-180" : ""}`} />
						</button>
						{open === "conto" && (
							<div className="absolute top-full mt-1.5 right-0 z-20 min-w-44 rounded-2xl bg-deep border border-subtle overflow-hidden card-shadow">
								{contoOptions.map((opt) => (
									<button
										key={opt.value}
										onClick={() => { onContoChange(opt.value); setOpen(null); }}
										className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-card"
									>
										<span className="truncate">{opt.label}</span>
										{conto === opt.value && <Check size={13} className="text-midori shrink-0" />}
									</button>
								))}
							</div>
						)}
					</div>
				)}

			</div>
		</div>
	);
}
