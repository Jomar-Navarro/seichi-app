"use client";
import { Home, List, Plus, ChartPie, ChartNoAxesColumn } from "lucide-react";
import { useUIStore } from "@/store/useUIStore";

export default function BottomNav() {
	const { openTransactionModal } = useUIStore();
	return (
		<div className="absolute left-[50%] translate-[-50%] bottom-0 min-w-88 flex items-center justify-between py-2.5 px-4 rounded-3xl z-6 border border-subtle bg-surface backdrop-blur-[26px] box-shadow h-16">
			<div className="flex flex-col items-center gap-1 w-13.5 cursor-pointer justify-between">
				<Home />
			</div>

			<div className="flex flex-col items-center gap-1 w-13.5 cursor-pointer justify-between">
				<List />
			</div>

			<button
				onClick={openTransactionModal}
				className="w-13.5 h-13.5 mb-1 rounded-2xl shrink-0 fab flex items-center justify-center cursor-pointer -translate-y-4.5"
			>
				<Plus />
			</button>

			<div className="flex flex-col items-center gap-1 w-13.5 cursor-pointer justify-between">
				<ChartPie />
			</div>

			<div className="flex flex-col items-center gap-1 w-13.5 cursor-pointer justify-between">
				<ChartNoAxesColumn />
			</div>
		</div>
	);
}
