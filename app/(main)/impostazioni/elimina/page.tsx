import PageHeader from "@/components/UI/PageHeader";
import DeleteAccountFlow from "@/components/features/DeleteAccountFlow";
import { getAccountContext } from "@/lib/account";

export default async function EliminaAccountPage() {
	const account = await getAccountContext();

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			<PageHeader
				title="Elimina il tuo account"
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
