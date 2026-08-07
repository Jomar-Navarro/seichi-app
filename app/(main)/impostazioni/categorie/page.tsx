import { getCategories } from "../actions";
import CategoryManager from "@/components/features/CategoryManager";
import PageHeader from "@/components/UI/PageHeader";
import { getI18n } from "@/lib/i18n/server";

export default async function CategoriePage() {
	const result = await getCategories();
	const categories = "error" in result ? [] : result.data;
	const { t } = await getI18n();

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34">
			{/* Era il markup di PageHeader ricopiato a mano, freccia e aria-label
			    compresi. Con l'i18n sarebbe diventata una seconda stringa "Indietro"
			    da tradurre a parte, quindi le due copie collassano sul componente. */}
			<PageHeader title={t.settings.groups.categories} backHref="/impostazioni" />

			<CategoryManager categories={categories} />
		</div>
	);
}
