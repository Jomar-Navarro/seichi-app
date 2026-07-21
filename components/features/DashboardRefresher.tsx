"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/useUIStore";

export default function DashboardRefresher() {
	const router = useRouter();
	const { transactionSavedAt } = useUIStore();
	const lastSeen = useRef(transactionSavedAt);

	useEffect(() => {
		if (transactionSavedAt > lastSeen.current) {
			lastSeen.current = transactionSavedAt;
			router.refresh();
		}
	}, [transactionSavedAt, router]);

	return null;
}
