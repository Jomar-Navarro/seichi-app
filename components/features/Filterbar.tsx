"use client";
import { Search, ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { TRANSACTION_TYPES } from "@/types";

interface FilterBarProps {
	search: string;
	tipo: string;
	periodo: string;
	onSearchChange: (v: string) => void;
	onTipoChange: (v: string) => void;
	onPeriodoChange: (v: string) => void;
}

const TIPO_FILTER_LABELS: Record<string, string> = {
	spesa: "Uscite",
	entrata: "Entrate",
	risparmio: "Risparmi",
	investimento: "Investimenti",
	abbonamento: "Abbonamenti",
};

const TIPO_OPTIONS = [
	{ value: "", label: "Tutte" },
	...TRANSACTION_TYPES.map((t) => ({ value: t.id, label: TIPO_FILTER_LABELS[t.id] ?? t.label })),
];

const PERIODO_OPTIONS = [
	{ value: "7d", label: "7 giorni" },
	{ value: "30d", label: "30 giorni" },
	{ value: "3m", label: "3 mesi" },
	{ value: "tutto", label: "Tutto" },
];

export default function FilterBar({ search, tipo, periodo, onSearchChange, onTipoChange, onPeriodoChange }: FilterBarProps) {
	const [open, setOpen] = useState<"periodo" | "tipo" | null>(null);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		function handleClick(e: PointerEvent) {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
		}
		document.addEventListener("pointerdown", handleClick);
		return () => document.removeEventListener("pointerdown", handleClick);
	}, []);

	const tipoLabel = TIPO_OPTIONS.find((o) => o.value === tipo)?.label ?? "Tutte";
	const periodoLabel = PERIODO_OPTIONS.find((o) => o.value === periodo)?.label ?? "30 giorni";

	return (
		<div className="space-y-3" ref={ref}>
			{/* Search */}
			<div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-subtle">
				<Search size={15} className="text-muted shrink-0" />
				<input
					type="text"
					placeholder="Cerca movimenti"
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
							{PERIODO_OPTIONS.map((opt) => (
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
							{TIPO_OPTIONS.map((opt) => (
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

			</div>
		</div>
	);
}
