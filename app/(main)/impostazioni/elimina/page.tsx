import PageHeader from "@/components/UI/PageHeader";
import DeleteAccountFlow from "@/components/features/DeleteAccountFlow";
import { getAccountContext } from "@/lib/account";
import { getI18n } from "@/lib/i18n/server";

export default async function EliminaAccountPage() {
	const account = await getAccountContext();
	const { t } = await getI18n();

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			<PageHeader
				title={t.settings.deleteAccount}
				backHref="/impostazioni"
				tone="var(--color-aka)"
				className="mb-5.5"
			/>
			<DeleteAccountFlow
				email={account.email}
				hasPasswordIdentity={account.hasPasswordIdentity}
			/>
		</div>
	);
}
