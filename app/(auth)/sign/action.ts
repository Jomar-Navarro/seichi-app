"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function login(_prevState: { error: string }, formData: FormData) {
	const supabase = await createClient();

	const data = {
		email: formData.get("email") as string,
		password: formData.get("password") as string,
	};

	const { data: { user }, error } = await supabase.auth.signInWithPassword(data);

	if (error) {
		return { error: "Credenziali di login errate" };
	}

	if (user) {
		const { data: profile } = await supabase
			.from("profiles")
			.select("currency")
			.eq("id", user.id)
			.single();
		if (!profile?.currency) {
			redirect("/start");
		}
	}

	redirect("/");
}

export async function signup(
	_prevState: { error: string; emailSent: boolean; email: string },
	formData: FormData,
) {
	const supabase = await createClient();

	const email = formData.get("email") as string;
	const password = formData.get("password") as string;
	const confirmPassword = formData.get("confirm-password") as string;
	const privacy = formData.get("privacy");

	if (!privacy) {
		return { error: "Devi accettare i termini di servizio", emailSent: false, email: "" };
	}

	if (password.length < 8) {
		return { error: "La password deve essere di almeno 8 caratteri", emailSent: false, email: "" };
	}

	if (password !== confirmPassword) {
		return { error: "Le password non corrispondono", emailSent: false, email: "" };
	}

	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			// Senza questo il link di conferma atterra sul Site URL, cioè "/", che
			// non scambia il `code`: l'utente finisce su /welcome senza sessione,
			// come se la conferma non fosse servita a niente. /callback lo scambia
			// e poi instrada a /start perché profiles.currency è ancora NULL.
			emailRedirectTo: `${siteUrl}/callback`,
			data: {
				name: formData.get("name") as string,
				surname: formData.get("surname") as string,
			},
		},
	});

	if (error) {
		return { error: error.message, emailSent: false, email: "" };
	}

	// Con la conferma email DISATTIVATA su Supabase, signUp restituisce già una
	// sessione: l'utente è loggato. Mostrargli "controlla la tua email" lo
	// lascerebbe fermo davanti a un messaggio per una mail che non arriverà mai.
	// Con la conferma attiva `session` è null e si passa al ramo successivo.
	if (data.session) {
		redirect("/start");
	}

	return { error: "", emailSent: true, email };
}

export async function signInWithGoogle() {
	const supabase = await createClient();

	const { data } = await supabase.auth.signInWithOAuth({
		provider: "google",
		options: {
			queryParams: {
				access_type: "offline",
				prompt: "consent",
			},
			redirectTo: `${siteUrl}/callback`,
		},
	});
	if (data.url) {
		redirect(data.url);
	}
}

export async function signInWithFacebook() {
	const supabase = await createClient();

	const { data } = await supabase.auth.signInWithOAuth({
		provider: "facebook",
		options: {
			redirectTo: `${siteUrl}/callback`,
		},
	});
	if (data.url) {
		redirect(data.url);
	}
}
