"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function login(_prevState: { error: string }, formData: FormData) {
	const supabase = await createClient();

	const data = {
		email: formData.get("email") as string,
		password: formData.get("password") as string,
	};

	const { error } = await supabase.auth.signInWithPassword(data);

	if (error) {
		return { error: "Credenziali di login errate" };
	}

	revalidatePath("/", "layout");
	redirect("/");
}

export async function signup(_prevState: { error: string }, formData: FormData) {
	const supabase = await createClient();

	const email = formData.get("email") as string;
	const password = formData.get("password") as string;
	const confirmPassword = formData.get("confirm-password") as string;
	const privacy = formData.get("privacy");

	if (!privacy) {
		return { error: "Devi accettare i termini di servizio" };
	}

	if (password.length < 5) {
		return { error: "La password deve essere di almeno 5 caratteri" };
	}

	if (password !== confirmPassword) {
		return { error: "Le password non corrispondono" };
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
		return { error: error.message };
	}

	revalidatePath("/", "layout");
	redirect("/");
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
