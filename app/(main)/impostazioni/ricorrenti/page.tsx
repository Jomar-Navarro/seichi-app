import { getRecurringRules } from "../../action";
import RecurringManager from "@/components/features/RecurringManager";
import PageHeader from "@/components/UI/PageHeader";
import { getI18n } from "@/lib/i18n/server";
import type { RecurringRule } from "@/types";

export default async function RicorrentiPage() {
	const result = await getRecurringRules();
	const rules = "error" in result ? [] : ((result.data as RecurringRule[]) ?? []);
	const { t } = await getI18n();

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			{/* Come per /impostazioni/categorie: intestazione ricopiata a mano,
			    ora sul componente condiviso. */}
			<PageHeader title={t.settings.recurringTitle} backHref="/impostazioni" />

			<RecurringManager rules={rules} />
		</div>
	);
}
