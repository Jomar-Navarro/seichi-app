import { Sprout } from "lucide-react";

export default function BrandHeader() {
	return (
		// Logo, Title, Subtitle
		<div className="flex flex-col items-center text-center mb-6">
			<div className="w-16 h-16 flex items-center justify-center border border-glass-border rounded-3xl bg-surface-elevated backdrop-blur-md mb-4">
				<Sprout size={30} className="text-midori" />
			</div>
			<h1 className="text-2xl font-semibold mb-1">Seichi</h1>
			<h3 className="text-xs text-muted uppercase tracking-widest">
				整地 · ordine finanziario
			</h3>
		</div>
	);
}
