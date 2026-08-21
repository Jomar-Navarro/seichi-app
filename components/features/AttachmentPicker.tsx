"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Paperclip, Trash2, X } from "lucide-react";
import {
	ATTACHMENT_MAX_BYTES,
	ATTACHMENT_MAX_EDGE,
	ATTACHMENT_MIME,
} from "@/lib/attachments";
import {
	deleteAttachment,
	getAttachments,
	uploadAttachment,
} from "@/app/(main)/attachment-actions";
import { useI18n } from "@/components/features/I18nProvider";
import { fill, plural } from "@/lib/i18n/format";
import type { Attachment } from "@/types";

/**
 * Riduce una foto prima di caricarla.
 *
 * ⚠️ **Non è un'ottimizzazione: è il prerequisito.** La foto di un telefono pesa
 * 3-8 MB, quindi senza questo passaggio ogni upload verrebbe rifiutato dal
 * limite del bucket — la funzione sarebbe inutilizzabile sul caso normale, che è
 * poi l'unico caso.
 *
 * ⚠️ Il risultato è sempre **JPEG**, anche partendo da PNG: uno scontrino
 * fotografato è un'immagine continua, e il PNG senza perdita lo salverebbe a
 * dieci volte la dimensione per una fedeltà che nessuno guarda. Il tipo esce
 * comunque dall'elenco ammesso dal bucket.
 *
 * Se qualcosa va storto si restituisce il file ORIGINALE invece di fallire: sarà
 * il controllo di dimensione lato server a dire di no, con una frase leggibile.
 * Meglio un rifiuto spiegato che un errore di canvas addosso all'utente.
 */
async function downscale(file: File): Promise<File> {
	try {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, ATTACHMENT_MAX_EDGE / Math.max(bitmap.width, bitmap.height));

		// Già abbastanza piccola E abbastanza leggera: non si ricomprime per
		// niente, che aggiungerebbe artefatti senza guadagnare byte.
		if (scale === 1 && file.size <= ATTACHMENT_MAX_BYTES) return file;

		const canvas = document.createElement("canvas");
		canvas.width = Math.round(bitmap.width * scale);
		canvas.height = Math.round(bitmap.height * scale);

		const ctx = canvas.getContext("2d");
		if (!ctx) return file;
		ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		bitmap.close();

		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/jpeg", 0.85),
		);
		if (!blob) return file;

		return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", {
			type: "image/jpeg",
		});
	} catch {
		return file;
	}
}

/** Una ricevuta scelta ma non ancora caricata: esiste solo nel browser. */
type Pendente = { key: string; file: File; preview: string };

/**
 * Le ricevute di un movimento: elenco, aggiunta, rimozione.
 *
 * ⚠️ Funziona in DUE modi, e il secondo esiste perché la prima stesura sbagliava.
 *
 * - **movimento esistente** (`transactionId` valorizzato): ogni gesto va subito
 *   sul server;
 * - **movimento ancora da creare** (`null`): le foto restano nel BROWSER e il
 *   form le carica dopo il salvataggio, dentro lo stesso gesto.
 *
 * Il secondo modo mancava, e la limitazione era stata difesa così: "un allegato
 * ha bisogno di un `transaction_id` che in creazione non esiste". Vero, ma la
 * conclusione — *quindi si allega dopo* — saltava la via d'uscita più semplice:
 * tenere il file in memoria e caricarlo appena l'id c'è. Il caso reale è
 * fotografare lo scontrino **mentre** si registra la spesa, quindi obbligare a
 * salvare e riaprire mette un ostacolo proprio sul percorso più frequente.
 *
 * ⚠️ Restano scartate le due alternative peggiori: un percorso temporaneo da
 * spostare (due scritture, con un orfano se la seconda fallisce) e un
 * salvataggio di nascosto per ottenere l'id (scrive un movimento che l'utente
 * non ha confermato).
 */
