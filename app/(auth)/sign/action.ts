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

	const { error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			data: {
				name: formData.get("name") as string,
				surname: formData.get("surname") as string,
			},
		},
	});

	if (error) {
		return { error: error.message, emailSent: false, email: "" };
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
