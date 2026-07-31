import { redirect } from "next/navigation";
import PageHeader from "@/components/UI/PageHeader";
import EmailChangeForm from "@/components/features/EmailChangeForm";
import { getAccountContext } from "@/lib/account";

export default async function ModificaEmailPage() {
	const account = await getAccountContext();

	// Senza identità "email" non c'è una password con cui riautenticarsi:
	// l'indirizzo è quello del provider OAuth e va cambiato lì.
	if (!account.hasPasswordIdentity) redirect("/impostazioni");

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			<PageHeader title="Modifica email" backHref="/impostazioni" />
			<EmailChangeForm currentEmail={account.email} />
		</div>
	);
}
