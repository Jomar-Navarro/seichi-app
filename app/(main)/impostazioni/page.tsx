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
import { getI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/format";
import Avatar from "@/components/UI/Avatar";
import PageHeader from "@/components/UI/PageHeader";
import SettingsRow, { SettingsGroup } from "@/components/UI/SettingsRow";
import PreferencesSection from "@/components/features/PreferencesSection";
import ThemeSection from "@/components/features/ThemeSection";
import GlobalBudgetSection from "@/components/features/GlobalBudgetSection";
import { signOut } from "./actions";
import pkg from "@/package.json";

/** Icone, bordi e pastiglie: l'accento pieno (`accent` di SettingsRow). */
const AKA = "var(--color-aka)";
/** Etichette: l'inchiostro (`tone` di SettingsRow). */
const AKA_INK = "var(--ink-aka)";

export default async function ImpostazioniPage() {
	const account = await getAccountContext();
	const { t } = await getI18n();

	const supabase = await createClient();
	// Il filtro esplicito è ridondante con la policy RLS, ed è voluto: se un
	// domani quella policy venisse allentata, il conteggio non deve diventare
	// globale senza che nessuno se ne accorga.
	const { count: categoriesCount } = await supabase
		.from("categories")
		.select("id", { count: "exact", head: true })
		.eq("user_id", account.userId);

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			<PageHeader title={t.settings.title} backHref="/" className="mb-5.5" />

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
					{t.settings.editProfile}
				</span>
			</Link>

			{/* Email */}
			<SettingsGroup>
				<SettingsRow
					icon={<Mail size={17} className="text-secondary" />}
					label={t.settings.editEmail}
					subtitle={account.email}
					href="/impostazioni/email"
					chevron
				/>
			</SettingsGroup>

			{/* Aspetto */}
			<SettingsGroup label={t.settings.groups.appearance}>
				<ThemeSection />
			</SettingsGroup>

			{/* Preferenze */}
			<div className="mb-6">
				<p className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-disabled mb-2.5 ml-0.5">
					{t.settings.groups.preferences}
				</p>
				<PreferencesSection currency={account.currency} language={account.language} />
			</div>

			{/* Budget */}
			<div className="mb-6">
				<p className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-disabled mb-2.5 ml-0.5">
					{t.settings.groups.budget}
				</p>
				{/* Carica da sé: i periodi di budget dipendono dal fuso dell'utente,
				    che un server component non conosce. */}
				<GlobalBudgetSection />
			</div>

			{/* Categorie */}
			<SettingsGroup label={t.settings.groups.categories}>
				<SettingsRow
					icon={<LayoutGrid size={17} className="text-secondary" />}
					label={t.settings.manageCategories}
					value={categoriesCount ?? 0}
					href="/impostazioni/categorie"
					chevron
				/>
			</SettingsGroup>

			{/* Automazione — non è nel mockup ma la funzionalità esiste (Fase 14) */}
			<SettingsGroup label={t.settings.groups.automation}>
				<SettingsRow
					icon={<Repeat size={17} className="text-secondary" />}
					label={t.settings.recurringTransactions}
					href="/impostazioni/ricorrenti"
					chevron
				/>
			</SettingsGroup>

			{/* Sicurezza */}
			<SettingsGroup label={t.settings.groups.security}>
				<SettingsRow
					icon={<Fingerprint size={17} className="text-secondary" />}
					label={t.settings.biometricLock}
					value={t.settings.comingSoon}
					disabled
				/>
				<SettingsRow
					icon={<Lock size={17} className="text-secondary" />}
					label={t.settings.pinLock}
					value={t.settings.comingSoon}
					disabled
				/>
				{account.hasPasswordIdentity ? (
					<SettingsRow
						icon={<KeyRound size={17} className="text-secondary" />}
						label={t.settings.changePassword}
						href="/impostazioni/password"
						chevron
					/>
				) : (
					<SettingsRow
						icon={<KeyRound size={17} className="text-secondary" />}
						label={t.settings.changePassword}
						subtitle={t.settings.externalProvider}
						disabled
					/>
				)}
			</SettingsGroup>

			{/* Supporto */}
			<SettingsGroup label={t.settings.groups.support}>
				<SettingsRow
					icon={<Info size={17} className="text-secondary" />}
					label={t.settings.about}
					value={fill(t.settings.version, { version: pkg.version })}
				/>
				<form action={signOut}>
					<button type="submit" className="w-full text-left cursor-pointer">
						<SettingsRow
							icon={<LogOut size={16} style={{ color: AKA }} />}
							label={t.settings.signOut}
							tone={AKA_INK}
							accent={AKA}
						/>
					</button>
				</form>
			</SettingsGroup>

			{/* Zona pericolo */}
			<SettingsGroup label={t.settings.groups.dangerZone} tone="color-mix(in srgb, var(--color-aka) 30%, transparent)" className="mb-0">
				<SettingsRow
					icon={<Trash2 size={17} style={{ color: AKA }} />}
					label={t.settings.deleteAccount}
					tone={AKA_INK}
					accent={AKA}
					href="/impostazioni/elimina"
				/>
			</SettingsGroup>
		</div>
	);
}
