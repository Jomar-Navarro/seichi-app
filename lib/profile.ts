/** Iniziali mostrate nell'avatar quando non c'è una foto. */
export function getInitials(fullName?: string | null, email?: string | null): string {
	const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);

	if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

	const local = (email ?? "").split("@")[0];
	return local ? local.slice(0, 2).toUpperCase() : "··";
}

/** Nome da mostrare: il nome completo se c'è, altrimenti la parte locale dell'email. */
export function getDisplayName(fullName?: string | null, email?: string | null): string {
	const name = (fullName ?? "").trim();
	if (name) return name;
	return (email ?? "").split("@")[0] || "Account";
}
