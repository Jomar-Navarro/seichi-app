"use client";
import { Check } from "lucide-react";

export interface Option {
	icon?: React.ReactNode;
	value: string;
	title: string;
	subTitle: string;
	color: {
		border: string;
		bg: string;
		icon: string;
		iconText: string;
		badge: string;
		shadow: string;
	};
}

export interface CardProps {
	options: Option[];
	onChange: (value: string) => void;
	selected: string[];
}

export default function Card({ options, onChange, selected }: CardProps) {
	return (
		<div className="grid grid-cols-2 gap-3">
			{options.map((option, index) => {
				const isSelected = selected.includes(option.value);
				const isLastOdd = index === options.length - 1 && options.length % 2 !== 0;
				return (
					<button
						key={option.value}
						onClick={() => onChange(option.value)}
						style={isSelected ? { boxShadow: option.color.shadow } : undefined}
						className={`relative text-start p-4.5 rounded-3xl cursor-pointer text-inherit flex flex-col transition-all border ${isLastOdd ? "col-span-2" : ""} ${isSelected ? `${option.color.bg} ${option.color.border}` : "bg-card border-subtle card-shadow"}`}
					>
						<span
							className={`w-10.5 h-10.5 rounded-xl flex items-center justify-center mb-3.5 transition-all ${isSelected ? `${option.color.icon} ${option.color.iconText}` : "bg-foreground/5 text-muted"}`}
						>
							{option.icon}
						</span>
						<span className="text-sm font-semibold mb-1">
							{option.title}
						</span>
						<span className="text-muted text-xs">{option.subTitle}</span>

						{isSelected && (
							<span
								className={`absolute top-3.5 right-3.5 w-5.5 h-5.5 rounded-full flex items-center justify-center ${option.color.badge}`}
							>
								<Check size={14} className="text-yoru" />
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
