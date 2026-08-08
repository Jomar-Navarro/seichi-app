import { getInvestments } from "../risparmi/actions";
import InvestimentiTab from "@/components/features/InvestimentiTab";
import { getDictionary } from "@/lib/i18n/server";

export default async function InvestimentiPage() {
	const result = await getInvestments();
	const data = "error" in result ? null : result.data;
	const t = await getDictionary();

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-36">
			<h1 className="text-[26px] font-semibold leading-tight mb-1">{t.investments.title}</h1>
			<InvestimentiTab data={data} />
		</div>
	);
}
