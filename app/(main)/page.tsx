import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import BalanceCard from "@/components/features/BalanceCard";
import { getDashboardTotals, getTransactions } from "./action";
import { getGoals } from "./risparmi/actions";
import SummaryCard from "@/components/UI/SummaryCard";
import { TRANSACTION_TYPES } from "@/types";
import RecentTransaction from "@/components/features/RecentTransaction";
import DashboardRefresher from "@/components/features/DashboardRefresher";
import HomeSkeleton from "@/components/features/HomeSkeleton";
import ProfileMenu from "@/components/features/ProfileMenu";
import NotificationBell from "@/components/features/NotificationBell";
import { getUnreadCount } from "@/app/(main)/notification-actions";
import Sparkline from "@/components/UI/Sparkline";
import { getProfileHeader } from "@/lib/account";
import { getI18n } from "@/lib/i18n/server";
import { fill } from "@/lib/i18n/format";
import { ChartNoAxesCombinedIcon } from "@/lib/seichi-icons";

export default function MainPage() {
	return (
		<Suspense fallback={<HomeSkeleton />}>
			<DashboardContent />
		</Suspense>
	);
}

async function DashboardContent() {
	const [result, transaction, goalsResult, profile, unreadResult] = await Promise.all([
		getDashboardTotals(),
		getTransactions(undefined, undefined, 5),
		getGoals(),
		getProfileHeader(),
		getUnreadCount(),
	]);
	const { t } = await getI18n();

	// Il conteggio arriva già risolto dal server così il badge non lampeggia da
	// zero al numero vero. Su errore si mostra 0: un badge sbagliato in eccesso
	// manderebbe l'utente ad aprire un pannello che non ha niente di nuovo.
	const unreadCount = "data" in unreadResult ? unreadResult.data : 0;

	const entrata = TRANSACTION_TYPES.find((t) => t.id === "entrata")!;
	const uscita = TRANSACTION_TYPES.find((t) => t.id === "spesa")!;
	const investimento = TRANSACTION_TYPES.find((t) => t.id === "investimento")!;
	const risparmio = TRANSACTION_TYPES.find((t) => t.id === "risparmio")!;

	if ("error" in result) return <p>{t.home.error}</p>;
	if ("error" in transaction) return <p>{t.home.error}</p>;

	const goals = "error" in goalsResult ? [] : goalsResult.data;
	const goalsWithTarget = goals.filter((g) => (g.target_amount ?? 0) > 0);
	const totalTarget = goalsWithTarget.reduce((acc, g) => acc + (g.target_amount ?? 0), 0);
	const totalSaved = goalsWithTarget.reduce((acc, g) => acc + g.saved_amount, 0);
	const risparmiProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

	return (
		// Aloni ambientali come nel mockup: gli stessi di welcome/onboarding,
		// ora con i colori presi dai token e quindi corretti in entrambi i temi.
		<div className="relative">
			{/*
				Gli aloni stanno in un riquadro FISSO grande quanto il viewport.
				`.circle-3` è ancorato al `bottom`, e in un contenitore alto quanto
				la pagina che scorre finirebbe centinaia di px sotto la piega: si
				animerebbe per sempre senza che nessuno lo veda. Nelle pagine auth
				il contenitore è già alto quanto lo schermo, qui no.
			*/}
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="circle-1" />
				<div className="circle-3" />
			</div>
			{/*
				`relative` SENZA z-index, di proposito. Un z-index esplicito qui
				creerebbe uno stacking context e schiaccerebbe a quel livello tutto
				ciò che sta dentro: il pannello notifiche (`fixed z-50`) finirebbe
				sotto la BottomNav (`z-40`), che è fratello di {children} nel layout
				e quindi vive nel contesto radice.
				Il contenuto sta comunque sopra gli aloni perché entrambi sono
				posizionati con z-index auto e vince l'ordine nel DOM.
			*/}
			<div className="relative flex flex-col gap-4 px-5 pt-7 pb-32">
			{/* Come nel mockup: a sinistra l'avatar col saluto e il nome (è il
			    gruppo intero ad aprire il menu), a destra la sola campanella. */}
			<div className="flex items-center justify-between mb-1">
				<ProfileMenu
					initials={profile.initials}
					avatarUrl={profile.avatarUrl}
					name={profile.displayName}
					greeting={t.home.greeting}
				/>
				<NotificationBell initialUnread={unreadCount} />
			</div>

			<BalanceCard
				saldoTotale={result.saldoTotale}
				saldoMese={result.saldoMese}
			/>

			<div className="grid grid-cols-2 gap-3">
				<SummaryCard
					amount={result.entrateMese}
					icon={entrata.icon}
					color={entrata.color}
					label={t.home.cards.income}
					trend={result.entrateTrend}
				/>

				<SummaryCard
					amount={result.speseMese}
					icon={uscita.icon}
					color={uscita.color}
					label={t.home.cards.expenses}
					trend={result.speseTrend}
				/>

				<SummaryCard
					amount={result.investimentiMese}
					icon={investimento.icon}
					color={investimento.color}
					label={t.home.cards.investments}
					trend={result.investimentiTrend}
				/>

				<SummaryCard
					amount={result.risparmiMese}
					icon={risparmio.icon}
					color={risparmio.color}
					label={totalTarget > 0 ? fill(t.home.cards.savingsWithProgress, { pct: risparmiProgress }) : t.home.cards.savings}
					progress={totalTarget > 0 ? risparmiProgress : undefined}
					trend={result.risparmiTrend}
				/>
			</div>

			{/* Analisi shortcut */}
			<Link
				href="/analisi"
				className="flex items-center justify-between px-4 py-3.5 rounded-2xl border border-subtle card-shadow"
				style={{ background: "var(--surface)" }}
			>
				<div className="flex items-center gap-3">
					<div
						className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
						style={{ background: "color-mix(in srgb, var(--color-ao) 14%, transparent)" }}
					>
						<ChartNoAxesCombinedIcon size={17} strokeWidth={1.5} style={{ color: "var(--color-ao)" }} />
					</div>
					<div>
						<p className="text-sm font-semibold">{t.home.analyticsTitle}</p>
						<p className="text-xs text-muted">{t.home.analyticsSubtitle}</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Sparkline
						values={result.speseTrend}
						color="var(--color-kiri)"
						width={48}
						height={22}
						opacity={0.5}
						pad={3}
					/>
					<ChevronRight size={16} className="text-muted" />
				</div>
			</Link>

			<RecentTransaction transactions={transaction.data} />
			<DashboardRefresher />
			</div>
		</div>
	);
}
