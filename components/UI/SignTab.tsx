interface SignTabProps {
	onSignUp: () => void;
	onSignIn: () => void;
	activeTab: "signin" | "signup";
}

export default function SignTab({
	onSignUp,
	onSignIn,
	activeTab,
}: SignTabProps) {
	return (
		<>
			{/* Segmented tab control */}
			<div className="flex p-1 rounded-2xl segment-tab mb-7">
				<button
					onClick={onSignIn}
					type="button"
					className={`grow shrink basis-0 p-3 rounded-2xl cursor-pointer text-sm font-semibold ${activeTab === "signin" ? "active-tab" : ""}`}
				>
					Accedi
				</button>
				<button
					onClick={onSignUp}
					type="button"
					className={`grow shrink basis-0 p-3 rounded-2xl cursor-pointer text-sm font-semibold ${activeTab === "signup" ? "active-tab" : ""}`}
				>
					Registrati
				</button>
			</div>
		</>
	);
}
