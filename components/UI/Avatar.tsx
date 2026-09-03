import Image from "next/image";

interface AvatarProps {
	/** URL pubblico della foto profilo, se caricata */
	src?: string | null;
	/** Iniziali di fallback (vedi lib/profile.ts) */
	initials: string;
	/** Lato in px — l'avatar è sempre quadrato */
	size?: number;
	className?: string;
}

export default function Avatar({ src, initials, size = 60, className = "" }: AvatarProps) {
	return (
		<span
			className={`relative rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-control ring-border ${className}`}
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
