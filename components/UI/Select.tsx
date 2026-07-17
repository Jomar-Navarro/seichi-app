"use client";
import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface Option {
	icon: React.ReactNode;
	label: string;
	value: string;
}

export interface DropdownProps {
	title: string;
	options: Option[];
	selected: string;
	onChange: (value: string) => void;
}

export default function Select({
	options,
	selected,
	onChange,
	title,
}: DropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const selectedOption = options.find((o) => o.value === selected);

	return (
		<div className={`relative mb-4.5 ${isOpen ? "z-30" : "z-20"}`}>
			<div className="text-xs tracking-[1.8px] uppercase text-muted mb-2.5 ms-1">
				{title}
			</div>
			<button
				onClick={() => setIsOpen((prev) => !prev)}
				className="w-full flex items-center justify-between py-3.5 px-4 rounded-[20px] cursor-pointer text-inherit bg-input border border-subtle backdrop-blur-[20px] box-shadow"
			>
				<span className="flex items-center gap-3">
					<span className="w-10 h-10 rounded-xl bg-input flex items-center justify-center text-lg text-primary">
						{selectedOption?.icon}
					</span>
					<span className="flex flex-col gap-1 text-start">
						<span className="text-sm font-semibold">
							{selectedOption?.label}
						</span>
						<span className="text-xs text-muted uppercase">
							{selectedOption?.value}
						</span>
					</span>
				</span>
				<ChevronDown size={17} className="text-muted" />
			</button>

			{isOpen && (
				<div className="absolute top-full mt-2 left-0 right-0 z-30 p-2 rounded-[20px] bg-deep border border-subtle backdrop-blur-[30px] input-shadow">
					{options.map((option) => (
						<div
							onClick={() => {
								onChange(option.value);
								setIsOpen(false);
							}}
							key={option.value}
							className="flex items-center justify-between py-2.5 px-3 cursor-pointer"
						>
							<span className="flex items-center gap-3">
								<span className="w-6 text-center text-sm text-primary">
									{option?.icon}
								</span>
								<span className="text-sm text-primary">{option.label}</span>
							</span>
							{option.value === selected && (
								<Check size={17} className="text-midori" />
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
