/**
 * Allegati / ricevute — la meccanica condivisa (Fase 22, issue #36).
 *
 * Qui stanno solo i FATTI: nomi, limiti, formati. Le parole vivono nei
 * dizionari, come per ogni altro modulo di `lib/` dalla Fase 19.
 *
 * ⚠️ Questo file è client-safe di proposito: lo importano sia le server action
 * sia il componente che ridimensiona la foto prima di caricarla. Nessun
 * `next/headers`, nessun client Supabase.
 */

/** Il bucket, PRIVATO — vedi `20260818_attachments.sql`. */
export const RECEIPT_BUCKET = "receipts";

/**
 * ⚠️ Quarto membro di una CATENA che va tenuta allineata a mano, e cambiarne
 * uno solo produce un rifiuto che arriva dal livello sbagliato con un messaggio
 * che non aiuta:
 *
 *   1. `bodySizeLimit` in next.config.ts   3 MB  (vale sul body multipart
 *                                                 grezzo, quindi più alto)
 *   2. `file_size_limit` del bucket        2 MB  (20260818)
 *   3. `ATTACHMENT_MAX_BYTES` qui          2 MB
 *   4. il testo nella UI                   dal dizionario, con `{max}` preso
 *                                          da questa costante — mai riscritto
 *
 * Il punto 4 è la stessa difesa già usata per l'avatar: il numero nella frase
 * viene dal codice, così non può divergere da ciò che il codice fa davvero.
 */
export const ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;

/**
 * MIME accettati → estensione del file.
 *
 * ⚠️ Deve restare allineato ad `allowed_mime_types` del bucket. Il doppio
 * controllo non è ridondanza inutile: qui produce un messaggio leggibile, là è
 * il vincolo che regge anche contro una richiesta costruita a mano.
 *
 * ⚠️ Niente PDF, ed è deliberato: una fattura via email è un caso reale, ma
 * mostrarla in-app non è un dettaglio. Ammetterlo dopo costa una riga di
 * `update storage.buckets` e nessun backfill.
 */
export const ATTACHMENT_MIME: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

/**
 * Quanto vive un URL firmato, in secondi.
 *
 * ⚠️ Corto DI PROPOSITO. L'URL è la chiave del file: chi ce l'ha entra, RLS o
 * no. Dieci minuti bastano ad aprire e guardare una ricevuta, e non
 * trasformano un link copiato per sbaglio in un accesso permanente.
 *
 * Non si memorizza in colonna: una firma scade, quindi salvarla darebbe un dato
 * che diventa falso da solo. Si salva il PATH e si firma all'apertura.
 */
export const SIGNED_URL_TTL = 600;

/**
 * Il lato lungo massimo dopo il ridimensionamento, in pixel.
 *
 * ⚠️ La riduzione lato client NON è un'ottimizzazione: è il prerequisito. La
 * foto di un telefono pesa 3-8 MB, quindi senza ridimensionare **ogni upload
 * verrebbe rifiutato** e la funzione sarebbe inutilizzabile su un caso normale.
 *
 * 1600px è la misura in cui uno scontrino resta leggibile — è il testo stampato
 * che detta il minimo, non l'estetica.
 */
export const ATTACHMENT_MAX_EDGE = 1600;

/**
 * Il percorso dentro il bucket. Vedi la nota sul PIATTO nella migration.
 *
 * ⚠️ **Solo dal SERVER**, malgrado questo file sia per il resto client-safe.
 * `crypto.randomUUID()` esiste solo in **contesto sicuro**: in Node c'è sempre,
 * nel browser solo su HTTPS o `localhost` — e questo progetto si prova dal
 * telefono su `http://192.168.1.224:3000`, dove è `undefined`.
 *
 * Non è teoria: la Fase 22 ha perso un giro proprio così, con un
 * `crypto.randomUUID()` client che sollevava in silenzio e faceva sembrare
 * l'allegatura semplicemente non funzionante. Se un domani serve un id nel
 * browser, si usa `chiaveLocale()` di `AttachmentPicker`, che ha il ripiego.
 */
export function receiptPath(userId: string, ext: string): string {
	return `${userId}/${crypto.randomUUID()}.${ext}`;
}
