import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import FlowCard from "@/components/features/FlowCard";
import AccountSelector from "@/components/features/AccountSelector";
import { getDashboardTotals, getTransactions } from "./action";
import { getAccounts } from "./conti/actions";
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
import { fill, formatDate } from "@/lib/i18n/format";
import { ChartNoAxesCombinedIcon } from "@/lib/seichi-icons";

export default async function MainPage({
	searchParams,
}: {
	searchParams: Promise<{ conto?: string }>;
}) {
	// ⚠️ Il filtro sta nell'URL e non in uno stato del client: i totali li somma
	// Postgres dentro un server component, quindi cambiare conto deve rendere di
	// nuovo dal server. Con uno stato locale il fetch sarebbe dovuto tornare nel
	// browser, disfacendo il lavoro di `dashboard_totals`.
	const { conto } = await searchParams;

	/*
	 * ⚠️ La forma si valida PRIMA di passare il valore alla RPC.
	 *
	 * `dashboard_totals(p_account_id uuid)` riceve il parametro grezzo: con
	 * `/?conto=abc` Postgres solleva `invalid input syntax for type uuid`
	 * (22P02), `getDashboardTotals` torna `{error}` e il ramo d'errore sostituisce
	 * **l'intera dashboard** con "Errore" — niente card, niente conti, nessuna via
	 * d'uscita se non modificare l'URL a mano. Basta un link troncato o un
	 * crawler. Un id ben formato ma non tuo non arriva qui: lo ferma la RLS, e il
	 * controllo di appartenenza sta in `DashboardContent`.
	 */
	const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
	const accountId = conto && UUID.test(conto) ? conto : null;

	return (
		// ⚠️ La `key` rimonta il contenuto quando cambia il conto selezionato.
		// Senza, il Suspense non si riattiva sulla navigazione soft e si vedrebbero
		// i totali del conto precedente finché non arrivano i nuovi.
		<Suspense key={accountId ?? "all"} fallback={<HomeSkeleton />}>
			<DashboardContent accountId={accountId} />
		</Suspense>
	);
}

