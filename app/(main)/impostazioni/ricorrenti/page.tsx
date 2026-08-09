import { getRecurringRules } from "../../action";
import RecurringManager from "@/components/features/RecurringManager";
import PageHeader from "@/components/UI/PageHeader";
import JobHealthNotice from "@/components/features/JobHealthNotice";
import { getI18n } from "@/lib/i18n/server";
import { getDailyJobHealth } from "@/lib/jobs";
import type { RecurringRule } from "@/types";

export default async function RicorrentiPage() {
	// ⚠️ L'avviso sta QUI e non in home, ed è una scelta: questa è la pagina i cui
	// dati sono sbagliati quando il job è fermo — le regole mostrano date passate
	// che non hanno generato nulla. Metterlo in home sarebbe costato una richiesta
	// REST a ogni vista della dashboard, pagata sempre, anche a job sano.
	const [result, jobHealth] = await Promise.all([
		getRecurringRules(),
		getDailyJobHealth(),
	]);
	const rules = "error" in result ? [] : ((result.data as RecurringRule[]) ?? []);
	const { t } = await getI18n();

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			{/* Come per /impostazioni/categorie: intestazione ricopiata a mano,
			    ora sul componente condiviso. */}
			<PageHeader title={t.settings.recurringTitle} backHref="/impostazioni" />

			{jobHealth?.stale && <JobHealthNotice health={jobHealth} />}

			<RecurringManager rules={rules} />
		</div>
	);
}
