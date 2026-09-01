/**
 * Che cosa sono «uscite» e «flusso» quando si parte dai TOTALI PER TIPO.
 *
 * ⚠️ Esiste già `sommaUscite()` in `app/(main)/action.ts`, e non è un duplicato:
 * quella somma righe di transazione (`{type, amount}[]`), questa parte da totali
 * già aggregati per tipo — cioè da `dashboard_totals()`. Stessa definizione, due
 * forme di ingresso, e vale la pena che ciascuna abbia un nome invece di essere
 * ricopiata a mano dove serve.
 *
 * ⚠️ Perché in `lib/` e non accanto a `getDashboardTotals()`: da un file
 * `"use server"` si possono esportare **solo funzioni async**. Una funzione
 * sincrona lì fa fallire `next build` con *"Only async functions are allowed to
 * be exported"*, e né `tsc` né il lint lo vedono — la stessa trappola già
 * registrata per `TRANSACTIONS_PAGE_SIZE` nella 21c.
 *
 * La storia di questa definizione è documentata in `sommaUscite()`: `/analisi`
 * sommava come uscita ogni tipo diverso da `entrata`, quindi anche `risparmio` e
 * `investimento`. Con i conti quel denaro è ancora tuo — solo altrove — e
 * contarlo come uscita lo fa sembrare speso.
 */

/**
 * Le USCITE di un periodo: spese variabili **più** abbonamenti.
 *
 * ⚠️ Gli abbonamenti ci sono, e non è un dettaglio: affitto e utenze sono
 * categorie `abbonamento`, quindi un totale che li ignora dice «ti restano X»
 * mentre X deve ancora uscire. È la regola della 17a — *"spese variabili", mai
 * "spese totali"* — e la ragione per cui il sottotitolo della home dice
 * "uscite" e non "spese".
 */
export function usciteDaTotali(spese: number, abbonamenti: number): number {
	return spese + abbonamenti;
}

/**
 * Il FLUSSO di un periodo: entrate − uscite.
 *
 * ⚠️ Risparmi e investimenti NON si sottraggono. Investire e risparmiare non è
 * *consumare*, è **spostare**: con i conti quel denaro è ancora tuo, solo
 * altrove, e sottrarlo lo farebbe sembrare speso — la premessa dell'intera Fase
 * 20a, quella per cui `saldoTotale` è stato cancellato dalla home.
 */
export function flussoDaTotali(
	entrate: number,
	spese: number,
	abbonamenti: number,
): number {
	return entrate - usciteDaTotali(spese, abbonamenti);
}
