import SignUpForm from "@/components/SignUpForm";

export default function SignUpPage() {
	return (
		<>
			<div className="h-lvh relative z-1 grow shrink basis-0 flex flex-col pt-16 px-7 pb-9 overflow-hidden">
				{/* Background Circles */}
				<div className="circle-1"></div>
				<div className="circle-2"></div>
				<div className="circle-3"></div>

				<SignUpForm />
			</div>
		</>
	);
}
