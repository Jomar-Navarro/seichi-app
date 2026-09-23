import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import HomeHero from "@/components/features/HomeHero";
import CoachBubble from "@/components/features/CoachBubble";
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
			getTransactions({ limit: 5, conto: accountId ?? undefined }),
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
	 * ⚠️ **Le due provenienze si correggono in modo DIVERSO**, e il primo tentativo
	 * aveva chiuso solo metà del problema.
	 *
	 * Dall'URL si torna su `/`: è un'istruzione sbagliata, si annulla.
	 *
	 * Dal cookie NON si può fare lo stesso — `/` rileggerebbe lo stesso cookie e
	 * rimanderebbe su `/`, all'infinito. Ma nemmeno si può *lasciar correre*, ed
	 * è il difetto trovato in review: senza redirect la pagina resta **filtrata
	 * su un id fantasma** (totali a zero) mentre il chip, non trovandolo fra i
	 * conti, scrive "Tutti i conti". Etichetta e dati che si contraddicono — cioè
	 * proprio ciò che questo blocco esiste per impedire, riaperto dalla memoria.
	 *
	 * La via d'uscita è `?conto=` vuoto: un parametro PRESENTE ma vuoto è
	 * un'istruzione ("nessun conto") e batte il cookie, quindi la destinazione non
	 * può rimbalzare indietro. Un salto solo, e solo in un caso che oggi non è
	 * raggiungibile dall'interfaccia — i conti non si cancellano, si archiviano, e
	 * gli archiviati restano nella vista.
	 */
	if (accountId && accounts.length > 0 && !accounts.some((a) => a.id === accountId)) {
		redirect(fromUrl ? "/" : "/?conto=");
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
			{/*
				Da `lg:` padding e larghezza del mockup desktop (issue #108): main
				36/40/48, contenuto fino a ~1070px, 22px fra le sezioni. Il `pb-32`
				del telefono è lo spazio della bottom nav, che da `lg:` non c'è.
			*/}
			<div className="relative flex flex-col gap-4 px-5 pt-7 pb-32 lg:gap-5.5 lg:px-10 lg:pt-9 lg:pb-12 lg:max-w-6xl lg:mx-auto lg:w-full">
			{/*
				Come nel mockup: a sinistra l'avatar col saluto e il nome (è il
				gruppo intero ad aprire il menu), a destra le due pastiglie.

				⚠️ La campanella tiene il suo angolo e il coach le si affianca a
				SINISTRA. La Fase 18 aveva rifatto questo header lasciando alla
				campanella l'angolo tutto per sé; due pastiglie affiancate erano già
				la forma prevista prima di allora, e questa è quella.

				⚠️ Il coach è QUI e non dentro una card, dopo due tentativi sbagliati:
				nel varco fra le card non era allineato a niente, e dentro la card
				Investimenti sembrava un controllo di quella card — cioè di un numero,
				non dell'app. Un assistente sta dove stanno gli altri comandi globali.

				⚠️ Da `lg:` l'header è UNA riga sola (mockup desktop, issue #108):
				saluto e nome senza avatar — il menu profilo vive nel piede della
				sidebar — poi il selettore conti, poi le pastiglie spinte a destra.
				Sul telefono resta com'era: avatar e pastiglie, e il selettore sotto.

				⚠️ Il selettore è UNO solo e si sposta; renderne due (uno per
				breakpoint) vorrebbe dire due pannelli e due stati per lo stesso
				filtro. Da qui l'ordine nel DOM — saluto, selettore, pastiglie — che
				è quello della riga desktop, quindi anche l'ordine del TAB, dove la
				tastiera si usa davvero. Sul telefono una griglia a due colonne rimette
				il selettore nella seconda riga (`row-start-2 col-span-2`) e le
				pastiglie in alto a destra: identico a prima a vista, con i 20px di
				sempre fra le due righe (`gap-y-5`: era `mb-1` più il `gap-4` della
				pagina).
			*/}
			<div
				className={`grid grid-cols-[1fr_auto] items-center gap-y-5 lg:flex lg:gap-4.5 ${
					/*
					 * Senza selettore la seconda riga non c'è, e con lei il suo gap:
					 * il `mb-1` di prima torna qui, o la card sotto salirebbe di 4px
					 * proprio quando i conti non si caricano.
					 */
					accounts.length > 0 ? "" : "mb-1 lg:mb-0"
				}`}
			>
				{/*
					⚠️ `justify-self-start`: in una cella di griglia l'elemento si
					allarga a tutta la colonna, mentre da figlio flex era largo quanto il
					proprio contenuto. `ProfileMenu` chiude il pannello sui clic FUORI dal
					proprio contenitore: allargato, lo spazio vuoto fino alle pastiglie
					sarebbe diventato "dentro", e toccarlo non l'avrebbe più chiuso.
				*/}
				<div className="justify-self-start lg:hidden">
					<ProfileMenu
						initials={profile.initials}
						avatarUrl={profile.avatarUrl}
						name={profile.displayName}
						greeting={t.home.greeting}
					/>
				</div>
				{/*
					Il saluto del desktop. Non è un comando — il menu profilo sta nella
					sidebar — quindi niente bottone e niente chevron: un bottone che non
					apre niente sarebbe un comando che mente sulla propria natura.
				*/}
				<div className="hidden lg:block min-w-0">
					<p className="text-xs text-disabled tracking-[0.3px]">{t.home.greeting}</p>
					<p className="text-[23px] font-semibold tracking-[-0.3px] leading-tight mt-0.75 truncate">
						{profile.displayName}
					</p>
				</div>
				{/*
					Il selettore sta SOPRA la card e non dentro: filtra tutta la pagina —
					la cifra grande, le quattro card e le sparkline — non solo il numero
					che ha accanto. Ed è anche l'ingresso alla pagina conti, perché la
					bottom nav è già a quattro voci più il FAB.
				*/}
				{accounts.length > 0 && (
					<div className="row-start-2 col-span-2 lg:ml-2.5">
						<AccountSelector accounts={accounts} selectedId={accountId} />
					</div>
				)}
				{/*
					⚠️ `shrink-0` sul gruppo, non sulle singole pastiglie: sono figli
					flex con `min-width: auto`, quindi senza questo si comprimono in
					tessere non quadrate invece di lasciar troncare il nome. Con una
					pastiglia sola non si vedeva; con due il contenuto dell'header
					supera i 320px e il difetto compare sui telefoni più stretti.
					`ProfileMenu` il nome lo tronca già (`truncate max-w-36`), quindi
					è lui a cedere — che è l'ordine giusto. Vale per la riga flex del
					desktop; sul telefono lo stesso lo garantisce la colonna `auto`
					della griglia, che non scende mai sotto il proprio contenuto.
				*/}
				<div className="flex items-center gap-2 shrink-0 row-start-1 col-start-2 lg:ml-auto">
					<CoachBubble accountFiltered={!!accountId} />
					<NotificationBell initialUnread={unreadCount} />
				</div>
			</div>

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
				flussoTrend={result.flussoTrend}
				monthLabel={formatDate(new Date(), locale, { month: "long" })}
				accounts={accounts}
				selectedId={accountId}
			/>

			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
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
				La riga in fondo: scorciatoia Analisi e movimenti recenti.

				Sul telefono (e fino a `xl:`) restano impilate come prima: la
				scorciatoia in riga, la lista sotto. Da `xl:` stanno AFFIANCATE come
				nel mockup desktop (issue #108) — lista a sinistra (`1.6fr`), Analisi
				a destra (`1fr`) — e la scorciatoia diventa una card col grafico
				grande. A `lg:` la colonna utile è ~690px: la lista starebbe in 410,
				ma la card Analisi in 260 non avrebbe più niente di un grafico.

				⚠️ L'ordine nel DOM resta quello del telefono (Analisi, poi lista):
				le celle del desktop sono assegnate a mano (`col-start`/`row-start`).

				⚠️ La lista è un SUBGRID a due righe (titolo, card): la card Analisi
				sta nella seconda, quindi il suo bordo alto combacia con quello della
				card della lista e non col titolo "Transazioni recenti". Il mockup ci
				arriva con un `margin-top: 35px` scritto a mano, che smetterebbe di
				combaciare al primo cambio di font o di lingua.
			*/}
			<div className="flex flex-col gap-4 lg:gap-5.5 xl:grid xl:grid-cols-[1.6fr_1fr] xl:grid-rows-[auto_auto] xl:gap-x-4.5 xl:gap-y-0 xl:items-start">
				{/*
					Analisi shortcut.
					⚠️ Il conto selezionato viaggia nel link. Senza, questa scorciatoia
					portava da un "Flusso · € 120" filtrato a un "Flusso netto · € 1.540"
					su tutti i conti — la stessa parola, due numeri, a un tap di distanza:
					esattamente il difetto che `sommaUscite()` era stata scritta per
					chiudere, riaperto dal filtro introdotto nella stessa fase.

					Da `xl:` è una griglia: in alto icona, titoli e chevron, sotto la
					sparkline a tutta larghezza e alta 120. Sono gli STESSI elementi della
					riga del telefono — il gruppo a destra diventa `xl:contents` e i suoi
					due figli prendono ciascuno la propria cella — non una seconda copia:
					una sparkline sola, stirata dalle classi (vedi `Sparkline`).
				*/}
				<Link
					href={accountId ? `/analisi?conto=${accountId}` : "/analisi"}
					className="flex items-center justify-between px-4 py-3.5 rounded-2xl card-shadow-ring xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:gap-x-3.25 xl:gap-y-5 xl:col-start-2 xl:row-start-2 xl:rounded-3xl xl:pt-5.5 xl:px-6 xl:pb-6"
					style={{ background: "var(--surface)" }}
				>
					<div className="flex items-center gap-3 xl:gap-3.25 xl:col-start-1 xl:row-start-1">
						<div
							className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 xl:w-10 xl:h-10 xl:rounded-[13px]"
							style={{ background: "color-mix(in srgb, var(--color-ao) 14%, transparent)" }}
						>
							<ChartNoAxesCombinedIcon size={17} strokeWidth={1.5} style={{ color: "var(--color-ao)" }} />
						</div>
						<div>
							<p className="text-sm font-semibold xl:text-[14.5px]">{t.home.analyticsTitle}</p>
							<p className="text-xs text-muted xl:text-[11.5px] xl:mt-0.75">{t.home.analyticsSubtitle}</p>
						</div>
					</div>
					<div className="flex items-center gap-2 xl:contents">
						<Sparkline
							values={result.speseTrend}
							color="var(--color-kiri)"
							width={48}
							height={22}
							opacity={0.5}
							pad={3}
							className="xl:col-span-2 xl:row-start-2 xl:w-full xl:h-30"
							areaOpacity={0.08}
							areaClassName="hidden xl:inline"
						/>
						<ChevronRight size={16} className="text-muted xl:col-start-2 xl:row-start-1" />
					</div>
				</Link>

				<RecentTransaction
					transactions={transaction.data}
					accounts={accounts}
					viewedAccountId={accountId}
					className="xl:col-start-1 xl:row-start-1 xl:row-span-2 xl:grid xl:grid-rows-subgrid"
				/>
			</div>
			<DashboardRefresher />
			</div>
		</div>
	);
}
