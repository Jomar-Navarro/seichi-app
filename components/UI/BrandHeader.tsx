"use client";

import { Sprout } from "lucide-react";
import { useI18n } from "@/components/features/I18nProvider";

export default function BrandHeader() {
	const { t } = useI18n();

	return (
		// Logo, Title, Subtitle
		<div className="flex flex-col items-center text-center mb-6">
			{/* ⚠️ TRE livelli — issue #81. Guscio → vetro → contenuto. */}
			<div className="relative w-24 h-24 2xl:w-32 2xl:h-32 rounded-3xl ring-border overflow-hidden mb-4">
				<div className="absolute inset-0 bg-surface-elevated backdrop-blur-md" />
				<div className="relative w-full h-full flex items-center justify-center">
					<Sprout size={40} className="text-midori 2xl:hidden" />
					<Sprout size={54} className="text-midori hidden 2xl:block" />
				</div>
			</div>
			<h1 className="text-5xl 2xl:text-7xl font-semibold mb-3 md:mb-3.5">
				Seichi
			</h1>
			{/* 整地 resta: è il nome giapponese da cui viene "Seichi". */}
			<h3 className="text-xs 2xl:text-base text-muted uppercase tracking-widest">
				整地 · {t.brand.tagline}
			</h3>
		</div>
	);
}
