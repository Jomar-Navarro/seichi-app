import PageHeader from "@/components/UI/PageHeader";
import ProfileEditor from "@/components/features/ProfileEditor";
import { getAccountContext } from "@/lib/account";

export default async function ProfiloPage() {
	const account = await getAccountContext();

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			<PageHeader title="Foto profilo" backHref="/impostazioni" />
			<ProfileEditor
				fullName={account.fullName}
				avatarUrl={account.avatarUrl}
				initials={account.initials}
				email={account.email}
			/>
		</div>
	);
}
