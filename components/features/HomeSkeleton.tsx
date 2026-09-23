/** Skeleton di caricamento della Home — respiro zen, rispecchia il layout reale della dashboard */
export default function HomeSkeleton() {
	return (
		/*
			⚠️ Da `lg:` segue il layout desktop della pagina (issue #108): stesso
			contenitore, header senza avatar col selettore in riga, saldo e flusso
			affiancati, quattro tessere e da `xl:` movimenti e Analisi in due
			colonne. Il Suspense della home è chiavato sul conto, quindi questo
			scheletro ricompare a OGNI cambio di conto: con la sola forma da
			telefono, su desktop la pagina saltava ogni volta (review del #108).
		*/
		<div className="relative flex flex-col gap-4 px-5 pt-7 pb-32 lg:px-10 lg:pt-9 lg:pb-12 lg:max-w-6xl lg:mx-auto lg:w-full lg:gap-5.5">
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
			    a OGNI cambio conto e la pastiglia mancante spuntava ogni volta.
			    Da `lg:` niente avatar (il menu profilo vive nel footer della
			    sidebar) e la pastiglia del selettore sta in riga col saluto. */}
			<div className="flex items-center justify-between mb-1 lg:mb-0">
				<div className="flex items-center gap-3 lg:gap-7">
					<div className="w-10.5 h-10.5 rounded-full zg-pulse shrink-0 lg:hidden" style={{ background: "var(--surface-elevated)" }} />
					<div className="flex flex-col gap-2">
						<div className="h-2.5 w-16 rounded-full zg-pulse" style={{ background: "var(--surface-elevated)", animationDelay: "0.1s" }} />
						<div className="h-3.5 w-24 rounded-full zg-pulse lg:h-5 lg:w-36" style={{ background: "var(--surface-elevated)", animationDelay: "0.15s" }} />
					</div>
					<div
						className="hidden lg:block h-12 w-28 rounded-2xl zg-pulse"
						style={{ background: "var(--surface-elevated)", animationDelay: "0.2s" }}
					/>
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
				vede molte volte al giorno. Da `lg:` è nella riga del saluto, sopra.
			*/}
			<div
				className="h-9 w-32 rounded-2xl zg-pulse lg:hidden"
				style={{ background: "var(--surface-elevated)" }}
			/>

			{/* Carosello flusso/saldo — una card sola più i puntini sotto; da `lg:`
			    le due card affiancate come nella pagina, e i puntini spariscono. */}
			<div>
				<div className="lg:grid lg:grid-cols-[1.15fr_1fr] lg:gap-4.5">
					<div className="rounded-3xl h-40 zg-pulse lg:rounded-[28px] lg:h-63" style={{ background: "var(--card)" }} />
					<div className="hidden lg:block rounded-[28px] h-63 zg-pulse" style={{ background: "var(--card)", animationDelay: "0.1s" }} />
				</div>
				<div className="flex items-center justify-center gap-1.5 mt-3 lg:hidden">
					<span className="h-1.5 w-5.5 rounded-full" style={{ background: "var(--border)" }} />
					<span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--border)" }} />
				</div>
			</div>

			{/* Summary grid */}
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
				{[0, 1, 2, 3].map((i) => (
					<div
						key={i}
						className="rounded-2xl h-23 zg-pulse lg:rounded-[22px] lg:h-34"
						style={{
							background: "var(--card)",
							animationDelay: `${i * 0.12}s`,
						}}
					/>
				))}
			</div>

			{/* Scorciatoia Analisi e movimenti recenti: impilati, e da `xl:` in due
			    colonne come nella pagina — i movimenti a sinistra, Analisi a destra
			    allineata alla card della lista. */}
			<div className="flex flex-col gap-4 xl:grid xl:grid-cols-[1.6fr_1fr] xl:gap-4.5 xl:items-start">
				{/* Analisi shortcut */}
				<div
					className="rounded-2xl h-16.5 zg-pulse xl:order-2 xl:rounded-3xl xl:h-56 xl:mt-8.5"
					style={{ background: "var(--card)", animationDelay: "0.2s" }}
				/>

				<div className="flex flex-col gap-4 xl:order-1">
					{/* Recent label */}
					<div
						className="h-3 w-32 rounded-full zg-pulse"
						style={{ background: "var(--surface-elevated)" }}
					/>

					{/* Recent list */}
					<div
						className="rounded-3xl overflow-hidden card-shadow-ring"
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
			</div>
		</div>
	);
}
