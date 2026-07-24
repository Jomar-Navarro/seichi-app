import { getInvestments } from "../risparmi/actions";
import InvestimentiTab from "@/components/features/InvestimentiTab";

export default async function InvestimentiPage() {
	const result = await getInvestments();
	const data = "error" in result ? null : result.data;

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-36">
			<h1 className="text-[26px] font-semibold leading-tight mb-1">Investimenti</h1>
			<InvestimentiTab data={data} />
		</div>
	);
}
