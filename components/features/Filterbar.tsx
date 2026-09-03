"use client";
import { Search, ChevronDown, Check, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { TRANSACTION_TYPES, type Account, type Category } from "@/types";
import { useI18n } from "./I18nProvider";
import { TRANSACTION_PERIODS, categoryTypeFor } from "@/lib/transaction-utils";

interface FilterBarProps {
	search: string;
	tipo: string;
	periodo: string;
	/** "" = tutti i conti. Vuoto anche quando l'utente ne ha uno solo (vedi sotto). */
	conto: string;
	/** "" = tutte le categorie (#9). */
	categoria: string;
	accounts: Pick<Account, "id" | "name" | "archived">[];
	categories: Pick<Category, "id" | "name" | "type">[];
	onSearchChange: (v: string) => void;
	onTipoChange: (v: string) => void;
	onPeriodoChange: (v: string) => void;
	onContoChange: (v: string) => void;
	onCategoriaChange: (v: string) => void;
	/** Presente solo quando c'è qualcosa da azzerare: decide la pagina. */
	onReset?: () => void;
}

/**
 * ⚠️ `TIPO_FILTER_LABELS` non esiste più: era una copia esatta delle etichette
 * plurali dei tipi ("Uscite", "Entrate"…), tenuta qui perché
 * `TRANSACTION_TYPES[].label` è invece singolare. Ora la copia sparisce e si
 * legge direttamente `t.types`, che è la stessa fonte usata dalla lista e dalla
 * pagina categorie.
 */

export default function FilterBar({
	search,
	tipo,
	periodo,
	conto,
	categoria,
	accounts,
	categories,
	onSearchChange,
	onTipoChange,
	onPeriodoChange,
	onContoChange,
	onCategoriaChange,
	onReset,
}: FilterBarProps) {
	const { t } = useI18n();
	const [open, setOpen] = useState<"periodo" | "tipo" | "conto" | "categoria" | null>(null);
	const ref = useRef<HTMLDivElement>(null);

	const tipoOptions = [
		{ value: "", label: t.transactions.filterAll },
		...TRANSACTION_TYPES.map((type) => ({
			value: type.id,
			label: t.types[type.id as keyof typeof t.types],
		})),
	];

	const periodoOptions = TRANSACTION_PERIODS.map((id) => ({
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

	/*
	 * ⚠️ Le categorie proponibili seguono il TIPO selezionato, e la categoria
	 * scelta resta comunque nell'elenco.
	 *
	 * Senza il filtro per tipo la tendina elencherebbe tutte le categorie
	 * dell'utente — decine, di tipi diversi — dentro una lista che il tipo lo ha
	 * già ristretto: scegliere "Alimentari" sotto il tipo "Entrate" darebbe zero
	 * righe senza dire perché.
	 *
	 * E il `|| c.id === categoria` è la stessa correzione già applicata ai conti
	 * archiviati qui sotto: cambiando tipo con una categoria attiva, quella
	 * sparirebbe dall'elenco lasciando la lista filtrata su un id che il chip non
	 * sa più nominare — filtro impossibile da azzerare, chip che mente.
	 */
	// ⚠️ `categoryTypeFor` e non `tipo` nudo: filtrando per "Disinvestimenti" la
	// tendina si svuoterebbe, perché cercherebbe categorie di un tipo che
	// `categories_type_check` non ammette. Le vendite usano quelle degli
	// investimenti (#52).
	const selectableCats = categories.filter(
		(c) => (!tipo || c.type === categoryTypeFor(tipo)) || c.id === categoria,
	);
	const categoriaOptions = [
		{ value: "", label: t.transactions.filterAllCategories },
		...selectableCats.map((c) => ({ value: c.id, label: c.name })),
	];

	const tipoLabel = tipoOptions.find((o) => o.value === tipo)?.label ?? t.transactions.filterAll;
	const categoriaLabel =
		categoriaOptions.find((o) => o.value === categoria)?.label ??
		t.transactions.filterAllCategories;
	const contoLabel = contoOptions.find((o) => o.value === conto)?.label ?? t.accounts.all;
	const periodoLabel = periodoOptions.find((o) => o.value === periodo)?.label ?? t.transactions.periods["30d"];

	return (
		<div className="space-y-3" ref={ref}>
			{/* Search */}
			<div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card ring-border">
				<Search size={15} className="text-muted shrink-0" />
				<input
					type="text"
					placeholder={t.transactions.searchPlaceholder}
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
					className="bg-transparent text-sm flex-1 outline-none placeholder:text-muted"
				/>
			</div>

			{/*
				Filtri.

				⚠️ `flex-wrap` e NON `overflow-x-auto`. Con quattro chip la riga non
				entra in 414px, e la soluzione istintiva — scorrimento orizzontale —
				qui è una trappola: le tendine sono `absolute` DENTRO questo
				contenitore, e per specifica CSS un asse non `visible` ritaglia anche
				l'altro. Ogni menu verrebbe tagliato dal bordo del contenitore invece
				di aprirsi sopra la lista. È la stessa regola già pagata dal carosello
				della home, dove `overflow-x-auto` ritagliava il `box-shadow`.
			*/}
			<div className="flex flex-wrap items-center gap-2">
				{/* Periodo dropdown */}
				<div className="relative">
					<button
						onClick={() => setOpen(open === "periodo" ? null : "periodo")}
						className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card ring-border text-sm font-medium"
					>
						{periodoLabel}
						<ChevronDown size={13} className={`text-muted transition-transform ${open === "periodo" ? "rotate-180" : ""}`} />
					</button>
					{open === "periodo" && (
						<div className="absolute top-full mt-1.5 left-0 z-20 min-w-36 rounded-2xl bg-deep overflow-hidden card-shadow-ring">
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
						className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card ring-border text-sm font-medium"
					>
						{tipoLabel}
						<ChevronDown size={13} className={`text-muted transition-transform ${open === "tipo" ? "rotate-180" : ""}`} />
					</button>
					{open === "tipo" && (
						<div className="absolute top-full mt-1.5 left-0 z-20 min-w-40 rounded-2xl bg-deep overflow-hidden card-shadow-ring">
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
					Categoria (#9) — nascosto se non ce ne sono di proponibili, per la
					stessa ragione per cui il conto si nasconde con un conto solo: un
					comando che non può cambiare niente è rumore.
				*/}
				{(selectableCats.length > 0 || categoria) && (
					<div className="relative">
						<button
							onClick={() => setOpen(open === "categoria" ? null : "categoria")}
							className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card ring-border text-sm font-medium max-w-44"
						>
							<span className="truncate">{categoriaLabel}</span>
							<ChevronDown size={13} className={`text-muted shrink-0 transition-transform ${open === "categoria" ? "rotate-180" : ""}`} />
						</button>
						{open === "categoria" && (
							// ⚠️ `max-h` + scorrimento interno: le categorie possono essere
							// decine, e senza tetto la tendina uscirebbe dallo schermo con
							// le ultime voci irraggiungibili. Stessa difesa di `Select`
							// nella Fase 21.
							<div className="absolute top-full mt-1.5 left-0 z-20 min-w-44 max-h-64 overflow-y-auto rounded-2xl bg-deep card-shadow-ring">
								{categoriaOptions.map((opt) => (
									<button
										key={opt.value}
										onClick={() => { onCategoriaChange(opt.value); setOpen(null); }}
										className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-card"
									>
										<span className="truncate">{opt.label}</span>
										{categoria === opt.value && <Check size={13} className="text-midori shrink-0" />}
									</button>
								))}
							</div>
						)}
					</div>
				)}

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
							className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-card ring-border text-sm font-medium"
						>
							{contoLabel}
							<ChevronDown size={13} className={`text-muted transition-transform ${open === "conto" ? "rotate-180" : ""}`} />
						</button>
						{open === "conto" && (
							<div className="absolute top-full mt-1.5 right-0 z-20 min-w-44 rounded-2xl bg-deep overflow-hidden card-shadow-ring">
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

				{/*
					Azzera (#9) — compare SOLO quando c'è qualcosa da azzerare.

					⚠️ Un comando sempre presente ma inerte per metà del tempo insegna a
					ignorarlo, ed è la stessa ragione per cui l'avviso del job
					giornaliero compare solo in caso di problema: *una spia sempre verde
					smette di essere guardata*. È la PAGINA a decidere quando c'è
					qualcosa da azzerare, perché è lei a sapere quali sono i valori di
					partenza — questo componente vede i filtri ma non i loro default.
				*/}
				{onReset && (
					<button
						onClick={() => { onReset(); setOpen(null); }}
						className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl ring-border text-sm font-medium text-secondary"
					>
						<X size={13} className="text-muted shrink-0" />
						{t.transactions.resetFilters}
					</button>
				)}
			</div>
		</div>
	);
}
