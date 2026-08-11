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
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-36">
			<AccountsPageClient accounts={result.data} />
		</div>
	);
}
