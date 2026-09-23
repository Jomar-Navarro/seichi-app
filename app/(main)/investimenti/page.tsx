import { redirect } from "next/navigation";
import { getInvestments } from "../risparmi/actions";
import { getAccounts } from "../conti/actions";
import InvestimentiTab from "@/components/features/InvestimentiTab";
import AccountSelector from "@/components/features/AccountSelector";
import { getSelectedAccount } from "@/lib/accounts-server";
import { getI18n } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/format";

export default async function InvestimentiPage({
	searchParams,
}: {
	searchParams: Promise<{ conto?: string }>;
}) {
	const { conto } = await searchParams;

	/*
	 * Stessa memoria della home e di `/analisi` (`getSelectedAccount`).
	 *
	 * ⚠️ Ereditare il cookie NON è automatico, e la regola della 20b dice
	 * esattamente quando è lecito: il cookie segue le viste che rispondono a
	 * *"come sto andando"*, e una pagina che lo legge **deve mostrare il chip**,
	 * o il filtro diventa stato invisibile. Qui valgono entrambe — è una vista
	 * d'insieme, e il selettore qui sotto porta il nome del conto ed è pure il
	 * comando per cambiarlo — quindi la pagina eredita.
	 *
	 * Senza il selettore la pagina sommava gli investimenti di TUTTI i conti
	 * senza dirlo (#53): `/investimenti` dichiarava € 4.558,50 mentre su Trade
	 * Republic ce n'erano 3.578,50, e gli altri 980 erano movimenti registrati a
	 * mano su un altro conto. Non un errore di somma — la pagina non diceva di
	 * quali conti stesse parlando.
	 */
	const { id: accountId } = await getSelectedAccount(conto);

	const [result, accountsResult] = await Promise.all([
		getInvestments(accountId),
		getAccounts(),
	]);
	const { locale, t } = await getI18n();

	const data = "error" in result ? null : result.data;

	/*
	 * ⚠️ I conti DEGRADANO, non bloccano: un errore qui non deve far sparire il
	 * portafoglio. Il selettore semplicemente non compare e la pagina resta
	 * quella di prima della fase — stesso trattamento di home e `/analisi`.
	 */
	const accounts = "error" in accountsResult ? [] : accountsResult.data;
	if ("error" in accountsResult) {
		console.error("[investimenti] getAccounts:", accountsResult.error);
	}

	/*
	 * ⚠️ Un conto che non è (più) tuo NON deve produrre una pagina che mente.
	 *
	 * Il difetto arriva insieme alla memoria: un id che viene dal cookie e non è
	 * fra i conti dell'utente lascerebbe la pagina filtrata su un id fantasma —
	 * cioè vuota — mentre il chip, non trovandolo, scriverebbe "Tutti i conti".
	 * Etichetta e dati che si contraddicono.
	 *
	 * Il ritorno porta `?conto=` VUOTO e non niente: un parametro presente è
	 * un'istruzione ("nessun conto") e batte il cookie, quindi la destinazione
	 * non può rimbalzare indietro in un ciclo.
	 */
	if (accountId && accounts.length > 0 && !accounts.some((a) => a.id === accountId)) {
		redirect("/investimenti?conto=");
	}

	return (
		/*
		 * lg: la cornice del mockup desktop (#108) — 34/40/48 di margine e fino a
		 * 1152px di larghezza, la stessa di tutte le pagine della issue. Il
		 * `pb-36` mobile esiste per la bottom nav, che da lg non c'è più.
		 */
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-36 lg:px-10 lg:pt-9 lg:pb-12 lg:max-w-6xl lg:mx-auto lg:w-full">
			{/*
				Intestazione. Su mobile tre righe una sotto l'altra — titolo,
				selettore, riepilogo — com'è sempre stata. Da lg la griglia del
				mockup (#108): titolo e riepilogo a sinistra, il selettore a destra
				su entrambe le righe. Posizioni esplicite solo da lg, così l'ordine
				del DOM resta quello del mobile.

				⚠️ Il riepilogo è salito qui da `InvestimentiTab`: sta fra il titolo
				e il selettore nel disegno, e da dentro il componente non poteva
				raggiungere quella riga. Stesse parole, stesso `plural()`, e compare
				alle stesse condizioni — solo con delle posizioni, come prima.
			*/}
			<div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto] lg:items-center lg:gap-x-6">
				<h1 className="text-[26px] font-semibold leading-tight mb-1 lg:col-start-1 lg:row-start-1 lg:mb-0 lg:text-[30px] lg:tracking-[-0.6px]">
					{t.investments.title}
				</h1>

				{/*
					⚠️ Da lg il chip sta all'estremità DESTRA della riga, quindi il
					pannello si apre ancorato a destra (`alignEndFromLg`): ancorato a
					sinistra, i suoi 20rem partivano dal chip e sforavano di ~150px
					oltre il bordo, dove `overflow-x-hidden` di `(main)` lo tagliava.
					La colonna della griglia è `auto`, quindi il contenitore è largo
					quanto il chip e i due bordi destri coincidono.
				*/}
				{accounts.length > 0 && (
					<div className="mt-3 mb-1 lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:mt-0 lg:mb-0">
						<AccountSelector
							accounts={accounts}
							selectedId={accountId}
							basePath="/investimenti"
							alignEndFromLg
						/>
					</div>
				)}

				{data && data.positions.length > 0 && (
					<p className="text-[12.5px] text-muted mt-1 lg:col-start-1 lg:row-start-2 lg:text-[13px] lg:mt-1.5">
						{plural(t.investments.positionCount, data.positions.length, locale)} ·{" "}
						{plural(t.investments.typeCount, data.byType.length, locale)}
					</p>
				)}
			</div>

			<InvestimentiTab data={data} />
		</div>
	);
}
