// Le regole di ESLint scattano davvero? (2026-11-07, PR #185)
//
// Un lint verde sul codice dell'app non lo dimostra: l'app non ha violazioni,
// quindi una regola che ha smesso di funzionare tace esattamente come una che
// funziona. Con ESLint 10 il rischio è concreto: eslint-plugin-react, -import
// e -jsx-a11y arrivano con eslint-config-next e dichiarano supporto solo fino a
// ESLint 9 (npm li installa forzando il peer). Sei loro regole vanno in crash
// su ESLint 10 (sono spente; elenco in CLAUDE.md, «Le prime maggiori di
// Dependabot»), e il riconoscimento dei componenti dichiarati via JSDoc
// `@extends React.Component` si spegne in silenzio. Un aggiornamento di quei
// plugin, o del preset di Next, può fare lo stesso a una regola accesa.
//
// Qui si fa lintare un file che NON esiste su disco, scritto apposta con una
// violazione per regola, e si pretende che ogni regola attesa la segnali.
// Uscita 1 se una manca, se compare un errore senza regola, o se una regola va
// in crash; 0 altrimenti — un elenco di soli OK non distingue «passato» da
// «non eseguito».
//
// ⚠️ È una SENTINELLA, non una copertura: le regole accese sono 86, qui ce
// n'è un campione per famiglia, più quelle su cui il progetto si appoggia
// (set-state-in-effect). Una regola fuori dall'elenco può smettere di
// scattare senza che questo script se ne accorga.
//
// Il file è virtuale per tre ragioni: non finisce nel `tsc` del progetto, non
// lo scansiona Tailwind, e `npm run lint` non vede le sue violazioni.

import { ESLint } from "eslint";

// Il percorso decide quale configurazione si applica: deve stare dove sta il
// codice dell'app (un .tsx sotto components/), non esistere. Se un giorno il
// lint diventa «con i tipi» (projectService) o components/ finisce negli
// ignore, il file virtuale va ripensato: lo dice il messaggio d'errore sotto.
const VIRTUAL_PATH = "components/__audit_eslint__.tsx";

// Una violazione per regola. Il componente di classe passa dal rilevamento
// dei componenti del plugin react tramite `extends Component`, NON dal ramo
// JSDoc che ESLint 10 ha spento: quello non lo copre nessuno, e l'app non ha
// componenti di classe.
const SOURCE = `
import { Component, useEffect, useState } from "react";

export class Contatore extends Component<object, { n: number }> {
  aumenta() {
    this.state.n = 1;
  }
  render() {
    return <p>{this.state.n}</p>;
  }
}

export function Lista({ voci, attivo }: { voci: string[]; attivo: boolean }) {
  if (attivo) {
    useState(0);
  }
  const [n] = useState(0);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    console.log(n);
  }, []);
  useEffect(() => {
    setPronto(true);
  }, []);
  const x: any = voci;
  return (
    <div>
      {voci.map((v) => <li>{v}</li>)}
      <img src="/a.png" />
      <p>l'elenco {String(x)} {String(pronto)}</p>
    </div>
  );
}

export default () => null;
`;

const EXPECTED = [
	"react/no-direct-mutation-state",
	"react/jsx-key",
	"react/no-unescaped-entities",
	"react-hooks/rules-of-hooks",
	"react-hooks/exhaustive-deps",
	"react-hooks/set-state-in-effect",
	"jsx-a11y/alt-text",
	"@next/next/no-img-element",
	"import/no-anonymous-default-export",
	"@typescript-eslint/no-explicit-any",
];

const problems = [];
const crashed = new Set();
let messages = null;

// Una regola che va in crash interrompe l'intero lint con un'eccezione, non
// con un messaggio: la si spegne e si riprova, così l'elenco dice TUTTI i
// crash e le altre regole vengono controllate comunque.
for (let attempt = 0; attempt <= EXPECTED.length; attempt++) {
	const off = Object.fromEntries([...crashed].map((r) => [r, "off"]));
	try {
		const eslint = new ESLint({ overrideConfig: { rules: off } });
		const [result] = await eslint.lintText(SOURCE, { filePath: VIRTUAL_PATH });
		messages = result?.messages ?? [];
		break;
	} catch (e) {
		const rule = /Rule: "([^"]+)"/.exec(e.message)?.[1];
		if (!rule || crashed.has(rule)) {
			problems.push(`ESLint è andato in crash: ${e.message.split("\n")[0]}`);
			break;
		}
		crashed.add(rule);
		problems.push(`la regola ${rule} va in crash: ${e.message.split("\n")[0]}`);
	}
}

if (messages) {
	const fired = new Set(messages.map((m) => m.ruleId).filter(Boolean));
	for (const m of messages) {
		if (m.fatal || m.ruleId === null) {
			problems.push(
				`messaggio senza regola alla riga ${m.line}: ${m.message} — ` +
					`se parla di file ignorato o fuori dal progetto, è ${VIRTUAL_PATH} da ripensare, non una regola`,
			);
		}
	}
	for (const rule of EXPECTED) {
		if (!fired.has(rule) && !crashed.has(rule)) {
			problems.push(`la regola ${rule} non ha segnalato la sua violazione`);
		}
	}
} else {
	problems.push("il lint non è arrivato in fondo: nessuna regola controllata");
}

if (problems.length > 0) {
	console.error("❌ Audit delle regole ESLint fallito:");
	for (const p of problems) console.error(`   - ${p}`);
	process.exit(1);
}

console.log(`✅ Audit delle regole ESLint superato: ${EXPECTED.length} regole su ${EXPECTED.length} scattano.`);