export default function AttachmentPicker({
	transactionId,
	onPendingChange,
}: {
	transactionId: string | null;
	/** I file in attesa, per il form che li caricherà dopo il salvataggio. */
	onPendingChange?: (files: File[]) => void;
}) {
	const { t, locale } = useI18n();
	const [items, setItems] = useState<Attachment[]>([]);
	const [pendenti, setPendenti] = useState<Pendente[]>([]);
	const [loading, setLoading] = useState(!!transactionId);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	/** L'id in attesa di conferma: il primo tocco arma, il secondo rimuove. */
	const [confirming, setConfirming] = useState<string | null>(null);
	const [zoomed, setZoomed] = useState<{ url: string } | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!transactionId) return;
		let cancelled = false;
		getAttachments(transactionId).then((res) => {
			if (cancelled) return;
			if ("data" in res) setItems(res.data);
			setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [transactionId]);

	/*
	 * ⚠️ Le anteprime locali sono `blob:` e vanno REVOCATE allo smontaggio: senza,
	 * ogni foto scelta e poi scartata resta in memoria finché la scheda non viene
	 * chiusa. Su un modale che si apre e chiude decine di volte al giorno è una
	 * perdita che cresce in silenzio.
	 */
	useEffect(() => {
		return () => {
			for (const p of pendenti) URL.revokeObjectURL(p.preview);
		};
		// Volutamente al solo smontaggio: le revoche mirate stanno in `scarta()`.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function aggiornaPendenti(next: Pendente[]) {
		setPendenti(next);
		onPendingChange?.(next.map((p) => p.file));
	}

	async function pick(file: File | null) {
		if (!file) return;
		setError(null);
		setPending(true);
		try {
			const shrunk = await downscale(file);

			// Senza id il file resta qui: lo caricherà il form dopo il salvataggio.
			if (!transactionId) {
				aggiornaPendenti([
					...pendenti,
					{
						key: crypto.randomUUID(),
						file: shrunk,
						preview: URL.createObjectURL(shrunk),
					},
				]);
				return;
			}

			const form = new FormData();
			form.set("transactionId", transactionId);
			form.set("file", shrunk);

			const res = await uploadAttachment(form);
			if ("error" in res) {
				setError(res.error);
				return;
			}
			setItems((prev) => [...prev, res.data]);
		} finally {
			/*
			 * ⚠️ `finally`, non una riga dopo l'await: se la server action rifiuta —
			 * rete caduta, deploy in corso — `pending` resterebbe `true` e il pulsante
			 * bloccato senza messaggio e senza via d'uscita. È la stessa correzione
			 * già registrata per l'import.
			 */
			setPending(false);
			// L'input si azzera SEMPRE: senza, riscegliere lo stesso file non
			// scatenerebbe `change` e il secondo tentativo sembrerebbe ignorato.
			if (inputRef.current) inputRef.current.value = "";
		}
	}

	async function remove(id: string) {
		setError(null);
		setPending(true);
		try {
			const res = await deleteAttachment(id);
			if (res.error) {
				setError(res.error);
				return;
			}
			setItems((prev) => prev.filter((a) => a.id !== id));
		} finally {
			setPending(false);
			setConfirming(null);
		}
	}

	/** Scarta una foto non ancora caricata: nessun server, solo memoria. */
	function scarta(key: string) {
		const p = pendenti.find((x) => x.key === key);
		if (p) URL.revokeObjectURL(p.preview);
		aggiornaPendenti(pendenti.filter((x) => x.key !== key));
		setConfirming(null);
	}

	// Caricate + in attesa: per l'utente sono tutte "ricevute di questo movimento",
	// e distinguerle nel conteggio significherebbe spiegare una differenza che
	// riguarda noi (esiste già una riga?) e non lui.
	const totale = items.length + pendenti.length;

	return (
		// ⚠️ `mb-5` oltre a `mt-5`: senza, il limite ("JPG, PNG o WebP · massimo
		// 2 MB") finisce appoggiato al tastierino, e una riga di servizio incollata
		// ai tasti si legge come parte di essi.
		<div className="mt-5 mb-5">
			<div className="flex items-center justify-between mb-2.5">
				<span className="text-[13px] font-medium text-secondary">
					{t.attachments.title}
				</span>
				{totale > 0 && (
					<span className="text-[11.5px] text-disabled">
						{plural(t.attachments.count, totale, locale)}
					</span>
				)}
			</div>

			{loading ? (
				<p className="text-[12.5px] text-disabled">{t.common.loading}</p>
			) : (
				<div className="flex flex-wrap gap-2.5">
					{items.map((a) => (
						<div key={a.id} className="relative">
							<button
								type="button"
								// Il visore vuole un url CERTO: `a.url` è nullable (file sparito
								// dal bucket), e la guardia qui è ciò che rende il tipo onesto
								// invece di costringere il visore ad accettare `null`.
								onClick={() => a.url && setZoomed({ url: a.url })}
								className="w-20 h-20 rounded-xl overflow-hidden bg-input border border-subtle flex items-center justify-center"
								aria-label={t.attachments.open}
							>
								{a.url ? (
									<Image
										src={a.url}
										alt=""
										width={80}
										height={80}
										className="w-full h-full object-cover"
										unoptimized
									/>
								) : (
									// ⚠️ Una riga senza file si MOSTRA come rotta invece di
									// sparire: nasconderla darebbe un elenco che non corrisponde
									// a ciò che il database contiene, e nessun modo di ripulirlo.
									<span className="text-[10px] text-disabled px-1 text-center leading-tight">
										{t.attachments.missing}
									</span>
								)}
							</button>

							{/*
								⚠️ Due tocchi, come "Archivia" nella pagina conti: il primo arma
								la conferma nello stato locale, il secondo rimuove. Una ricevuta
								cancellata non torna, e il bersaglio qui è un quadratino da 20px
								nell'angolo di una miniatura.
							*/}
							<button
								type="button"
								disabled={pending}
								onClick={() =>
									confirming === a.id ? remove(a.id) : setConfirming(a.id)
								}
								onBlur={() => setConfirming((c) => (c === a.id ? null : c))}
								className={`absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center border border-subtle ${
									confirming === a.id
										? "px-2 h-6 bg-aka text-[10px] font-semibold"
										: "w-6 h-6 bg-card"
								}`}
								style={confirming === a.id ? { color: "var(--on-accent)" } : undefined}
								aria-label={t.attachments.remove}
							>
								{confirming === a.id ? t.common.confirm : <Trash2 size={12} />}
							</button>
						</div>
					))}

					{/*
						Le foto scelte ma non ancora caricate. Si vedono uguali alle altre
						— stessa miniatura, stesso cestino — perché per chi guarda sono già
						"la ricevuta di questo movimento": la differenza (esiste una riga
						nel database?) riguarda noi, non lui.
					*/}
					{pendenti.map((p) => (
						<div key={p.key} className="relative">
							<button
								type="button"
								onClick={() => setZoomed({ url: p.preview })}
								className="w-20 h-20 rounded-xl overflow-hidden bg-input border border-subtle"
								aria-label={t.attachments.open}
							>
								{/*
									⚠️ `<img>` e non `next/image`: la sorgente è un `blob:` locale,
									che l'ottimizzatore non può né scaricare né validare contro
									`remotePatterns`. Non è una scorciatoia — è l'unico modo di
									mostrare un file che non ha ancora un URL.
								*/}
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img src={p.preview} alt="" className="w-full h-full object-cover" />
							</button>
							<button
								type="button"
								onClick={() =>
									confirming === p.key ? scarta(p.key) : setConfirming(p.key)
								}
								onBlur={() => setConfirming((c) => (c === p.key ? null : c))}
								className={`absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center border border-subtle ${
									confirming === p.key
										? "px-2 h-6 bg-aka text-[10px] font-semibold"
										: "w-6 h-6 bg-card"
								}`}
								style={confirming === p.key ? { color: "var(--on-accent)" } : undefined}
								aria-label={t.attachments.remove}
							>
								{confirming === p.key ? t.common.confirm : <Trash2 size={12} />}
							</button>
						</div>
					))}

					<button
						type="button"
						disabled={pending}
						onClick={() => inputRef.current?.click()}
						className="w-20 h-20 rounded-xl border border-dashed border-subtle flex flex-col items-center justify-center gap-1 text-disabled disabled:opacity-50"
					>
						<Paperclip size={16} />
						<span className="text-[10px] leading-tight text-center px-1">
							{pending ? t.attachments.uploading : t.attachments.add}
						</span>
					</button>
				</div>
			)}

			<input
				ref={inputRef}
				type="file"
				accept={Object.keys(ATTACHMENT_MIME).join(",")}
				className="hidden"
				onChange={(e) => pick(e.target.files?.[0] ?? null)}
			/>

			<p className="mt-2 text-[11px] text-disabled">
				{fill(t.attachments.hint, { max: ATTACHMENT_MAX_BYTES / 1024 / 1024 })}
			</p>

			{error && <p className="mt-1.5 text-[11.5px] text-aka-ink">{error}</p>}

			{/* Schermo intero: uno scontrino a 80px non si legge. */}
			{zoomed?.url && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center p-4"
					style={{ background: "var(--modal-bg)" }}
					onClick={() => setZoomed(null)}
				>
					<button
						type="button"
						onClick={() => setZoomed(null)}
						className="absolute top-5 right-5 w-9 h-9 rounded-xl bg-control border border-subtle flex items-center justify-center"
						aria-label={t.common.close}
					>
						<X size={16} />
					</button>
					{/*
						⚠️ `<img>` e non `next/image`, al contrario delle miniature caricate.
						Qui la sorgente può essere DUE cose — un URL firmato oppure un
						`blob:` locale di una foto non ancora caricata — e
						l'ottimizzatore un blob non sa né scaricarlo né validarlo contro
						`remotePatterns`. Un componente che deve reggere entrambe le
						sorgenti non può usare quello che ne accetta una sola.
					*/}
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img
						src={zoomed.url}
						alt=""
						className="max-w-full max-h-full w-auto h-auto object-contain rounded-xl"
					/>
				</div>
			)}
		</div>
	);
}
