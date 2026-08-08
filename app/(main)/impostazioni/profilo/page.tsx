import PageHeader from "@/components/UI/PageHeader";
import ProfileEditor from "@/components/features/ProfileEditor";
import { getAccountContext } from "@/lib/account";
import { getI18n } from "@/lib/i18n/server";

export default async function ProfiloPage() {
	const account = await getAccountContext();
	const { t } = await getI18n();

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			<PageHeader title={t.settings.profilePhoto} backHref="/impostazioni" />
			<ProfileEditor
				fullName={account.fullName}
				avatarUrl={account.avatarUrl}
				initials={account.initials}
				email={account.email}
			/>
		</div>
	);
}
