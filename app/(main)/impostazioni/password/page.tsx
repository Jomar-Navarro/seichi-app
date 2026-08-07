import { redirect } from "next/navigation";
import PageHeader from "@/components/UI/PageHeader";
import PasswordChangeForm from "@/components/features/PasswordChangeForm";
import { getAccountContext } from "@/lib/account";
import { getI18n } from "@/lib/i18n/server";

export default async function CambiaPasswordPage() {
	const account = await getAccountContext();
	const { t } = await getI18n();

	// Gli account creati solo via Google/Facebook non hanno una password
	if (!account.hasPasswordIdentity) redirect("/impostazioni");

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			<PageHeader title={t.settings.changePassword} backHref="/impostazioni" />
			<PasswordChangeForm />
		</div>
	);
}
