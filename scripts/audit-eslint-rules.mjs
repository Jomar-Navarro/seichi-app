// Le regole di ESLint scattano davvero? (2026-11-07, PR #185)
//
// Un lint verde sul codice dell'app non lo dimostra: l'app non ha violazioni,
// quindi una regola che ha smesso di funzionare tace esattamente come una che
// funziona. Con ESLint 10 il rischio è concreto: eslint-plugin-react, -import
// e -jsx-a11y arrivano con eslint-config-next e dichiarano supporto solo fino a
// ESLint 9 (npm li installa forzando il peer). Dieci loro regole vanno in
// crash su ESLint 10 (sono spente), e il riconoscimento dei componenti
// dichiarati via JSDoc `@extends React.Component` si spegne in silenzio. Un
// aggiornamento di quei plugin, o del preset di Next, può fare lo stesso a una
// regola accesa.
//
// Qui si fa lintare un file che NON esiste su disco, scritto apposta con una
// violazione per regola, e si pretende che ogni regola attesa la segnali.
// Uscita 1 se una manca, se compare un errore di parsing, o se una regola va
// in crash; 0 altrimenti — un elenco di soli OK non distingue «passato» da
// «non eseguito».
//
// Il file è virtuale per tre ragioni: non finisce nel `tsc` del progetto, non
// lo scansiona Tailwind, e `npm run lint` non vede le sue violazioni.

import { ESLint } from "eslint";

// Il percorso decide quale configurazione si applica: deve stare dove sta il
// codice dell'app (un .tsx sotto components/), non esistere.
const VIRTUAL_PATH = "components/__audit_eslint__.tsx";

// Una violazione per regola. Coprono le famiglie che eslint-config-next
// accende: react (anche il rilevamento dei componenti di classe, che passa dal
// modulo condiviso dei plugin), react-hooks, jsx-a11y, import, @next e
// typescript-eslint.
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
  useEffect(() => {
    console.log(n);
  }, []);
  const x: any = voci;
  return (
    <div>
      {voci.map((v) => <li>{v}</li>)}
      <img src="/a.png" />
      <p>l'elenco {String(x)}</p>
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
  "jsx-a11y/alt-text",
  "@next/next/no-img-element",
  "import/no-anonymous-default-export",
  "@typescript-eslint/no-explicit-any",
];

const problems = [];
let results;
try {
  results = await new ESLint().lintText(SOURCE, { filePath: VIRTUAL_PATH });
} catch (e) {
  // Una regola che va in crash interrompe l'intero lint con un'eccezione, non
  // con un messaggio.
  console.error(`❌ ESLint è andato in crash: ${e.message}`);
  process.exit(1);
}

const messages = results[0]?.messages ?? [];
const fired = new Set(messages.map((m) => m.ruleId).filter(Boolean));

for (const m of messages) {
  if (m.fatal || m.ruleId === null) {
    problems.push(`errore senza regola (parsing?): riga ${m.line} — ${m.message}`);
  }
}
for (const rule of EXPECTED) {
  if (!fired.has(rule)) problems.push(`la regola ${rule} non ha segnalato la sua violazione`);
}

if (problems.length > 0) {
  console.error("❌ Audit delle regole ESLint fallito:");
  for (const p of problems) console.error(`   - ${p}`);
  process.exit(1);
}

console.log(`✅ Audit delle regole ESLint superato: ${EXPECTED.length} regole su ${EXPECTED.length} scattano.`);
