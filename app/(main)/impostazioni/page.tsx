import Link from "next/link";
import { ChevronLeft, ChevronRight, LayoutGrid, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PreferencesSection from "@/components/features/PreferencesSection";
import { signOut } from "./actions";

export default async function ImpostazioniPage() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();

	const [{ data: profile }, { count: categoriesCount }] = await Promise.all([
		supabase.from("profiles").select("currency, language").eq("id", user?.id ?? "").single(),
		supabase
			.from("categories")
			.select("id", { count: "exact", head: true })
			.eq("user_id", user?.id ?? ""),
	]);

	const email = user?.email ?? "";
	const initials = email.slice(0, 2).toUpperCase() || "··";

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			{/* Header */}
			<div className="flex items-center gap-3.5 mb-5.5">
				<Link
					href="/"
					className="w-10 h-10 rounded-xl flex items-center justify-center bg-control border border-subtle shrink-0"
					aria-label="Indietro"
				>
					<ChevronLeft size={17} className="text-secondary" />
				</Link>
				<h1 className="text-[22px] font-semibold">Impostazioni</h1>
			</div>

			{/* Profilo */}
			<div className="flex items-center gap-3.5 rounded-[26px] p-4.5 mb-6 bg-surface border border-subtle card-shadow backdrop-blur-xl">
				<div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 bg-control border border-subtle">
					<span className="text-[17px] font-semibold text-secondary tracking-wide">{initials}</span>
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-semibold truncate">{email || "Account"}</p>
					<p className="text-xs text-muted mt-0.5">Account Seichi</p>
				</div>
			</div>

			{/* Preferenze */}
			<p className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-disabled mb-2.5 ml-0.5">
				Preferenze
			</p>
			<div className="mb-6">
				<PreferencesSection
					currency={profile?.currency ?? "EUR"}
					language={profile?.language ?? "it"}
				/>
			</div>

			{/* Categorie */}
			<p className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-disabled mb-2.5 ml-0.5">
				Categorie
			</p>
			<Link
				href="/impostazioni/categorie"
				className="flex items-center gap-3 h-15.5 px-4 mb-6 rounded-[22px] bg-card border border-subtle card-shadow active:opacity-80"
			>
				<span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-control">
					<LayoutGrid size={17} className="text-secondary" />
				</span>
				<span className="flex-1 text-sm font-medium">Gestisci categorie</span>
				<span className="text-[13px] text-muted">{categoriesCount ?? 0}</span>
				<ChevronRight size={15} className="text-muted" />
			</Link>

			{/* Account */}
			<p className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-disabled mb-2.5 ml-0.5">
				Account
			</p>
			<form action={signOut} className="rounded-[22px] bg-card border border-subtle card-shadow overflow-hidden">
				<button
					type="submit"
					className="flex items-center gap-3 h-15.5 px-4 w-full text-left active:opacity-80"
				>
					<span
						className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
						style={{ background: "color-mix(in srgb, var(--color-aka) 12%, transparent)" }}
					>
						<LogOut size={16} style={{ color: "var(--color-aka)" }} />
					</span>
					<span className="flex-1 text-sm font-medium" style={{ color: "var(--color-aka)" }}>
						Esci
					</span>
				</button>
			</form>
		</div>
	);
}
