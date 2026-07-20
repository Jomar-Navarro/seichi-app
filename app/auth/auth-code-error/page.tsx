"use client";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import Button from "@/components/UI/Button";

export default function AuthCodeErrorPage() {
	const router = useRouter();

	return (
		<div className="min-h-lvh flex flex-col items-center justify-center px-7">
			<div className="w-full max-w-sm xl:max-w-lg 2xl:max-w-xl text-center">
				<div className="w-14 h-14 2xl:w-20 2xl:h-20 flex items-center justify-center rounded-2xl 2xl:rounded-3xl bg-surface border border-subtle mx-auto mb-6">
					<AlertCircle size={24} className="text-aka 2xl:hidden" />
					<AlertCircle size={36} className="text-aka hidden 2xl:block" />
				</div>
				<h1 className="text-2xl 2xl:text-4xl font-bold mb-3">Accesso non riuscito</h1>
				<p className="text-sm 2xl:text-base text-muted leading-relaxed mb-8">
					Il link di autenticazione non è valido o è scaduto. Riprova ad
					accedere.
				</p>
				<Button title="Torna al login" onClick={() => router.push("/sign")} />
			</div>
		</div>
	);
}
