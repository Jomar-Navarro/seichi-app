# #220 — la descrizione si ferma a 255 caratteri

> Storia del progetto. Le regole che ne discendono stanno in `CLAUDE.md` e in `.claude/rules/`; qui c'è il perché.
> Date e stati («da fare», «non ancora», «oggi») sono quelli del giorno in cui furono scritti: la verità di adesso è nel codice e nelle regole.

### Da dove arriva (2026-11-22)

Trovata lavorando alla #173, cercando come far fallire una regola per il
collaudo. Il campo descrizione non aveva limite, e le due tabelle non erano
d'accordo:

- `transactions.notes` è `varchar(255)`;
- `recurring_rules.notes` era `text`;
- nessuna action controllava la lunghezza.

Una ricorrenza con una descrizione di 300 caratteri si salvava, e il movimento
generato veniva rifiutato (`22001`): la regola era saltata subito e poi ogni
notte. Un movimento normale falliva con «Qualcosa è andato storto», senza dire
perché. È la lezione 7 di `CLAUDE.md`: un'invariante fra due tabelle difesa da
un lato solo. In produzione nessuna regola superava il limite (la più lunga ne
aveva 15 caratteri): il buco era aperto, non ancora usato.

### Le decisioni

- **Il campo si ferma a 255 e lo dice** (deciso con Jomar): un contatore
  «230/255» compare da 200 caratteri, in `TransactionForm` e in
  `RecurringSheet`, con un solo componente (`NotesCounter`) e un solo modulo
  (`lib/notes.ts`). Senza contatore, un incolla più lungo verrebbe tagliato
  senza che nessuno se ne accorga.
- ⚠️ **Si conta come Postgres, per code point, non con `.length` né con
  `maxLength`.** `char_length` e `varchar(n)` contano i caratteri; `.length` e
  l'attributo `maxLength` contano le unità UTF-16, e un'emoji fuori dal piano
  base vale 2. Con `maxLength` il contatore avrebbe detto «250/255» mentre il
  campo smetteva di accettare testo; con `.length` l'action avrebbe rifiutato
  note che la colonna accetta. Il campo taglia con `clampNotes`, per code point,
  quindi non spezza mai un'emoji a metà (un surrogato orfano non è UTF-8
  valido).
- **Le action ripetono il controllo** (`isStorableNotes`) con una frase del
  dizionario: `saveTransaction`, `updateTransaction`, `createRecurringRule`,
  `updateRecurringRule`. L'import non ne aveva bisogno: `import_transactions()`
  tronca già con `left(notes, 255)`, che conta allo stesso modo.
- **CHECK `char_length(notes) <= 255` su `recurring_rules`** (migration
  `20261123`), non un cambio di tipo: lo stesso limite, senza riscrivere la
  tabella, nella forma dei vincoli fratelli. Conteggio e stop prima di
  scrivere.
- **Ordine di rilascio: il codice prima, poi la migration.** Il codice nuovo
  regge con o senza il vincolo; il vincolo senza il codice darebbe un errore
  generico invece della frase. In pratica l'ordine è una cortesia.
- **Lo scenario e2e della #173 passa a un trigger di prova** (deciso con
  Jomar). Usava la nota lunga come guasto vero; ora l'app non sa più produrre
  una regola che fallisce, ed è proprio per questo che va iniettata. Il trigger
  rifiuta solo i movimenti con la nota-marcatore di quello scenario, lo crea il
  test con `docker exec` nel database locale (`tests/e2e/support/db.ts`) e lo
  toglie in un `finally`.

### Il collaudo

- **Vitest** (`lib/notes.test.ts`): emoji, limite esatto, taglio. Mutazioni:
  `notesLength` con `.length` fa cadere i due test delle emoji, e anche quello
  del taglio, che misura il risultato con la stessa funzione; `clampNotes` con
  `s.slice` fa cadere solo «non spezza un'emoji».
- **pgTAP** (`note-lunghe.test.sql`, 8 prove): 255 sì e 256 no, in lettere e in
  emoji, all'insert, all'update e dall'API; e una regola dovuta con 255 emoji
  che genera il suo movimento. Mutazioni: senza il vincolo cadono a2, b2, c1 e
  c2; con `octet_length` al posto di `char_length` cade b1, e l'insert grezzo
  della prova g fa saltare il resto del file.
- **e2e** (`tests/e2e/note.spec.ts`): il contatore da 200, il campo che si
  ferma a 255, il movimento salvato; una POST della server action alterata in
  volo con una nota da 300 caratteri, fermata dall'action con la sua frase; gli
  insert diretti fermati dal database. Controprove, dichiarate nel file:
  - il campo senza `clampNotes` fa cadere il primo scenario (300 caratteri
    invece di 255);
  - la action senza `isStorableNotes` fa cadere il secondo sulla frase, perché
    il database rifiuta lo stesso ma l'utente legge «Si è verificato un
    errore»;
  - senza il CHECK nel database locale il secondo cade sull'insert della
    regola, che passa;
  - lo scenario della #173 senza il trigger di prova cade sull'avviso, e il suo
    gemello resta verde.
  Suite intera: 26 scenari su 26.

### Dalla review del ramo principale (2026-11-22)

- ⚠️ **`clampNotes` nel campo tagliava la FINE.** Con la nota già a 255
  caratteri, una parola scritta o incollata in mezzo spingeva fuori le ultime,
  che sparivano senza avviso: il contatore restava a «255/255» e nient'altro lo
  diceva. `maxLength` rifiuta ciò che non entra e lascia stare il resto, ed è
  il comportamento atteso da un campo. Ora il campo passa da
  `limitNotesInput(prima, dopo)`: confronta i due valori, trova la parte
  appena inserita (prefisso e suffisso comuni sono il testo che c'era) e tiene
  di quella solo ciò che entra, sempre per code point. `clampNotes` resta per
  i casi senza un «prima».
- Controprova dichiarata: con `limitNotesInput` ridotta a `clampNotes(next)`
  cadono «una parola scritta in mezzo» e «un incolla in mezzo», e nessun'altra
  (la sostituzione in fondo e l'emoji danno lo stesso risultato con le due).
