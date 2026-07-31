import type { ReactNode } from "react";

/** Cornice delle pagine auth secondarie: sfondo zen + colonna centrata. */
export default function AuthShell({ children }: { children: ReactNode }) {
	return (
		<div className="relative z-1 min-h-dvh flex flex-col overflow-hidden">
			<div className="circle-1" />
			<div className="circle-3" />

			<div className="relative grow flex flex-col justify-center w-full max-w-md mx-auto px-7 py-16">
				{children}
			</div>
		</div>
	);
}
