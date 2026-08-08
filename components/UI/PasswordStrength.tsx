"use client";

import { scorePassword } from "@/lib/password";
import { useI18n } from "@/components/features/I18nProvider";

/**
 * Indicatore a 3 barre. Il design del mockup le teneva neutre; qui usiamo i
 * colori semantici già definiti (aka → kin → midori) perché un indicatore
 * monocromatico costringe a leggere l'etichetta per capire il livello.
 */
export default function PasswordStrength({ password }: { password: string }) {
	const { t } = useI18n();
	if (!password) return null;

	const { score, color, ink } = scorePassword(password);
	const label = t.account.passwordCommon.strength[score];

	return (
		<div className="mb-5">
			<div className="flex gap-1.5 mx-0.5 mb-2">
				{[1, 2, 3].map((step) => (
					<span
						key={step}
						className="flex-1 h-1 rounded-full transition-colors"
						style={{ background: score >= step ? color : "var(--color-input)" }}
					/>
				))}
			</div>
			{/* L'inchiostro, non l'accento delle barre: a 11,5px è il caso peggiore
			    per il contrasto, e il livello è già portato dalle barre sopra. */}
			<p className="text-[11.5px] mx-0.5" style={{ color: ink }}>
				{label}
			</p>
		</div>
	);
}