async function DashboardContent({ accountId }: { accountId: string | null }) {
	const [result, transaction, goalsResult, profile, unreadResult, accountsResult] =
		await Promise.all([
			getDashboardTotals(accountId),
			/*
			 * ⚠️ Il conto va passato anche QUI, non solo ai totali.
			 * Senza, la home filtrata mostrava le somme di un conto e sotto i
			 * movimenti recenti di TUTTI: il selettore dichiarava "stai guardando
			 * Conto principale" mentre la lista lo smentiva tre centimetri più
			 * giù. Trovato guardando uno screenshot, non da un controllo: i tipi
			 * erano corretti e il parametro semplicemente mancava.
			 */
			getTransactions(undefined, undefined, 5, accountId ?? undefined),
			getGoals(),
			getProfileHeader(),
			getUnreadCount(),
			getAccounts(),
		]);
	const { t, locale } = await getI18n();

	// Il conteggio arriva già risolto dal server così il badge non lampeggia da
	// zero al numero vero. Su errore si mostra 0: un badge sbagliato in eccesso
	// manderebbe l'utente ad aprire un pannello che non ha niente di nuovo.
	const unreadCount = "data" in unreadResult ? unreadResult.data : 0;

	const entrata = TRANSACTION_TYPES.find((t) => t.id === "entrata")!;
	const uscita = TRANSACTION_TYPES.find((t) => t.id === "spesa")!;
	const investimento = TRANSACTION_TYPES.find((t) => t.id === "investimento")!;
	const risparmio = TRANSACTION_TYPES.find((t) => t.id === "risparmio")!;

	/*
	 * ⚠️ Il messaggio del database si LOGGA prima di scomparire.
	 *
	 * Queste due righe rendevano lo stesso "Errore" generico per due loader
	 * diversi, buttando via il messaggio di Postgres: davanti a una home rotta non
	 * si sapeva né QUALE query fosse fallita né PERCHÉ, e l'unico modo di scoprirlo
	 * era rimetterci dentro un log a mano. All'utente resta la frase generica —
	 * un errore SQL grezzo a schermo non lo aiuta e racconta la forma dello schema
	 * — ma al server resta la traccia.
	 */
	if ("error" in result) {
		console.error("[home] getDashboardTotals:", result.error);
		return <p>{t.home.error}</p>;
	}
	if ("error" in transaction) {
		console.error("[home] getTransactions:", transaction.error);
		return <p>{t.home.error}</p>;
	}

	// ⚠️ I conti degradano, non bloccano: un errore qui non deve far sparire la
	// home. Il selettore semplicemente non compare, e la pagina resta quella di
	// prima della fase — a differenza dei totali, senza cui non c'è niente da
	// mostrare. Stesso trattamento già riservato agli obiettivi qui sotto.
	const accounts = "error" in accountsResult ? [] : accountsResult.data;
	if ("error" in accountsResult) {
		console.error("[home] getAccounts:", accountsResult.error);
	}

	/*
	 * ⚠️ Un conto ben formato ma non tuo (o cancellato altrove) NON deve produrre
	 * una pagina che mente.
	 *
	 * La RLS fa già la sua parte — i totali tornerebbero vuoti — ma il chip
	 * direbbe "Tutti i conti" sopra dei dati filtrati su un id fantasma: la
	 * stessa contraddizione etichetta/dati corretta poco sopra per i movimenti
	 * recenti. Si torna alla home non filtrata invece di mostrare zeri
	 * inspiegabili.
	 */
	if (accountId && accounts.length > 0 && !accounts.some((a) => a.id === accountId)) {
		redirect("/");
	}

	const goals = "error" in goalsResult ? [] : goalsResult.data;
	const goalsWithTarget = goals.filter((g) => (g.target_amount ?? 0) > 0);
	const totalTarget = goalsWithTarget.reduce((acc, g) => acc + (g.target_amount ?? 0), 0);
	const totalSaved = goalsWithTarget.reduce((acc, g) => acc + g.saved_amount, 0);
	/*
	 * ⚠️ La percentuale si mostra SOLO senza filtro conto.
	 *
	 * `risparmiMese` è filtrato per conto, `getGoals()` no: gli obiettivi non
	 * appartengono a un conto — un traguardo si finanzia da dove si vuole. Con
	 * un conto selezionato la card accostava un importo "da questo conto, questo
	 * mese" a una percentuale "su tutto, da sempre": due scope in una card, che è
	 * proprio l'accostamento *luogo/traguardo* respinto progettando la fase.
	 */
	const showGoalProgress = accountId === null && totalTarget > 0;
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

			{/*
				Il selettore sta SOPRA la card e non dentro: filtra tutta la pagina —
				la cifra grande, le quattro card e le sparkline — non solo il numero
				che ha accanto. Ed è anche l'ingresso alla pagina conti, perché la
				bottom nav è già a quattro voci più il FAB.
			*/}
			{accounts.length > 0 && (
				<AccountSelector accounts={accounts} selectedId={accountId} />
			)}

			{/*
				⚠️ `monthLabel` si calcola QUI, nel server component, non dentro
				`FlowCard`. Non è una questione di idratazione: i confini dei bucket
				li calcola `getDashboardTotals` col `new Date()` del server, quindi
				l'etichetta deve nascere dallo stesso orologio dei numeri che
				descrive. Calcolata sul client, nelle prime ore del mese potrebbe
				scrivere "luglio" sopra i totali di giugno.
			*/}
			<FlowCard
				flussoMese={result.flussoMese}
				monthLabel={formatDate(new Date(), locale, { month: "long" })}
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
					label={showGoalProgress ? fill(t.home.cards.savingsWithProgress, { pct: risparmiProgress }) : t.home.cards.savings}
					progress={showGoalProgress ? risparmiProgress : undefined}
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
