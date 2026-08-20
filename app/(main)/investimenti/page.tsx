import { redirect } from "next/navigation";
import { getInvestments } from "../risparmi/actions";
import { getAccounts } from "../conti/actions";
import InvestimentiTab from "@/components/features/InvestimentiTab";
import AccountSelector from "@/components/features/AccountSelector";
import { getSelectedAccount } from "@/lib/accounts-server";
import { getDictionary } from "@/lib/i18n/server";

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
	const t = await getDictionary();

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
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-36">
			<h1 className="text-[26px] font-semibold leading-tight mb-1">{t.investments.title}</h1>

			{accounts.length > 0 && (
				<div className="mt-3 mb-1">
					<AccountSelector
						accounts={accounts}
						selectedId={accountId}
						basePath="/investimenti"
					/>
				</div>
			)}

			<InvestimentiTab data={data} />
		</div>
	);
}
