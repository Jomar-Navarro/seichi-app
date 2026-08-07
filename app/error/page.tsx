import { getDictionary } from "@/lib/i18n/server";

/**
 * Pagina d'errore generica.
 *
 * Era l'unica stringa cablata rimasta in INGLESE ("Sorry, something went
 * wrong") — prova che cercare "testo italiano" non poteva bastare: una frase
 * inglese in un'app italiana è altrettanto sbagliata, e nessun elenco di parole
 * italiane l'avrebbe mai trovata.
 */
export default async function ErrorPage() {
	const t = await getDictionary();
	return <p className="p-6 text-muted text-sm">{t.common.genericError}</p>;
}
