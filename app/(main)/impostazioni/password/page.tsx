import { redirect } from "next/navigation";
import PageHeader from "@/components/UI/PageHeader";
import PasswordChangeForm from "@/components/features/PasswordChangeForm";
import { getAccountContext } from "@/lib/account";

export default async function CambiaPasswordPage() {
	const account = await getAccountContext();

	// Gli account creati solo via Google/Facebook non hanno una password
	if (!account.hasPasswordIdentity) redirect("/impostazioni");

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			<PageHeader title="Cambia password" backHref="/impostazioni" />
			<PasswordChangeForm />
		</div>
	);
}
