"use client";

import { Eye, EyeOff, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/features/I18nProvider";
import {
	DISPLAY_CURRENCY,
	currencySymbol,
	plural,
	splitAmount,
} from "@/lib/i18n/format";
import type { AccountWithBalance } from "@/types";

interface AccountsBalanceCardProps {
	accounts: AccountWithBalance[];
	/** null = tutti i conti attivi. */
	selectedId: string | null;
	hidden: boolean;
	onToggleHidden: () => void;
}

/**
 * La giacenza: la seconda pagina del carosello della home.
 *
 * ⚠️ È **lo stesso numero della pagina conti**, dalla stessa vista
 * `account_balances`. Non è il vecchio `saldoTotale`, che la 20a ha cancellato
 * perché ne dava uno *diverso* — sottraeva i risparmi e ignorava
 * `initial_balance`. Vedi `HomeHero` per il ragionamento completo.
 *
 * ⚠️ Si chiama "Saldo", mai "Saldo totale", e la pastiglia dice quanti conti
 * sono stati sommati. Gli archiviati restano fuori, quindi "totale" sarebbe
 * falso in cifre grandi con la smentita in piccolo accanto — il difetto già
 * respinto per la pagina conti e per "spese totali" nella 17a. Il mockup
 * scriveva "Saldo totale": qui si diverge apposta.
 */
export default function AccountsBalanceCard({
	accounts,
	selectedId,
	hidden,
	onToggleHidden,
}: AccountsBalanceCardProps) {
	const { locale, t } = useI18n();

	const active = accounts.filter((a) => !a.archived);
	/*
	 * Il conto selezionato si cerca fra TUTTI, non fra gli attivi: se è appena
	 * stato archiviato mentre lo si guardava, la card deve continuare a parlare
	 * di lui — la pagina resta filtrata su quel conto. Stessa ragione del chip
	 * nel selettore.
	 */
	const selected = accounts.find((a) => a.id === selectedId) ?? null;

	/*
	 * ⚠️ Con un conto selezionato la card mostra il saldo di QUEL conto, non il
	 * totale. Le due card del carosello devono parlare dello stesso insieme: un
	 * flusso filtrato accanto a una giacenza globale sarebbe due scope
	 * affiancati, cioè il difetto già corretto su "Risparmi · N%".
	 */
	const amount = selected
		? selected.balance
		: active.reduce((sum, a) => sum + a.balance, 0);

	const badge = selected
		? selected.name
		: plural(t.accounts.activeCount, active.length, locale);

	const explain = selected
		? t.accounts.balanceExplainOne
		: t.accounts.balanceExplainAll;

	const { sign, integer, decimal } = splitAmount(amount, locale);

	return (
		/*
			⚠️ TRE livelli — issue #81. `overflow-hidden` da solo non basta
			(verificato da Firefox). Guscio (arrotonda, ritaglia) → vetro
			(sfoca) → contenuto (`h-full flex flex-col p-5`, portato qui perché
			il guscio non deve avere padding: lo spazio va al contenuto).

			Da `lg:` le misure del mockup desktop (issue #108): raggio 28, padding
			26/28/24, ombra più ampia (`box-shadow-ring`, stessa famiglia di
			anello). ⚠️ La cifra è 42px a `lg:` e 52px — quella del mockup — solo
			da `xl:`: a 1024px la colonna del saldo è larga ~300px utili, e un
			saldo a cinque cifre a 52px non ci sta.
		*/
		<div className="relative h-full rounded-3xl card-shadow-ring overflow-hidden lg:rounded-[28px] lg:box-shadow-ring">
			<div className="absolute inset-0 bg-surface backdrop-blur-md" />
			<div className="relative h-full flex flex-col p-5 lg:pt-6.5 lg:px-7 lg:pb-6">
			<div className="flex items-center justify-between gap-2 mb-3 lg:mb-4.5">
				<div className="flex items-center gap-2 min-w-0">
					<p className="text-sm text-muted shrink-0 lg:text-[12.5px] lg:tracking-[0.4px]">{t.accounts.balanceHeading}</p>
					{/*
						La pastiglia qui è un'ETICHETTA, non un comando: dice cosa è stato
						sommato. Sul flusso il mockup ne mette una uguale ma interattiva
						(selettore di periodo), che non abbiamo reso proprio per non avere
						un comando inerte — vedi FlowCard.
					*/}
					<span className="px-2.5 py-1 rounded-full text-[11px] font-medium text-secondary bg-input ring-border truncate lg:bg-control">
						{badge}
					</span>
				</div>
				<button
					onClick={onToggleHidden}
					// issue #69 — w-11 h-11 (44px): unico elemento a fine riga,
					// l'icona resta 15px.
					className="w-11 h-11 -my-2 -mr-2 flex items-center justify-center rounded-lg text-muted shrink-0"
					aria-label={t.common.toggleVisibility}
				>
					{hidden ? <EyeOff size={15} /> : <Eye size={15} />}
				</button>
			</div>

			{/*
				⚠️ Colore NEUTRO, non verde né rosso, e la differenza col flusso è
				semantica: un flusso è positivo o negativo — hai guadagnato o speso —
				mentre una giacenza semplicemente È. Colorarla di verde suggerirebbe
				che 800 € siano "buoni" e che un conto in rosso sia un fallimento,
				affermazioni che la card non ha titolo per fare. Il mockup usa
				`#33373D`, cioè `--color-yoru` = `text-foreground`.
			*/}
			<p className="font-semibold tracking-tight mb-1.5 flex items-baseline gap-0.5 text-foreground lg:tracking-[-1.4px] lg:leading-none lg:mb-2.5">
				{/* Da `lg:` il simbolo ha la stessa misura della cifra, come nel mockup. */}
				<span className="text-2xl font-semibold mr-1 lg:mr-2 lg:text-[42px] xl:text-[52px]">
					{currencySymbol(DISPLAY_CURRENCY, locale)}
				</span>
				{hidden ? (
					<span className="text-4xl lg:text-[42px] xl:text-[52px]">••••••</span>
				) : (
					<>
						<span className="text-4xl lg:text-[42px] xl:text-[52px]">{sign}{integer}</span>
						<span className="text-2xl font-medium text-muted lg:tracking-[-0.4px] xl:text-[30px]">{decimal}</span>
					</>
				)}
			</p>

			{/*
				Da `lg:` la spiegazione sta SUBITO sotto la cifra e il collegamento
				scende in fondo (`lg:mt-auto` sul link invece che qui), come nel
				mockup: affiancata al flusso la card viene stirata all'altezza della
				riga, e lo spazio in più va sopra il divisore, non fra cifra e
				didascalia.
			*/}
			<p className="mt-auto text-[11.5px] leading-relaxed text-disabled mb-3 lg:mt-0 lg:mb-5 lg:text-xs lg:leading-[1.55]">{explain}</p>

			<Link
				href="/conti"
				className="flex items-center gap-1.5 pt-2.5 border-t border-subtle text-xs font-semibold text-ao-ink lg:mt-auto lg:pt-5 lg:text-[12.5px]"
			>
				{t.accounts.seeDetail}
				<ArrowRight size={13} />
			</Link>
			</div>
		</div>
	);
}
