/** Skeleton di caricamento della Home — respiro zen, rispecchia il layout reale della dashboard */
export default function HomeSkeleton() {
	return (
		<div className="flex flex-col gap-4 px-5 pt-7 pb-32">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex flex-col gap-2">
					<div className="h-2.5 w-16 rounded-full zg-pulse" style={{ background: "var(--surface-elevated)" }} />
					<div className="h-3.5 w-28 rounded-full zg-pulse" style={{ background: "var(--surface-elevated)", animationDelay: "0.1s" }} />
				</div>
				<div className="w-10 h-10 rounded-full zg-pulse" style={{ background: "var(--surface-elevated)" }} />
			</div>

			{/* Balance card */}
			<div
				className="rounded-3xl h-34.5 zg-pulse"
				style={{ background: "var(--card)" }}
			/>

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
