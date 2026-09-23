import { getAccounts } from "./actions";
import AccountsPageClient from "@/components/features/AccountsPageClient";
import { getDictionary } from "@/lib/i18n/server";

export default async function ContiPage() {
	const result = await getAccounts();
	const t = await getDictionary();

	if ("error" in result) {
		console.error("[conti] getAccounts:", result.error);
		return <p className="p-6 text-muted text-sm">{t.accounts.loadError}</p>;
	}

	return (
		/*
		 * lg: la cornice del mockup desktop (#108) — 34/40/48 di margine e fino a
		 * 1152px di larghezza, la stessa di tutte le pagine della issue. Il
		 * `pb-36` mobile esiste per la bottom nav, che da lg non c'è più.
		 */
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-36 lg:px-10 lg:pt-9 lg:pb-12 lg:max-w-6xl lg:mx-auto lg:w-full">
			<AccountsPageClient accounts={result.data} />
		</div>
	);
}
