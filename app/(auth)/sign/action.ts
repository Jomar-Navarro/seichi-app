"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function login(prevState: { error: string }, formData: FormData) {
	const supabase = await createClient();

	// type-casting here for convenience
	// in practice, you should validate your inputs
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

export async function signup(prevState: { error: string }, formData: FormData) {
	const supabase = await createClient();

	// type-casting here for convenience
	// in practice, you should validate your inputs
	const data = {
		email: formData.get("email") as string,
		password: formData.get("password") as string,
		options: {
			data: {
				name: formData.get("name") as string,
				surname: formData.get("surname") as string,
			},
		},
	};

	const { error } = await supabase.auth.signUp(data);

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
			redirectTo: "http://localhost:3000/callback",
		},
	});
	if (data.url) {
		redirect(data.url); // use the redirect API for your server framework
	}
}
