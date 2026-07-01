import LoginForm from "@/components/LoginForm";

export default function LoginPage({}) {
	return (
		<>
			<div className="h-lvh relative z-1 grow shrink basis-0 flex flex-col pt-12 px-7 pb-9 overflow-x-hidden">
				{/* Background Circles */}
				<div className="circle-1"></div>
				<div className="circle-2"></div>
				<div className="circle-3"></div>

				<LoginForm />
			</div>
		</>
	);
}
