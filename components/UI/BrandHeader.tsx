import { Sprout } from "lucide-react";

export default function BrandHeader() {
	return (
		// Logo, Title, Subtitle
		<div className="flex flex-col items-center text-center mb-6">
			<div className="w-16 h-16 2xl:w-24 2xl:h-24 flex items-center justify-center border border-glass-border rounded-3xl 2xl:rounded-3xl bg-surface-elevated backdrop-blur-md mb-4">
				<Sprout size={30} className="text-midori 2xl:hidden" />
				<Sprout size={42} className="text-midori hidden 2xl:block" />
			</div>
			<h1 className="text-2xl md:text-5xl 2xl:text-6xl font-semibold mb-1 md:mb-3.5">
				Seichi
			</h1>
			<h3 className="text-xs 2xl:text-sm text-muted uppercase tracking-widest">
				整地 · ordine finanziario
			</h3>
		</div>
	);
}
