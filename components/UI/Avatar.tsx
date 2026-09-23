import Image from "next/image";

interface AvatarProps {
	/** URL pubblico della foto profilo, se caricata */
	src?: string | null;
	/** Iniziali di fallback (vedi lib/profile.ts) */
	initials: string;
	/** Lato in px — l'avatar è sempre quadrato */
	size?: number;
	/**
	 * Classe del raggio. Di default un cerchio; la sidebar e la card profilo
	 * desktop (issue #108) lo vogliono a quadrato arrotondato, come nel mockup.
	 * È una prop a sé e non un `className` in più perché `rounded-full` nella
	 * base e un secondo `rounded-*` passato da fuori si contenderebbero la
	 * stessa proprietà, con un esito deciso dall'ordine del CSS generato.
	 */
	rounded?: string;
	className?: string;
}

export default function Avatar({ src, initials, size = 60, rounded = "rounded-full", className = "" }: AvatarProps) {
	return (
		<span
			className={`relative ${rounded} overflow-hidden flex items-center justify-center shrink-0 bg-control ring-border ${className}`}
			style={{ width: size, height: size }}
		>
			{src ? (
				<Image
					src={src}
					alt=""
					width={size}
					height={size}
					sizes={`${size}px`}
					className="w-full h-full object-cover"
				/>
			) : (
				<span
					className="font-semibold text-secondary tracking-wide leading-none"
					style={{ fontSize: Math.round(size * 0.32) }}
				>
					{initials}
				</span>
			)}
		</span>
	);
}
