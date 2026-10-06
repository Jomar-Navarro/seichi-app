import { getCategories } from "../actions";
import CategoryManager from "@/components/features/CategoryManager";
import PageHeader from "@/components/UI/PageHeader";
import LoadError from "@/components/UI/LoadError";
import { getI18n } from "@/lib/i18n/server";

export default async function CategoriePage() {
	const result = await getCategories();
	const { t } = await getI18n();

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34 lg:max-w-2xl lg:mx-auto lg:w-full">
			{/* Era il markup di PageHeader ricopiato a mano, freccia e aria-label
			    compresi. Con l'i18n sarebbe diventata una seconda stringa "Indietro"
			    da tradurre a parte, quindi le due copie collassano sul componente. */}
			<PageHeader title={t.settings.groups.categories} backHref="/impostazioni" />

			{/*
				⚠️ Non una lista vuota (#124): `CategoryManager` con zero categorie
				invita a crearne, e su una lettura fallita quell'invito portava a
				duplicare categorie che esistono già.
			*/}
			{"error" in result ? (
				<LoadError message={t.categories.loadError} />
			) : (
				<CategoryManager categories={result.data} />
			)}
		</div>
	);
}
