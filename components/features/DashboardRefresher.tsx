"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/useUIStore";

export default function DashboardRefresher() {
	const router = useRouter();
	const { transactionSavedAt } = useUIStore();

	useEffect(() => {
		if (transactionSavedAt) router.refresh();
	}, [transactionSavedAt, router]);

	return null;
}
