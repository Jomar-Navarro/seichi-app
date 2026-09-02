import { getAccount } from "../actions";
import AccountDetailClient from "@/components/features/AccountDetailClient";
import PageHeader from "@/components/UI/PageHeader";
import { getDictionary } from "@/lib/i18n/server";

/**
 * L'estratto conto — "apre il conto" (issue #62), non la lista movimenti
 * filtrata: qui si vedono anche i fatti del conto (saldo iniziale, tipo),
 * invisibili in `/transazioni?conto=`.
 *
 * ⚠️ Nessun numero ricalcolato: `getAccount()` legge `account_balances`, e la
 * lista sotto (`AccountDetailClient`) legge `getTransactions({ conto })` —
 * la stessa funzione che alimenta `/transazioni`. È il vincolo che la issue
 * pone esplicitamente per questa pagina.
 */
export default async function AccountDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const [result, t] = await Promise.all([getAccount(id), getDictionary()]);

	if ("error" in result) {
		/*
		 * ⚠️ Un id malformato, un conto altrui e un guasto di rete finiscono
		 * tutti qui, con testi diversi: `getAccount()` distingue già "non
		 * trovato" da un errore di lettura vero (`error.message`), quindi
		 * questa pagina non deve rifare quella distinzione — la eredita.
		 */
		return (
			<div className="flex flex-col min-h-dvh px-5 pt-7 pb-36">
				<PageHeader title={t.accounts.title} backHref="/conti" />
				<p className="text-muted text-sm mt-4">{result.error}</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-36">
			<PageHeader title={result.data.name} backHref="/conti" />
			<AccountDetailClient account={result.data} />
		</div>
	);
}
