import { listTestUsers, deleteUser } from "./accounts";

/**
 * Alla fine del giro: nessun account di prova resta nel database (#156,
 * criterio 4). Ogni test elimina il proprio; questo raccoglie quelli di un test
 * interrotto a metà — un timeout, un Ctrl+C — e lo DICE, perché un account
 * rimasto vuol dire che una pulizia non è avvenuta dove doveva.
 */
export default async function globalTeardown() {
	const left = await listTestUsers();
	for (const u of left) await deleteUser(u.id);
	const after = await listTestUsers();
	if (left.length) console.log(`account di prova rimasti da test interrotti: ${left.length}, eliminati ora`);
	if (after.length) throw new Error(`${after.length} account di prova non si lasciano eliminare`);
}
