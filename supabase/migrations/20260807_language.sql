-- ============================================================================
-- Fase 19 — Lingua: normalizzazione di profiles.language
-- ============================================================================
-- Esegui questo file nel SQL Editor di Supabase (una volta sola).
-- È idempotente: puoi rieseguirlo senza rompere nulla.
--
-- PERCHÉ ESISTE
--   L'onboarding ha sempre scritto in profiles.language il valore grezzo della
--   select — "IT" / "EN" MAIUSCOLI — mentre la pagina impostazioni leggeva
--   "it" / "en" minuscoli e ripiegava sul default quando il confronto falliva.
--   Chi sceglieva English alla registrazione si ritrovava "Italiano" nelle
--   impostazioni, senza alcun messaggio.
--
--   Finora era invisibile perché nessuno consumava quel campo: la preferenza era
--   salvata ma inattiva (vedi CLAUDE.md → Implementation Order, Fase 19). Dal
--   momento in cui l'i18n si accende, quella stessa riga significa l'INTERA
--   applicazione nella lingua sbagliata.
--
-- ⚠️ Il vincolo qui sotto è deliberatamente permissivo su NULL: la riga di
--    profiles nasce da un trigger al momento della registrazione, quando la
--    lingua non è ancora stata scelta. NULL significa "non ancora deciso" e
--    l'app ripiega su Accept-Language, che è un'informazione migliore di un
--    italiano d'ufficio. Vietare NULL romperebbe la registrazione.
-- ============================================================================

-- 1. Ripulisce lo storico -----------------------------------------------------
--    lower() copre "IT"/"EN"; split_part sul trattino copre eventuali tag
--    regionali ("en-GB" → "en") se qualcuno li avesse scritti a mano.
update profiles
set language = split_part(lower(language), '-', 1)
where language is not null
  and language <> split_part(lower(language), '-', 1);

-- 2. Azzera ciò che non sappiamo tradurre -------------------------------------
--    Una lingua che l'app non parla non è meglio di nessuna lingua: con NULL
--    si ricade su Accept-Language invece di forzare l'italiano.
update profiles
set language = null
where language is not null
  and language not in ('it', 'en');

-- 3. Impedisce che il difetto si ripresenti ------------------------------------
--    La normalizzazione vive già nelle server action (normalizeLocale), ma
--    quello è codice applicativo: un insert dal SQL Editor o un client futuro
--    lo scavalcherebbero. Questo vincolo no.
--
--    ⚠️ Da tenere allineato con LOCALES in lib/i18n/config.ts. Sono due punti,
--    come la soglia dell'80% dei budget fra SQL e TypeScript (Fase 17b): non
--    eliminabile senza generazione di codice, quindi almeno dichiarato.
alter table profiles drop constraint if exists profiles_language_check;
alter table profiles add constraint profiles_language_check
  check (language is null or language in ('it', 'en'));
