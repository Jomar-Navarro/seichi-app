"use client";
import { useState } from "react";
import LoginForm from "@/components/LoginForm";
import SignUpForm from "@/components/SignUpForm";

export default function Sign() {
	const [tab, setTab] = useState<"signin" | "signup">("signin");
	return (
		<>
			<div className="h-lvh relative z-1 grow shrink basis-0 flex flex-col overflow-hidden">
				{/* Background Circles */}
				<div className="circle-1"></div>
				<div className="circle-3"></div>
				{tab === "signup" ? (
					<SignUpForm onTabChange={setTab} />
				) : (
					<LoginForm onTabChange={setTab} />
				)}
			</div>
		</>
	);
}
