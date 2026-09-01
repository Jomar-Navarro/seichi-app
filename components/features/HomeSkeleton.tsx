/** Skeleton di caricamento della Home — respiro zen, rispecchia il layout reale della dashboard */
export default function HomeSkeleton() {
	return (
		<div className="relative flex flex-col gap-4 px-5 pt-7 pb-32">
			{/* Anche qui, o gli aloni compaiono di colpo quando la dashboard risolve */}
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="circle-1" />
				<div className="circle-3" />
			</div>
			{/* Header — rispecchia il layout reale: avatar tondo col saluto e il
			    nome a SINISTRA, e a destra DUE pastiglie — il coach e la campanella.
			    Se diverge, la pagina salta a ogni caricamento freddo.
			    ⚠️ La seconda è arrivata con la 24b, e per un commit non c'era: il
			    Suspense è chiavato sull'id del conto, quindi lo scheletro ricompare
			    a OGNI cambio conto e la pastiglia mancante spuntava ogni volta. */}
			<div className="flex items-center justify-between mb-1">
				<div className="flex items-center gap-3">
					<div className="w-10.5 h-10.5 rounded-full zg-pulse shrink-0" style={{ background: "var(--surface-elevated)" }} />
					<div className="flex flex-col gap-2">
						<div className="h-2.5 w-16 rounded-full zg-pulse" style={{ background: "var(--surface-elevated)", animationDelay: "0.1s" }} />
						<div className="h-3.5 w-24 rounded-full zg-pulse" style={{ background: "var(--surface-elevated)", animationDelay: "0.15s" }} />
					</div>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					<div className="w-10.5 h-10.5 rounded-[14px] zg-pulse" style={{ background: "var(--surface-elevated)" }} />
					<div className="w-10.5 h-10.5 rounded-[14px] zg-pulse" style={{ background: "var(--surface-elevated)", animationDelay: "0.05s" }} />
				</div>
			</div>

			{/*
				Selettore conti — la pastiglia "Tutti i conti".
				⚠️ Mancava, e dalla 20a la sua assenza si vede a ogni caricamento:
				`page.tsx` ha una `key` sul Suspense legata al conto, quindi questo
				skeleton riappare **a ogni cambio di conto**, non solo a freddo. Ogni
				divergenza dal layout reale diventa un salto verticale che l'utente
				vede molte volte al giorno.
			*/}
			<div
				className="h-9 w-32 rounded-2xl zg-pulse"
				style={{ background: "var(--surface-elevated)" }}
			/>

			{/* Carosello flusso/saldo — una card sola più i puntini sotto. */}
			<div>
				<div className="rounded-3xl h-40 zg-pulse" style={{ background: "var(--card)" }} />
				<div className="flex items-center justify-center gap-1.5 mt-3">
					<span className="h-1.5 w-5.5 rounded-full" style={{ background: "var(--border)" }} />
					<span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--border)" }} />
				</div>
			</div>

			{/* Summary grid */}
			<div className="grid grid-cols-2 gap-3">
				{[0, 1, 2, 3].map((i) => (
					<div
						key={i}
						className="rounded-2xl h-23 zg-pulse"
						style={{
							background: "var(--card)",
							animationDelay: `${i * 0.12}s`,
						}}
					/>
				))}
			</div>

			{/* Analisi shortcut */}
			<div
				className="rounded-2xl h-16.5 zg-pulse"
				style={{ background: "var(--card)", animationDelay: "0.2s" }}
			/>

			{/* Recent label */}
			<div
				className="h-3 w-32 rounded-full zg-pulse"
				style={{ background: "var(--surface-elevated)" }}
			/>

			{/* Recent list */}
			<div
				className="rounded-3xl overflow-hidden border border-subtle card-shadow"
				style={{ background: "var(--card)" }}
			>
				{[0, 1, 2].map((i) => (
					<div
						key={i}
						className="flex items-center gap-3 px-4 py-3.5"
						style={{
							borderBottom: i < 2 ? "1px solid var(--border)" : undefined,
						}}
					>
						<div
							className="w-10 h-10 rounded-xl zg-pulse shrink-0"
							style={{
								background: "var(--surface-elevated)",
								animationDelay: `${i * 0.15}s`,
							}}
						/>
						<div className="flex-1 flex flex-col gap-2">
							<div
								className="h-2.5 rounded-full zg-pulse"
								style={{
									background: "var(--surface-elevated)",
									width: "55%",
									animationDelay: `${i * 0.15 + 0.1}s`,
								}}
							/>
							<div
								className="h-2 rounded-full zg-pulse"
								style={{
									background: "var(--surface-elevated)",
									width: "32%",
									animationDelay: `${i * 0.15 + 0.2}s`,
								}}
							/>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
