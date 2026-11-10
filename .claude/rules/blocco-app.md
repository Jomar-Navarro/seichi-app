---
paths:
  - "lib/app-lock.ts"
  - "app/**/app-lock-actions.ts"
  - "app/**/impostazioni/blocco/**"
  - "components/features/AppLock*.tsx"
  - "components/UI/PinPad.tsx"
---

# Blocco con PIN e biometrico

Storia: `docs/storia/fase-26a-pin`, `fase-26b-biometrico`, `issue-125-pin`.

1. **Il blocco protegge l'interfaccia, non i dati**: la sessione resta valida,
   non è cifratura, e non sostituisce la riautenticazione delle operazioni
   sensibili. Il modulo lo dice in testa.
2. **Il PIN (6 cifre) sta solo in `localStorage`, in chiaro**: l'hash di sei
   cifre si forza in microsecondi, quindi sarebbe una protezione finta.
3. **Due cookie non segreti** permettono al server di rendere il velo dal primo
   byte:
   - `seichi-lock-enabled` lo scrive SOLO il server (`setAppLockCookie()`): ITP
     tronca a 7 giorni i cookie scritti da `document.cookie`;
   - `seichi-lock-active-until` è la finestra di grazia.
4. **Si decide dall'unione delle due fonti** (`isLockedOnClient()`, con
   `isLockedFor()` condivisa col server), ed è fail-closed: un cookie assente o
   scaduto vuol dire bloccato.
5. **Il velo sta a z-65, dopo i figli**, con `inert` su ciò che copre.
6. **La finestra di grazia si rinnova uscendo dal primo piano, e solo ad app
   sbloccata** (`if (!locked) markActiveNow()`). La durata scelta resta in
   `localStorage`.
7. **Niente PIN sul computer**, cioè senza input touch (`any-pointer: coarse`
   assente): là F12 legge i numeri sotto il velo. Un PIN già impostato si può
   solo togliere.
8. **Il biometrico vive sotto il PIN, mai al suo posto.**
   - `clearPin()` toglie anche il biometrico.
   - `registerBiometric()` ricontrolla che il PIN ci sia prima di scrivere.
   - Nessuna verifica crittografica: la promise risolta con
     `userVerification: "required"` è la prova.
   - Parte con un tocco esplicito, e un rifiuto non conta come PIN errato.
9. **WebAuthn vuole un contesto sicuro**: dalla LAN su HTTP la frase è «richiede
   una connessione sicura», non «non disponibile su questo dispositivo».
10. **Il tastierino**:
    - i tasti funzionano anche da tastiera (`onClick`);
    - i tocchi doppi entro 80 ms si scartano;
    - il click fantasma dell'ultima cifra si assorbe;
    - durante l'errore (900 ms) non accetta niente.
11. **Si collauda con un autenticatore WebAuthn virtuale via CDP**; il Face ID
    vero si prova dal deploy HTTPS.
