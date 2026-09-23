import Link from "next/link";
import {
	Download,
	Info,
	KeyRound,
	LayoutGrid,
	Lock,
	LogOut,
	Mail,
	Pencil,
	Repeat,
	Trash2,
	TriangleAlert,
	Upload,
} from "lucide-react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAccountContext } from "@/lib/account";
import { getDailyJobHealth } from "@/lib/jobs";
import { getI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/format";
import { APP_LOCK_ENABLED_COOKIE } from "@/lib/app-lock";
import Avatar from "@/components/UI/Avatar";
import PageHeader from "@/components/UI/PageHeader";
import SettingsRow, { SettingsGroup } from "@/components/UI/SettingsRow";
import PreferencesSection from "@/components/features/PreferencesSection";
import ThemeSection from "@/components/features/ThemeSection";
import GlobalBudgetSection from "@/components/features/GlobalBudgetSection";
import { signOut } from "./actions";
import pkg from "@/package.json";

/** Icone, anelli e pastiglie: l'accento pieno (`accent` di SettingsRow, `tone` di SettingsGroup). */
const AKA = "var(--color-aka)";
/** Etichette: l'inchiostro (`tone` di SettingsRow). */
const AKA_INK = "var(--ink-aka)";
/**
 * Ambra per l'avviso di sistema (issue #47), non rosso: il rosso in questa app
 * significa "uscite", e prestarlo a un allarme confonderebbe i due. L'ambra è già
 * il livello "attenzione" delle barre budget all'80%.
 */
const KIN = "var(--color-kin)";
const KIN_INK = "var(--ink-kin)";

export default async function ImpostazioniPage() {
	const [account, jobHealth] = await Promise.all([
		getAccountContext(),
		getDailyJobHealth(),
	]);
	const { t } = await getI18n();

	const supabase = await createClient();
	// Il filtro esplicito è ridondante con la policy RLS, ed è voluto: se un
	// domani quella policy venisse allentata, il conteggio non deve diventare
	// globale senza che nessuno se ne accorga.
	const { count: categoriesCount } = await supabase
		.from("categories")
		.select("id", { count: "exact", head: true })
		.eq("user_id", account.userId);

	// Fase 26a — il PIN vero non lascia mai questo dispositivo (localStorage),
	// ma il flag "un PIN è configurato" è nel cookie apposta per questo: farlo
	// sapere anche a schermate che non sono la schermata di blocco.
	const pinEnabled = (await cookies()).get(APP_LOCK_ENABLED_COOKIE)?.value === "1";

	/*
	 * ⚠️ Revisione ESPLICITA della Fase 28c, non una svista (issue #108).
	 *
	 * La 28c aveva tenuto questa pagina a colonna singola stretta
	 * (`lg:max-w-2xl`, 672px), ricalcando il mockup di allora, che la disegnava
	 * identica a 1024 e a 1440. Il mockup desktop nuovo la divide in DUE colonne
	 * da `xl:` — chi sei e come vedi l'app a sinistra, gestione e sicurezza a
	 * destra — e prevale lui. Il wrapper è quello di tutte le pagine di #108; le
	 * sottopagine di /impostazioni invece restano strette, perché sono davvero
	 * liste o form a colonna singola.
	 */
	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34 lg:px-10 lg:pt-9 lg:pb-12 lg:max-w-6xl lg:mx-auto lg:w-full">
			<PageHeader title={t.settings.title} backHref="/" className="mb-5.5 lg:mb-7" />

			{/*
				Fra `lg:` e `xl:` la colonna è ancora UNA, e resta a 672px: è la
				ragione della 28c — una lista lunga si legge meglio stretta, e a
				1279px la colonna piena sarebbe larga il doppio di una delle due di
				`xl:`, che misurano ~460–524px. Stessa misura di lettura a ogni
				larghezza.

				⚠️ Allineata a SINISTRA, non centrata come nella 28c, ed è voluto: da
				`lg:` il titolo di ogni pagina sta sul bordo sinistro del contenuto
				(convenzione di #108). Una colonna centrata da sola si staccherebbe
				dal proprio titolo — fino a ~135px a 1279px — e centrare anche il
				titolo lo farebbe saltare di posto passando da una pagina all'altra.
				Così la colonna pende dal titolo come un documento; a 1024px lo spazio
				a destra è 16px.

				Sotto `xl:` le due colonne sono due blocchi in fila: l'ordine è
				quello di sempre, e le spaziature pure — ogni sezione porta il
				proprio `mb-6`, e fra un blocco e l'altro quel margine resta 24px.
			*/}
			<div className="lg:max-w-2xl xl:max-w-none xl:grid xl:grid-cols-2 xl:gap-6 xl:items-start">
				{/* Sinistra: il profilo e come vedi l'app — account, aspetto, preferenze, budget. */}
				<div>
					{/* Profilo */}
					{/* ⚠️ TRE livelli — issue #81. Guscio (Link) → vetro → contenuto. */}
					<Link
						href="/impostazioni/profilo"
						className="relative flex rounded-[26px] lg:rounded-3xl mb-6 card-shadow-ring overflow-hidden active:opacity-80"
					>
						<span className="absolute inset-0 bg-surface backdrop-blur-xl" />
						<span className="relative flex items-center gap-3.5 p-4.5 lg:py-5 lg:px-5.5 w-full">
							{/*
								Da `lg:` l'avatar del mockup desktop: 54px, quadrato arrotondato.
								⚠️ La misura con `!`: Avatar la scrive come `style` inline, e solo
								una dichiarazione `!important` in un foglio di stile batte uno
								stile inline. È l'unico modo di cambiarla per breakpoint senza
								toccare il componente condiviso — sotto `lg:` restano i 60px
								tondi di sempre.
							*/}
							<Avatar
								src={account.avatarUrl}
								initials={account.initials}
								size={60}
								rounded="rounded-full lg:rounded-[18px]"
								className="lg:size-13.5!"
							/>
							<div className="flex-1 min-w-0">
								<p className="text-[16.5px] lg:text-base font-semibold truncate">{account.displayName}</p>
								<p className="text-[12.5px] text-muted mt-0.5 truncate">{account.email}</p>
							</div>
							<span className="inline-flex items-center gap-1.5 py-2 px-3 rounded-full lg:rounded-[14px] bg-control ring-border text-xs lg:text-[12.5px] font-medium text-secondary shrink-0">
								<Pencil size={12} className="lg:size-3.5" />
								{t.settings.editProfile}
							</span>
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

					{/* Budget — da `xl:` chiude la colonna, quindi il suo margine lì
					    sarebbe solo spazio in più sotto la pagina. */}
					<div className="mb-6 xl:mb-0">
						<p className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-disabled mb-2.5 ml-0.5">
							{t.settings.groups.budget}
						</p>
						{/* Carica da sé: i periodi di budget dipendono dal fuso dell'utente,
						    che un server component non conosce. */}
						<GlobalBudgetSection />
					</div>
				</div>

				{/* Destra: la gestione — categorie, automazione, dati, sicurezza, supporto, zona pericolo. */}
				<div>
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

					{/* Dati — import (Fase 21) ed export (Fase 23a): le due direzioni, accanto. */}
					<SettingsGroup label={t.settings.groups.data}>
						<SettingsRow
							icon={<Upload size={17} className="text-secondary" />}
							label={t.settings.importData}
							href="/impostazioni/importa"
							chevron
						/>
						<SettingsRow
							icon={<Download size={17} className="text-secondary" />}
							label={t.settings.exportData}
							href="/impostazioni/esporta"
							chevron
						/>
					</SettingsGroup>

					{/* Sicurezza */}
					<SettingsGroup label={t.settings.groups.security}>
						{/*
						 * Fase 26b: niente più una riga "Blocco biometrico" separata qui.
						 * Il biometrico vive SOTTO il PIN (dipende da lui, si accende solo
						 * quando il PIN è già attivo — vedi lib/app-lock.ts), quindi una
						 * seconda riga a livello della pagina principale sarebbe stata
						 * un secondo chevron verso la STESSA destinazione di "pinLock" qui
						 * sotto, con lo stesso stato duplicato in due posti. Lo stato e il
						 * comando restano dentro /impostazioni/blocco (AppLockSettings).
						 */}
						<SettingsRow
							icon={<Lock size={17} className="text-secondary" />}
							label={t.settings.pinLock}
							subtitle={pinEnabled ? t.appLock.active : undefined}
							href="/impostazioni/blocco"
							chevron
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
						{/*
							Compare SOLO quando il job è fermo (issue #47). Una riga permanente
							"automazioni: ok" sarebbe rumore: non c'è niente da fare quando va
							bene, e una spia sempre verde smette di essere guardata.
							Porta a /impostazioni/ricorrenti, dove l'avviso spiega cosa manca.
						*/}
						{jobHealth?.stale && (
							<SettingsRow
								icon={<TriangleAlert size={17} style={{ color: KIN }} />}
								// L'etichetta segue l'AMBITO: "automazioni ferme" sarebbe falso se a
								// fallire sono state le sole notifiche. Vedi `DailyJobScope`.
								label={t.jobHealth[jobHealth.scope].rowLabel}
								tone={KIN_INK}
								accent={KIN}
								href="/impostazioni/ricorrenti"
								// ⚠️ È l'unica riga della pagina su cui c'è qualcosa DA FARE, ed era
								// l'unica `href` senza chevron: si leggeva come un'etichetta di stato
								// e non come l'ingresso alla spiegazione che la attende là dietro.
								chevron
							/>
						)}
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

					{/* Zona pericolo — `tone` vuole l'accento pieno: le tinte le ricava SettingsGroup. */}
					<SettingsGroup label={t.settings.groups.dangerZone} tone={AKA} className="mb-0">
						<SettingsRow
							icon={<Trash2 size={17} style={{ color: AKA }} />}
							label={t.settings.deleteAccount}
							tone={AKA_INK}
							accent={AKA}
							href="/impostazioni/elimina"
						/>
					</SettingsGroup>
				</div>
			</div>
		</div>
	);
}
