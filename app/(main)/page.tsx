import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import HomeHero from "@/components/features/HomeHero";
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
import { getSelectedAccount } from "@/lib/accounts-server";
import { getI18n } from "@/lib/i18n/server";
import { fill, formatDate } from "@/lib/i18n/format";
import { ChartNoAxesCombinedIcon } from "@/lib/seichi-icons";

export default async function MainPage({
	searchParams,
}: {
	searchParams: Promise<{ conto?: string }>;
}) {
	/*
	 * ⚠️ Il filtro sta nell'URL e non in uno stato del client: i totali li somma
	 * Postgres dentro un server component, quindi cambiare conto deve rendere di
	 * nuovo dal server. Con uno stato locale il fetch sarebbe dovuto tornare nel
	 * browser, disfacendo il lavoro di `dashboard_totals`.
	 *
	 * ⚠️ Ma l'URL da solo rendeva la scelta EFFIMERA: "Home" nella bottom nav
	 * punta a `/`, quindi ogni giro fuori e ritorno azzerava il filtro. Dalla 20b
	 * c'è anche una memoria in cookie — vedi `getSelectedAccount`, che spiega
	 * anche perché URL e cookie non vanno trattati allo stesso modo quando il
	 * conto non esiste più.
	 *
	 * La forma dell'id si valida là dentro, PRIMA che il valore arrivi alla RPC:
	 * `dashboard_totals(p_account_id uuid)` con `/?conto=abc` solleva `22P02` e il
	 * ramo d'errore sostituirebbe **l'intera dashboard** con "Errore" — niente
	 * card, niente conti, nessuna via d'uscita se non modificare l'URL a mano.
	 */
	const { conto } = await searchParams;
	const { id: accountId, fromUrl } = await getSelectedAccount(conto);

	return (
		// ⚠️ La `key` rimonta il contenuto quando cambia il conto selezionato.
		// Senza, il Suspense non si riattiva sulla navigazione soft e si vedrebbero
		// i totali del conto precedente finché non arrivano i nuovi.
		<Suspense key={accountId ?? "all"} fallback={<HomeSkeleton />}>
			<DashboardContent accountId={accountId} fromUrl={fromUrl} />
		</Suspense>
	);
}

async function DashboardContent({
	accountId,
	fromUrl,
}: {
	accountId: string | null;
	fromUrl: boolean;
}) {
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
	 * recenti.
	 *
	 * ⚠️ **Solo se l'id viene dall'URL**, e non è una raffinatezza: dal cookie
	 * `getSelectedAccount` ha già restituito `null`, quindi qui non arriverebbe
	 * mai — ma se un domani lo lasciasse passare, il `redirect("/")` tornerebbe
	 * su una pagina che rilegge lo stesso cookie e rimanda su `/`, all'infinito.
	 * La condizione dice a voce alta che il redirect è la risposta a
	 * un'ISTRUZIONE sbagliata, non a una memoria stantia.
	 */
	if (fromUrl && accountId && accounts.length > 0 && !accounts.some((a) => a.id === accountId)) {
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
				⚠️ `monthLabel` si calcola QUI, nel server component, non nella card.
				Non è una questione di idratazione: i confini dei bucket li calcola
				`getDashboardTotals` col `new Date()` del server, quindi l'etichetta
				deve nascere dallo stesso orologio dei numeri che descrive. Calcolata
				sul client, nelle prime ore del mese potrebbe scrivere "luglio" sopra
				i totali di giugno.
			*/}
			<HomeHero
				flussoMese={result.flussoMese}
				monthLabel={formatDate(new Date(), locale, { month: "long" })}
				accounts={accounts}
				selectedId={accountId}
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

			{/*
				Analisi shortcut.
				⚠️ Il conto selezionato viaggia nel link. Senza, questa scorciatoia
				portava da un "Flusso · € 120" filtrato a un "Flusso netto · € 1.540"
				su tutti i conti — la stessa parola, due numeri, a un tap di distanza:
				esattamente il difetto che `sommaUscite()` era stata scritta per
				chiudere, riaperto dal filtro introdotto nella stessa fase.
			*/}
			<Link
				href={accountId ? `/analisi?conto=${accountId}` : "/analisi"}
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

			<RecentTransaction
				transactions={transaction.data}
				accounts={accounts}
				viewedAccountId={accountId}
			/>
			<DashboardRefresher />
			</div>
		</div>
	);
}
