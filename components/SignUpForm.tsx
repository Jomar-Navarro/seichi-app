"use client";

import { Mail, Lock, Eye, User, ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SignUpForm() {
	const router = useRouter();
	return (
		<>
			<div className="grow shrink basis-0 flex flex-col h-full">
				<div className="flex items-center gap-3 mb-8">
					<button
						onClick={() => router.push("/login")}
						className="w-10 h-10 flex shrink-0 items-center justify-center border border-white/15 rounded-xl bg-white/2 cursor-pointer backdrop-blur-md"
					>
						<ChevronLeft size={18} />
					</button>
					<div className="flex flex-col">
						<h1 className="text-2xl font-semibold">Crea il tuo account</h1>
						<h3 className="text-xs text-gray-400 mt-1 tracking-widest">
							Inizia a mettere ordine nelle tue finanze
						</h3>
					</div>
				</div>
				{/* Input form */}
				<div className="flex flex-col justify-center mb-2 gap-3">
					<form action="" className="flex flex-col justify-center my-3 gap-3">
						<div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
							<User size={18} className="shrink-0 text-gray-500" />
							<input
								id="name"
								name="name"
								type="text"
								required
								placeholder="Nome"
								className="bg-transparent outline-none text-gray-400 px-4 w-full"
							/>
						</div>

						<div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
							<User size={18} className="shrink-0 text-gray-500" />
							<input
								id="surname"
								name="surname"
								type="text"
								required
								placeholder="Cognome"
								className="bg-transparent outline-none text-gray-400 px-4 w-full"
							/>
						</div>

						<div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
							<Mail size={18} className="shrink-0 text-gray-500" />
							<input
								id="email"
								name="email"
								type="email"
								required
								placeholder="Email"
								className="bg-transparent outline-none text-gray-400 px-4 w-full"
							/>
						</div>

						<div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
							<Lock size={18} className="shrink-0 text-gray-500" />
							<input
								id="password"
								name="password"
								type="password"
								placeholder="Password"
								required
								className="bg-transparent outline-none text-gray-400 px-4 w-full"
							/>
							<button className="bg-transparent cursor-pointer p-1 flex items-center">
								<Eye size={18} className="shrink-0 text-gray-500" />
							</button>
						</div>

						<div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
							<Lock size={18} className="shrink-0 text-gray-500" />
							<input
								id="confirm-password"
								name="confirm-password"
								type="password"
								placeholder="Conferma password"
								required
								className="bg-transparent outline-none text-gray-400 px-4 w-full"
							/>
							<button className="bg-transparent cursor-pointer p-1 flex items-center">
								<Eye size={18} className="shrink-0 text-gray-500" />
							</button>
						</div>
					</form>
				</div>

				<div className="flex flex-col items-center gap-2 mb-5">
					<div className="flex items-center gap-1.5 w-full">
						<span className="grow shrink basis-0 h-1.5 rounded-sm bg-seichi-tsuki/5 transition-all"></span>
						<span className="grow shrink basis-0 h-1.5 rounded-sm bg-seichi-tsuki/5 transition-all"></span>
						<span className="grow shrink basis-0 h-1.5 rounded-sm bg-seichi-tsuki/5 transition-all"></span>
					</div>
				</div>

				<div className="flex items-start gap-3 mb-6 cursor-pointer">
					<input
						id="privacy"
						name="privacy"
						type="checkbox"
						className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-px"
					/>
					<div className="text-xs text-gray-400 tracking-wider">
						Accetto i{" "}
						<span className="text-seichi-ao">Termini di servizio</span> e l'
						<span className="text-seichi-ao">informativa sulla privacy</span> di
						Seichi.
					</div>
				</div>

				<button className="w-full p-4 rounded-2xl bg-seichi-ao text-seichi-yoru font-bold cursor-pointer shadow-xl shadow-seichi-ao/30 mb-5">
					Crea account
				</button>

				<div className="flex items-center gap-3 mb-5">
					<span className="grow shrink basis-0 h-px bg-background-tsuki/10"></span>
					<span className="text-[#727e95] text-xs">oppure</span>
					<span className="grow shrink basis-0 h-px bg-background-tsuki/10"></span>
				</div>

				<div className="flex gap-3">
					<button className="grow shrink basis-0 flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-white/10 bg-background-tsuki/5 text-sm font-medium cursor-pointer backdrop-blur-md">
						<svg
							data-dc-tpl="39"
							width="17"
							height="17"
							viewBox="0 0 24 24"
							fill="none"
							data-om-id="9060ab5f:44"
						>
							<path
								data-dc-tpl="40"
								d="M21.6 12.2c0-.7-.06-1.4-.18-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z"
								fill="#7B9FE0"
								data-om-id="9060ab5f:45"
							></path>
							<path
								data-dc-tpl="41"
								d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
								fill="#4DB89A"
								data-om-id="9060ab5f:46"
							></path>
							<path
								data-dc-tpl="42"
								d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z"
								fill="#C4A85A"
								data-om-id="9060ab5f:47"
							></path>
							<path
								data-dc-tpl="43"
								d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1Z"
								fill="#E06B6B"
								data-om-id="9060ab5f:48"
							></path>
						</svg>
						<span>Google</span>
					</button>
					<button className="grow shrink basis-0 flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-white/10 bg-background-tsuki/5 text-sm font-medium cursor-pointer backdrop-blur-md">
						<svg
							data-dc-tpl="45"
							width="17"
							height="17"
							viewBox="0 0 24 24"
							fill="#E8EDF5"
						>
							<path
								d="M16.4 12.8c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.15-2.8.85-3.5.85-.7 0-1.9-.83-3.1-.8-1.6.02-3 .93-3.8 2.36-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.35 1.2-.05 1.6-.75 3-.75 1.4 0 1.8.75 3 .73 1.2-.02 2-1.13 2.8-2.25.9-1.3 1.2-2.55 1.25-2.6-.03-.02-2.4-.92-2.4-3.6ZM14.2 5.9c.65-.8 1.1-1.9 1-3-1 .04-2.2.66-2.9 1.46-.6.7-1.15 1.85-1 2.9 1.1.1 2.25-.55 2.9-1.36Z"
								data-om-id="9060ab5f:51"
							></path>
						</svg>
						<span>Apple</span>
					</button>
				</div>

				<div className="mt-7 text-center text-sm text-[#8a97b0]">
					<span className="me-1">Hai già un account?</span>
					<button
						onClick={() => router.push("/login")}
						className="text-seichi-ao cursor-pointer font-medium"
					>
						Accedi
					</button>
				</div>
			</div>
		</>
	);
}
