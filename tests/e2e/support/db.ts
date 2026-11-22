import { execFileSync } from "node:child_process";
import { localSupabase } from "./env";

/**
 * SQL da superutente sul database LOCALE dei test, per i pochi scenari che
 * devono preparare un guasto che l'app non sa più produrre (#220: il trigger di
 * prova della #173).
 *
 * Passa da `docker exec` nel container del Supabase locale (`project_id` di
 * `supabase/config.toml`): per costruzione non raggiunge altro che questa
 * macchina. `localSupabase()` in testa ripete comunque la difesa di
 * `assertLocal()`, come ogni chiamata dei test al database (test.md, regola 1).
 *
 * ⚠️ Il database è condiviso da tutti i worker: ciò che si crea qui deve
 * toccare solo i dati del test che lo crea, e va tolto in un `finally`.
 */
const CONTAINER = "supabase_db_seichi-app";

export function localSql(sql: string) {
	localSupabase();
	execFileSync("docker", ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q"], {
		input: sql,
		stdio: ["pipe", "pipe", "pipe"],
	});
}
