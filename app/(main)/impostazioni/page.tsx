import { SettingsIcon } from "@/lib/seichi-icons";

export default function ImpostazioniPage() {
	return (
		<div className="flex flex-col px-5 pt-7 pb-36">
			<h1 className="text-[26px] font-semibold leading-tight mb-1.5">Impostazioni</h1>
			<p className="text-[12.5px] text-muted mb-8">Personalizza la tua esperienza</p>

			<div className="flex flex-col items-center justify-center py-16 text-center">
				<div
					className="w-18 h-18 rounded-3xl flex items-center justify-center mb-5 border border-subtle card-shadow"
					style={{ background: "var(--surface)" }}
				>
					<SettingsIcon size={30} strokeWidth={1.4} style={{ color: "var(--color-kiri)" }} />
				</div>
				<p className="text-[18px] font-semibold mb-2.5">In arrivo</p>
				<p className="text-sm text-muted leading-relaxed max-w-65">
					Le impostazioni saranno disponibili in una prossima versione.
				</p>
			</div>
		</div>
	);
}
