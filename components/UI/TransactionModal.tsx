"use client";

import { ChevronLeft, ChevronRight, X, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { useUIStore } from "@/store/useUIStore";
import { TRANSACTION_TYPES } from "@/types";
import TransactionForm from "./TransactionForm";
import { useI18n } from "@/components/features/I18nProvider";

/**
 * ⚠️ Diviso in due, e il guscio esiste solo per decidere il MONTAGGIO.
 *
 * Questo componente lo rende il layout di `(main)`, quindi non c'è un genitore
 * che possa montarlo e smontarlo come fanno `GoalSheet`, `CategorySheet` e
 * `RecurringSheet`. Prima restava perciò montato per sempre e si nascondeva da
 * sé, con `step` che sopravviveva alla chiusura e andava riportato al valore
 * giusto in un `useLayoutEffect` — un render a cascata a ogni apertura.
 *
 * Ora il guscio legge lo store e monta il contenuto solo da aperto. La `key`
 * distingue "modifica questa transazione" da "nuova": passando dall'una all'altra
 * senza chiudere, React rimonta invece di riusare `step`.
 */
export default function TransactionModal() {
	const { isTransactionModalOpen, editingTransaction } = useUIStore();

	if (!isTransactionModalOpen) return null;

	return <TransactionModalContent key={editingTransaction?.id ?? "new"} />;
}

function TransactionModalContent() {
	const {
		selectedTransactionType,
		editingTransaction,
		closeTransactionModal,
		setTransactionType,
	} = useUIStore();
	const { t } = useI18n();

	// Il passo iniziale è una funzione del contesto di apertura, e il montaggio è
	// esattamente quel momento: nessun effetto da scrivere.
	const [step, setStep] = useState<"type" | "form">(
		editingTransaction ? "form" : "type",
	);

	// Blocca lo scroll della pagina dietro il modale. Ora che il componente vive
	// solo da aperto, la guardia sullo stato del modale non serve: montaggio e
	// smontaggio SONO apertura e chiusura, e il ripristino torna a essere un
	// normale cleanup.
	useEffect(() => {
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = prev;
		};
	}, []);

	const selectedType = editingTransaction
		? TRANSACTION_TYPES.find((t) => t.id === editingTransaction.type) ?? TRANSACTION_TYPES[0]
		: TRANSACTION_TYPES.find((t) => t.id === selectedTransactionType);

	function handleTypeSelect(id: string) {
		setTransactionType(id);
		setStep("form");
	}

	// Nessun `setStep("type")` qui: chiudere smonta, e con lo smontaggio `step`
	// se ne va da sé. Riportarlo a mano era la contropartita del componente che
	// restava vivo per sempre.
	function handleClose() {
		closeTransactionModal();
	}

	return (
		<div className="fixed inset-0 z-50 flex items-end">
			{/* Backdrop */}
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={handleClose}
			/>

			{/* Sheet */}
			<div className="relative w-full flex flex-col h-dvh rounded-t-4xl backdrop-blur-2xl pt-3.5 px-6 pb-6.5 modal-shadow border-t border-l border-r border-subtle bg-modal">
				{/* Handle */}
				<div className="w-10 h-1 rounded-full mx-auto mb-1 bg-modal-handle" />

				{/* Header */}
				<div className="flex items-start justify-between mt-3 mb-4">
					<div className="flex items-center gap-2">
						{step === "form" && !editingTransaction && (
							<button
								onClick={() => setStep("type")}
								className="w-8 h-8 flex items-center justify-center rounded-xl shrink-0 bg-control border border-subtle"
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
									{t.transactionTypes[selectedType.id].label}
								</p>
							)}
							<h2 className="text-xl font-semibold">
								{editingTransaction ? t.transactions.modalEdit : t.transactions.modalNew}
							</h2>
							{step === "type" && (
								<p className="text-sm text-muted mt-1">
									{t.transactions.modalTypeQuestion}
								</p>
							)}
						</div>
					</div>
					<button
						onClick={handleClose}
						className="w-8 h-8 flex items-center justify-center rounded-xl shrink-0 bg-control border border-subtle"
					>
						<X size={15} />
					</button>
				</div>

				{/* Step: type selector */}
				{step === "type" && (
					/*
					 * ⚠️ Il numero di righe si CALCOLA, e prima era cablato a
					 * `grid-rows-3`.
					 *
					 * Con sei tipi la griglia 2×3 era esatta e il numero fisso
					 * coincideva; col settimo (`disinvestimento`, #52) servono quattro
					 * righe — tre coppie più la card larga — e le card in eccesso
					 * finivano in una riga IMPLICITA, dimensionata dal contenuto, dentro
					 * un contenitore `flex-1 min-h-0` che non può crescere: le tre righe
					 * esplicite si schiacciavano per farle posto.
					 *
					 * È lo stesso difetto di `spansFullRow` qui sotto — un numero scritto
					 * a mano che coincide con la realtà finché nessuno aggiunge un tipo —
					 * e si chiude allo stesso modo: derivandolo dall'array, che è
					 * l'unica fonte che non può divergere da sé.
					 *
					 * `gridTemplateRows` inline e non una classe Tailwind: le classi sono
					 * statiche, quindi `grid-rows-${n}` non verrebbe generata e
					 * fallirebbe in silenzio — la famiglia di difetti che
					 * `npm run audit:tokens` esiste per intercettare.
					 */
					<div
						className="flex-1 min-h-0 grid grid-cols-2 gap-2.25"
						style={{
							gridTemplateRows: `repeat(${Math.ceil(
								TRANSACTION_TYPES.length / 2,
							)}, minmax(0, 1fr))`,
						}}
					>
						{TRANSACTION_TYPES.map((type, i) => {
							const Icon = type.icon;
							/*
								⚠️ La card a tutta larghezza serve a RIEMPIRE una griglia
								dispari, non a dare risalto all'ultimo tipo.
								Era `i === length - 1`, e con cinque tipi coincideva: la
								quinta card chiudeva la terza riga da sola. Aggiungendo
								`trasferimento` i tipi sono sei — la griglia 2×3 è esatta — e
								quella stessa riga avrebbe messo la sesta card su una quarta
								riga inesistente, dentro un contenitore `flex-1 min-h-0` che
								non può crescere: le card si sarebbero schiacciate e l'ultima
								sarebbe uscita dal riquadro.
								Il difetto non lo vede né `tsc` né il lint. Si vede aprendo
								il modale — e solo dopo aver aggiunto un tipo, cioè una volta
								ogni due anni.
							*/
							const spansFullRow =
								TRANSACTION_TYPES.length % 2 === 1 && i === TRANSACTION_TYPES.length - 1;
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
											className="absolute top-3 right-3.5 text-xs font-semibold"
											style={{ color: type.color }}
										>
											<Check size={18} />
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
										<p className="font-semibold text-sm">{t.transactionTypes[type.id].label}</p>
										<p className="text-[11px] text-muted mt-0.5 leading-tight">
											{t.transactionTypes[type.id].description}
										</p>
									</div>
								</button>
							);

							if (spansFullRow) {
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

				{/* Step: form */}
				{step === "form" && selectedType && (
					<TransactionForm
						selectedType={selectedType}
						transaction={editingTransaction ?? undefined}
					/>
				)}
			</div>
		</div>
	);
}
