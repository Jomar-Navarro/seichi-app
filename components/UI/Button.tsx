interface ButtonProps {
	title: string;
	icon?: React.ReactNode;
	variant?: "primary" | "oauth";
}

export default function Button({ title, icon, variant }: ButtonProps) {
	return variant === "oauth" ? (
		<button className="grow shrink basis-0 flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-white/10 bg-background-tsuki/5 text-sm font-medium cursor-pointer backdrop-blur-md">
			{icon}
			<span>{title}</span>
		</button>
	) : (
		<button className="w-full p-4 rounded-2xl bg-seichi-ao text-seichi-yoru font-bold cursor-pointer shadow-xl shadow-seichi-ao/30 mb-5">
			{title}
		</button>
	);
}
