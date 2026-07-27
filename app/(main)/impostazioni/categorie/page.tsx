import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getCategories } from "../actions";
import CategoryManager from "@/components/features/CategoryManager";

export default async function CategoriePage() {
	const result = await getCategories();
	const categories = "error" in result ? [] : result.data;

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			<div className="flex items-center gap-3.5 mb-6">
				<Link
					href="/impostazioni"
					className="w-10 h-10 rounded-xl flex items-center justify-center bg-control border border-subtle shrink-0"
					aria-label="Indietro"
				>
					<ChevronLeft size={17} className="text-secondary" />
				</Link>
				<h1 className="text-[22px] font-semibold">Categorie</h1>
			</div>

			<CategoryManager categories={categories} />
		</div>
	);
}
