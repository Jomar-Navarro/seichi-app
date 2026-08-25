"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import Select from "@/components/UI/Select";
import { useI18n } from "./I18nProvider";
import { TRANSACTION_PERIODS, categoryTypeFor } from "@/lib/transaction-utils";
import { TRANSACTION_TYPES, type Account, type Category } from "@/types";

interface ExportPanelProps {
	accounts: Pick<Account, "id" | "name" | "archived">[];
	categories: Pick<Category, "id" | "name" | "type">[];
	/** Con zero movimenti il comando non compare: vedi `t.export.nothing`. */
	hasTransactions: boolean;
}

/**
 * I filtri dell'export e il comando che scarica (Fase 23a, issue #37).
 *
 * ⚠️ Il vocabolario dei filtri è **lo stesso della lista movimenti** — stesse
 * quattro dimensioni, stesse etichette, stesso default a 30 giorni. Non è
 * simmetria estetica: chi arriva qui ha già in mente la lista che ha appena
 * guardato, e un secondo vocabolario per la stessa domanda lo costringerebbe a
 * ricostruire da capo quale sottoinsieme sta chiedendo.
 *
 * ⚠️ NON riusa `FilterBar`: quella porta un campo di RICERCA, che qui non
 * avrebbe significato — la ricerca filtra lato client sulle righe già caricate,
 * e in un file non c'è nessuna riga già caricata. Un campo inerte insegna a
 * ignorare i comandi accanto.
 */
export default function ExportPanel({
	accounts,
	categories,
	hasTransactions,
}: ExportPanelProps) {
	const { t } = useI18n();
	const [periodo, setPeriodo] = useState("30d");
	const [tipo, setTipo] = useState("");
	const [conto, setConto] = useState("");
	const [categoria, setCategoria] = useState("");

	const periodoOptions = TRANSACTION_PERIODS.map((id) => ({
		icon: null,
		value: id,
		label: t.transactions.periods[id],
	}));

	const tipoOptions = [
		{ icon: null, value: "", label: t.transactions.filterAll },
		...TRANSACTION_TYPES.map((type) => ({
			icon: null,
			value: type.id,
			label: t.types[type.id as keyof typeof t.types],
		})),
	];

	/*
	 * ⚠️ Il conto ARCHIVIATO resta scegliibile, al contrario della lista.
	 *
	 * Là il filtro serve a guardare come si sta andando, e un conto chiuso non
	 * risponde a quella domanda. Qui si esporta lo STORICO: i movimenti di un
	 * conto archiviato sono esattamente quelli che si vuole poter tirare fuori
	 * prima di dimenticarsene. Escluderli renderebbe l'export incapace di
	 * raccontare la parte di storia già chiusa.
	 */
	const contoOptions = [
		{ icon: null, value: "", label: t.accounts.all },
		...accounts.map((a) => ({ icon: null, value: a.id, label: a.name })),
	];

	/*
	 * Le categorie seguono il tipo scelto, come nella barra filtri — e quella
	 * selezionata resta nell'elenco anche quando smette di corrispondere, o
	 * cambiando tipo sparirebbe lasciando un filtro attivo che nessun comando
	 * sa più nominare.
	 */
	const selectableCats = categories.filter(
		(c) => !tipo || c.type === categoryTypeFor(tipo) || c.id === categoria,
	);
	const categoriaOptions = [
		{ icon: null, value: "", label: t.transactions.filterAllCategories },
		...selectableCats.map((c) => ({ icon: null, value: c.id, label: c.name })),
	];

	/**
	 * ⚠️ Cambiando tipo, una categoria non più compatibile va TOLTA — e qui
	 * la scelta è OPPOSTA a quella della barra filtri, di proposito.
	 *
	 * Là la categoria incompatibile resta selezionata perché il chip la
	 * nomina e la lista dice "nessun movimento con questi filtri": l'utente
	 * vede lo scarto e lo corregge. Qui il risultato è un FILE con la sola
	 * riga di intestazione, che si legge come "non ho movimenti di questo
	 * tipo" — esattamente l'affermazione falsa che il rifiuto dei filtri
	 * malformati esiste per impedire, ottenuta però con filtri validi.
	 */
	function changeTipo(next: string) {
		setTipo(next);
		const compatibile =
			!categoria ||
			!next ||
			categories.some((c) => c.id === categoria && c.type === categoryTypeFor(next));
		if (!compatibile) setCategoria("");
	}

	const params = new URLSearchParams({ periodo });
	if (tipo) params.set("tipo", tipo);
	if (conto) params.set("conto", conto);
	if (categoria) params.set("categoria", categoria);

	return (
		<div>
			<p className="text-[13.5px] text-secondary leading-relaxed">{t.export.intro}</p>
			{/*
				⚠️ La frase che dice cosa il file NON è sta accanto al comando, non in
				fondo alla pagina: è l'aspettativa sbagliata più probabile ("ho un
				backup"), e una precisazione che si legge dopo aver scaricato arriva
				tardi.
			*/}
			<p className="text-[12.5px] text-muted leading-relaxed mt-2">{t.export.notBackup}</p>

			<p className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-disabled mt-7 mb-3 ml-0.5">
				{t.export.filters}
			</p>

			<div className="space-y-3.5">
				<Select
					variant="compact"
					title={t.export.fields.period}
					options={periodoOptions}
					selected={periodo}
					onChange={setPeriodo}
				/>
				<Select
					variant="compact"
					title={t.export.fields.type}
					options={tipoOptions}
					selected={tipo}
					onChange={changeTipo}
				/>
				{/* Nascosto con un conto solo: un comando con una scelta sola è rumore. */}
				{accounts.length > 1 && (
					<Select
						variant="compact"
						title={t.export.fields.account}
						options={contoOptions}
						selected={conto}
						onChange={setConto}
					/>
				)}
				{selectableCats.length > 0 && (
					<Select
						variant="compact"
						title={t.export.fields.category}
						options={categoriaOptions}
						selected={categoria}
						onChange={setCategoria}
					/>
				)}
			</div>

			{hasTransactions ? (
				/*
				 * ⚠️ Un `<a>` NUDO, non `<Link>` e senza attributo `download`.
				 *
				 * `<Link>` farebbe una navigazione client di Next: chiederebbe la rotta
				 * come payload RSC e non scaricherebbe niente. E `download` è inutile
				 * qui — il nome del file lo decide `Content-Disposition`, che il server
				 * costruisce sapendo periodo e conto; l'attributo servirebbe solo a dare
				 * al browser una seconda opinione su una cosa già decisa.
				 */
				<a
					href={`/impostazioni/esporta/download?${params.toString()}`}
					className="btn-primary w-full h-13 mt-7 rounded-[17px] text-[15px] font-semibold flex items-center justify-center gap-2.5"
				>
					<Download size={17} />
					{t.export.download}
				</a>
			) : (
				<p className="text-[13px] text-muted mt-7 text-center">{t.export.nothing}</p>
			)}
		</div>
	);
}
