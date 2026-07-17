"use client";

import {
	ArrowDownLeft,
	ArrowUpRight,
	ChevronLeft,
	ChevronRight,
	PiggyBank,
	RefreshCw,
	TrendingUp,
	X,
} from "lucide-react";
import type { ElementType } from "react";
import { useState } from "react";
import { useUIStore } from "@/store/useUIStore";

interface TransactionType {
	id: string;
	label: string;
	description: string;
	color: string;
	icon: ElementType;
}

const TRANSACTION_TYPES: TransactionType[] = [
	{
		id: "spesa",
		label: "Uscita",
		description: "Spese e acquisti quotidiani",
		color: "var(--color-aka)",
		icon: ArrowUpRight,
	},
	{
		id: "entrata",
		label: "Entrata",
		description: "Stipendio, rimborsi, regali",
		color: "var(--color-midori)",
		icon: ArrowDownLeft,
	},
	{
		id: "risparmio",
		label: "Risparmio",
		description: "Accantonamenti e obiettivi",
		color: "var(--color-kin)",
		icon: PiggyBank,
	},
	{
		id: "investimento",
		label: "Investimento",
		description: "Mercati, fondi, portafoglio",
		color: "var(--color-ao)",
		icon: TrendingUp,
	},
	{
		id: "abbonamento",
		label: "Ricorrente",
		description: "Abbonamenti e pagamenti fissi",
		color: "var(--color-murasaki)",
		icon: RefreshCw,
	},
];

export default function TransactionModal() {
	const {
		isTransactionModalOpen,
		selectedTransactionType,
		closeTransactionModal,
		setTransactionType,
	} = useUIStore();

	const [step, setStep] = useState<"type" | "form">("type");

	const selectedType = TRANSACTION_TYPES.find(
		(t) => t.id === selectedTransactionType,
	);

	function handleTypeSelect(id: string) {
		setTransactionType(id);
		setStep("form");
	}

	function handleClose() {
		closeTransactionModal();
		setStep("type");
	}

	if (!isTransactionModalOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-end">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={handleClose}
			/>

			{/* Sheet */}
			<div className="relative w-full flex flex-col h-195 rounded-t-4xl backdrop-blur-2xl pt-3.5 px-6 pb-6.5 modal-shadow border-t border-l border-r border-subtle bg-modal">
				{/* Handle */}
				<div className="w-10 h-1 rounded-full mx-auto mb-1 bg-modal-handle" />

				{/* Header */}
				<div className="flex items-start justify-between mt-3 mb-4">
					<div className="flex items-center gap-2">
						{step === "form" && (
							<button
								onClick={() => setStep("type")}
								className="w-8 h-8 flex items-center justify-center rounded-full shrink-0 bg-control border border-subtle"
							>
								<ChevronLeft size={16} />
							</button>
						)}
						<div>
							{step === "form" && selectedType && (
								<p
									className="text-xs font-medium mb-0.5"
									style={{ color: selectedType.color }}
								>
									{selectedType.label}
								</p>
							)}
							<h2 className="text-xl font-semibold">Nuovo movimento</h2>
							{step === "type" && (
								<p className="text-sm text-muted mt-1">
									Che tipo di movimento vuoi registrare?
								</p>
							)}
						</div>
					</div>
					<button
						onClick={handleClose}
						className="w-8 h-8 flex items-center justify-center rounded-full shrink-0 bg-control border border-subtle"
					>
						<X size={15} />
					</button>
				</div>

				{/* Step: type selector */}
				{step === "type" && (
					<div className="flex-1 min-h-0 grid grid-cols-2 grid-rows-3 gap-2.25">
						{TRANSACTION_TYPES.map((type, i) => {
							const Icon = type.icon;
							const isLast = i === TRANSACTION_TYPES.length - 1;
							const isSelected = selectedTransactionType === type.id;

							const card = (
								<button
									key={type.id}
									onClick={() => handleTypeSelect(type.id)}
									className="transaction-type-card"
									style={
										isSelected
											? {
													background: `color-mix(in srgb, ${type.color} 14%, transparent)`,
													border: `1px solid color-mix(in srgb, ${type.color} 36%, transparent)`,
												}
											: {}
									}
								>
									{isSelected ? (
										<span
											className="absolute top-3 left-3.5 text-xs font-semibold"
											style={{ color: type.color }}
										>
											✓
										</span>
									) : (
										<ChevronRight
											size={14}
											className="absolute top-3 right-3 text-muted"
										/>
									)}

									<div
										className="w-11 h-11 rounded-xl flex items-center justify-center"
										style={{
											background: `color-mix(in srgb, ${type.color} 20%, transparent)`,
										}}
									>
										<Icon size={20} style={{ color: type.color }} />
									</div>

									<div>
										<p className="font-semibold text-sm">{type.label}</p>
										<p className="text-[11px] text-muted mt-0.5 leading-tight">
											{type.description}
										</p>
									</div>
								</button>
							);

							if (isLast) {
								return (
									<div key={type.id} className="col-span-2">
										{card}
									</div>
								);
							}

							return card;
						})}
					</div>
				)}

				{/* Step: form placeholder */}
				{step === "form" && (
					<div className="flex-1 flex flex-col items-center justify-center gap-2">
						<p className="text-muted text-sm">Form per</p>
						<p
							className="text-lg font-semibold"
							style={{ color: selectedType?.color }}
						>
							{selectedType?.label}
						</p>
						<p className="text-muted text-xs mt-2">— da implementare —</p>
					</div>
				)}
			</div>
		</div>
	);
}
