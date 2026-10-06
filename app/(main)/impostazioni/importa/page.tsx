import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import PageHeader from "@/components/UI/PageHeader";
import ImportFlow from "@/components/features/ImportFlow";
import LoadError from "@/components/UI/LoadError";
import { listImports } from "./actions";

/**
 * L'import di transazioni da file (Fase 21, issue #35).
 *
 * ⚠️ Conti e categorie si caricano QUI, non dentro il flusso: il passo delle
 * decisioni deve poter offrire i selettori senza una richiesta per gruppo, e un
 * client component che li caricasse da sé li ricaricherebbe a ogni apertura di
 * un pannello. Sono anche pochi dati e cambiano di rado.
 *
 * ⚠️ Solo i conti NON archiviati. Un import su un conto archiviato scriverebbe
 * movimenti esclusi da ogni totale mostrato — lo stesso guasto silenzioso che la
 * 20b ha chiuso vietando le ricorrenti sui conti archiviati.
 */
export default async function ImportaPage() {
	const { supabase, user } = await requireUser();
	if (!user) redirect("/sign");

	const { t } = await getI18n();

	/*
	 * ⚠️ Gli import già fatti si caricano QUI, e non è un di più: senza questo
	 * elenco l'annullamento vive solo nella schermata finale del flusso, cioè
	 * scompare appena si naviga altrove. Il lotto era stato progettato apposta
	 * per rendere un import reversibile — dare al comando la vita di una
	 * schermata annullava metà di quel lavoro.
	 */
	const previous = await listImports();

	const [accountsRes, categoriesRes] = await Promise.all([
		supabase
			.from("accounts")
			.select("id, name, type, icon, color")
			.eq("user_id", user.id)
			.eq("archived", false)
			.order("created_at", { ascending: true }),
		supabase
			.from("categories")
			.select("id, name, type, icon")
			.eq("user_id", user.id)
			.order("name", { ascending: true }),
	]);

	/*
	 * ⚠️ `pb-34` come ogni altra pagina di impostazioni, non meno: la `BottomNav`
	 * è `fixed` (pastiglia da 64px più una fascia sfocata da 112px), quindi con un
	 * padding più corto l'ultimo elemento della pagina finisce sotto la barra. Con
	 * `pb-24` il pulsante "Continua" era coperto.
	 */
	/*
	 * ⚠️ Conti e categorie non letti FERMANO il flusso, non lo svuotano (#124).
	 * Con gli elenchi vuoti il primo passo diceva "non hai conti" e offriva di
	 * crearne uno, e i selettori del secondo non avevano categorie: un import
	 * fatto così finiva su un conto doppione, senza categorie. Il messaggio
	 * grezzo resta nel log.
	 */
	const readFailed = accountsRes.error ?? categoriesRes.error;
	if (readFailed) console.error("[import] conti/categorie:", readFailed.message);

	return (
		<div className="flex flex-col min-h-dvh px-5 pt-7 pb-34 lg:max-w-2xl lg:mx-auto lg:w-full">
			<PageHeader title={t.import.title} backHref="/impostazioni" className="mb-5" />
			{readFailed ? (
				<LoadError message={t.import.loadError} />
			) : (
				<ImportFlow
					accounts={accountsRes.data ?? []}
					categories={categoriesRes.data ?? []}
					previous={"data" in previous ? previous.data : []}
					previousFailed={"error" in previous}
				/>
			)}
		</div>
	);
}
