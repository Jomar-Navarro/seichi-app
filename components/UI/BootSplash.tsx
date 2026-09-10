import { Sprout } from "lucide-react";

/**
 * Velo di apertura — resta fermo un istante, poi si dissolve da sé
 * (`zg-boot-out`, globals.css). Copre {children} nel root layout finché non
 * si toglie: continua visivamente lo splash che l'OS mostra per la PWA
 * installata (stesso `--background`, letto dal manifest — vedi
 * `app/manifest.ts`), invece di lasciare che il primo contenuto vero appaia
 * grezzo nell'istante subito dopo.
 *
 * ⚠️ Nessun JavaScript, di proposito. Questa app non ha uno stato "sto
 * ancora caricando" lato client per il boot: le pagine sono Server
 * Component, quindi il contenuto reale è GIÀ nell'HTML arrivato dal server
 * nello stesso payload — non c'è nulla da aspettare, solo un istante da
 * coprire perché l'assestamento visivo (font, immagini, il resto del
 * layout) non si veda grezzo. Un'animazione CSS pura non può quindi
 * "sbagliare" aspettando un evento che non arriverebbe mai.
 *
 * ⚠️ `aria-hidden`: è un velo decorativo che sparisce da solo in meno di un
 * secondo, non un contenuto che uno screen reader deve annunciare — e senza
 * questo verrebbe letto PRIMA della pagina vera a ogni apertura.
 *
 * ⚠️ `pointer-events: none` STATICO, non animato: la prima versione lo
 * otteneva animando `visibility` nel keyframe, mai collaudato su WebKit
 * vero. Qui il velo semplicemente non intercetta mai i tocchi — a opacità
 * piena non c'è comunque nulla sotto da vedere per poterlo toccare
 * consapevolmente, e la finestra di sovrapposizione è sotto il secondo.
 *
 * ⚠️ `z-70`, sopra il velo di blocco PIN (`AppLockScreen`, z-60): su un
 * dispositivo con blocco attivo la sequenza è splash → (una volta svanito)
 * schermata di sblocco, mai il contrario.
 *
 * Badge e aloni sono gli STESSI di `AppLockScreen` (stesso Sprout, stessa
 * pastiglia di vetro, stessi `.circle-1`/`.circle-3`): un secondo momento a
 * schermo intero nello stesso linguaggio, non un elemento nuovo da imparare.
 * L'anello che pulsa riusa `zg-ring`, già in uso per l'attesa sull'avatar
 * (`ProfileEditor`) — qui con un solo giro, non a coppia sfalsata: il velo
 * sparisce prima che un secondo anello aggiungerebbe qualcosa.
 */
export default function BootSplash() {
	return (
		<div
			aria-hidden="true"
			className="fixed inset-0 z-70 flex flex-col items-center justify-center overflow-hidden pointer-events-none zg-boot-out"
			style={{ background: "var(--background)" }}
		>
			<div className="circle-1" />
			<div className="circle-3" />

			<div className="relative flex flex-col items-center gap-5.5">
				<div className="relative w-16 h-16 flex items-center justify-center">
					{/* Stessa classe usata da ProfileEditor per l'attesa sull'avatar
					    (`border-2`, non una larghezza frazionaria mai vista altrove
					    nel repo): un colore opaco è immune al bug Firefox dell'issue
					    #81, quindi resta un `border` vero — nessun anello a `box-shadow`. */}
					<span
						className="absolute w-22 h-22 rounded-full border-2 zg-ring"
						style={{ borderColor: "var(--color-midori)" }}
					/>
					<div className="relative w-16 h-16 rounded-3xl ring-border overflow-hidden">
						<div className="absolute inset-0 bg-surface-elevated backdrop-blur-md" />
						<div className="relative w-full h-full flex items-center justify-center">
							<Sprout size={28} className="text-midori" />
						</div>
					</div>
				</div>

				<div className="flex flex-col items-center gap-2">
					<span className="text-[26px] font-semibold text-foreground">Seichi</span>
					<span className="text-[13px] tracking-[0.22em] text-muted">整地</span>
				</div>
			</div>
		</div>
	);
}
