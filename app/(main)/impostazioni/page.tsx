import Link from "next/link";
import {
	Fingerprint,
	Info,
	KeyRound,
	LayoutGrid,
	Lock,
	LogOut,
	Mail,
	Pencil,
	Repeat,
	Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccountContext } from "@/lib/account";
import Avatar from "@/components/UI/Avatar";
import PageHeader from "@/components/UI/PageHeader";
import SettingsRow, { SettingsGroup } from "@/components/UI/SettingsRow";
import PreferencesSection from "@/components/features/PreferencesSection";
import { signOut } from "./actions";
import pkg from "@/package.json";

const AKA = "var(--color-aka)";

export default async function ImpostazioniPage() {
	const account = await getAccountContext();

	const supabase = await createClient();
	const { count: categoriesCount } = await supabase
		.from("categories")
		.select("id", { count: "exact", head: true });

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			<PageHeader title="Impostazioni" backHref="/" className="mb-5.5" />

			{/* Profilo */}
			<Link
				href="/impostazioni/profilo"
				className="flex items-center gap-3.5 rounded-[26px] p-4.5 mb-6 bg-surface border border-subtle card-shadow backdrop-blur-xl active:opacity-80"
			>
				<Avatar src={account.avatarUrl} initials={account.initials} size={60} />
				<div className="flex-1 min-w-0">
					<p className="text-[16.5px] font-semibold truncate">{account.displayName}</p>
					<p className="text-[12.5px] text-muted mt-0.5 truncate">{account.email}</p>
				</div>
				<span className="inline-flex items-center gap-1.5 py-2 px-3 rounded-full bg-control border border-subtle text-xs font-medium text-secondary shrink-0">
					<Pencil size={12} />
					modifica
				</span>
			</Link>

			{/* Email */}
			<SettingsGroup>
				<SettingsRow
					icon={<Mail size={17} className="text-secondary" />}
					label="Modifica email"
					subtitle={account.email}
					href="/impostazioni/email"
					chevron
				/>
			</SettingsGroup>

			{/* Preferenze */}
			<div className="mb-6">
				<p className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-disabled mb-2.5 ml-0.5">
					Preferenze
				</p>
				<PreferencesSection currency={account.currency} language={account.language} />
			</div>

			{/* Categorie */}
			<SettingsGroup label="Categorie">
				<SettingsRow
					icon={<LayoutGrid size={17} className="text-secondary" />}
					label="Gestisci categorie"
					value={categoriesCount ?? 0}
					href="/impostazioni/categorie"
					chevron
				/>
			</SettingsGroup>

			{/* Automazione — non è nel mockup ma la funzionalità esiste (Fase 14) */}
			<SettingsGroup label="Automazione">
				<SettingsRow
					icon={<Repeat size={17} className="text-secondary" />}
					label="Transazioni ricorrenti"
					href="/impostazioni/ricorrenti"
					chevron
				/>
			</SettingsGroup>

			{/* Sicurezza */}
			<SettingsGroup label="Sicurezza">
				<SettingsRow
					icon={<Fingerprint size={17} className="text-secondary" />}
					label="Blocco biometrico"
					value="presto"
					disabled
				/>
				<SettingsRow
					icon={<Lock size={17} className="text-secondary" />}
					label="Blocco con PIN"
					value="presto"
					disabled
				/>
				{account.hasPasswordIdentity ? (
					<SettingsRow
						icon={<KeyRound size={17} className="text-secondary" />}
						label="Cambia password"
						href="/impostazioni/password"
						chevron
					/>
				) : (
					<SettingsRow
						icon={<KeyRound size={17} className="text-secondary" />}
						label="Cambia password"
						subtitle="Accedi con un provider esterno"
						disabled
					/>
				)}
			</SettingsGroup>

			{/* Supporto */}
			<SettingsGroup label="Supporto">
				<SettingsRow
					icon={<Info size={17} className="text-secondary" />}
					label="Informazioni"
					value={`versione ${pkg.version}`}
				/>
				<form action={signOut}>
					<button type="submit" className="w-full text-left cursor-pointer">
						<SettingsRow
							icon={<LogOut size={16} style={{ color: AKA }} />}
							label="Esci"
							tone={AKA}
						/>
					</button>
				</form>
			</SettingsGroup>

			{/* Zona pericolo */}
			<SettingsGroup label="Zona pericolo" tone="color-mix(in srgb, var(--color-aka) 30%, transparent)" className="mb-0">
				<SettingsRow
					icon={<Trash2 size={17} style={{ color: AKA }} />}
					label="Elimina il tuo account"
					tone={AKA}
					href="/impostazioni/elimina"
				/>
			</SettingsGroup>
		</div>
	);
}
