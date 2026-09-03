"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import Avatar from "@/components/UI/Avatar";
import SettingsRow, { SettingsGroup } from "@/components/UI/SettingsRow";
import SubmitButton from "@/components/UI/SubmitButton";
import { removeAvatar, updateFullName, uploadAvatar } from "@/app/(main)/impostazioni/account/actions";
import { useI18n } from "@/components/features/I18nProvider";
import { fill } from "@/lib/i18n/format";

const ACCEPTED = "image/jpeg,image/png,image/webp";
const AKA = "var(--color-aka)";
// Allineato ad AVATAR_MAX_BYTES nella server action e al file_size_limit del
// bucket. Il controllo qui evita un upload inutile, ma quello che conta è
// quello sul server: questo è aggirabile.
const MAX_BYTES = 2 * 1024 * 1024;
/** I testi che citano il limite lo prendono da qui, invece di scriverlo a mano. */
const MAX_MB = MAX_BYTES / 1024 / 1024;

interface ProfileEditorProps {
	fullName: string | null;
	avatarUrl: string | null;
	initials: string;
	email: string;
}

export default function ProfileEditor({ fullName, avatarUrl, initials, email }: ProfileEditorProps) {
	const router = useRouter();
	const { t } = useI18n();
	const fileInput = useRef<HTMLInputElement>(null);

	const [name, setName] = useState(fullName ?? "");
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [uploading, startUpload] = useTransition();
	const [savingName, startSaveName] = useTransition();

	function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		// Reset immediato: senza questo, riselezionare lo stesso file non
		// rilancia l'evento change.
		event.target.value = "";
		if (!file) return;

		setError(null);

		if (file.size > MAX_BYTES) {
			setError(fill(t.account.profile.imageTooLarge, { max: MAX_MB }));
			return;
		}

		startUpload(async () => {
			// try/catch e non solo il risultato: una server action può anche
			// RIGETTARE (body oltre il limite, rete caduta, deploy in corso). Senza,
			// la promise rifiutata resterebbe non gestita e l'utente vedrebbe solo
			// lo spinner fermarsi, senza sapere che l'upload è fallito.
			try {
				const formData = new FormData();
				formData.append("avatar", file);
				const result = await uploadAvatar(formData);
				if ("error" in result) setError(result.error);
				else router.refresh();
			} catch {
				setError(t.account.profile.uploadFailed);
			}
		});
	}

	function handleRemove() {
		setError(null);
		startUpload(async () => {
			try {
				const result = await removeAvatar();
				if ("error" in result) setError(result.error);
				else router.refresh();
			} catch {
				setError(t.account.profile.removeFailed);
			}
		});
	}

	function handleSaveName() {
		setError(null);
		setSaved(false);
		startSaveName(async () => {
			try {
				const result = await updateFullName(name);
				if ("error" in result) setError(result.error);
				else {
					setSaved(true);
					router.refresh();
				}
			} catch {
				setError(t.account.profile.saveFailed);
			}
		});
	}

	return (
		<>
			{/* Avatar */}
			<div className="flex flex-col items-center gap-4 mb-8">
				<div className="relative w-24 h-24 flex items-center justify-center">
					{uploading && (
						<>
							<span
								className="absolute inset-0 rounded-full border-2 zg-ring"
								style={{ borderColor: "var(--color-murasaki)" }}
							/>
							<span
								className="absolute inset-0 rounded-full border-2 zg-ring"
								style={{ borderColor: "var(--color-murasaki)", animationDelay: "0.6s" }}
							/>
						</>
					)}
					<Avatar src={avatarUrl} initials={initials} size={76} />
				</div>
				<p className="text-[13px] text-muted">
					{uploading ? t.account.profile.uploading : email}
				</p>
			</div>

			<input
				ref={fileInput}
				type="file"
				accept={ACCEPTED}
				onChange={handleFile}
				className="hidden"
			/>

			<SettingsGroup label={t.settings.profilePhoto}>
				<SettingsRow
					icon={<Camera size={17} className="text-secondary" />}
					label={avatarUrl ? t.account.profile.replacePhoto : t.account.profile.uploadPhoto}
					subtitle={fill(t.account.profile.photoHint, { max: MAX_MB })}
					onClick={() => fileInput.current?.click()}
					disabled={uploading}
				/>
				{avatarUrl && (
					<SettingsRow
						icon={<Trash2 size={17} style={{ color: AKA }} />}
						label={t.account.profile.removePhoto}
						tone={AKA}
						onClick={handleRemove}
						disabled={uploading}
					/>
				)}
			</SettingsGroup>

			{/* Nome */}
			<p className="text-[11.5px] font-semibold tracking-[1.6px] uppercase text-disabled mb-2.5 ml-0.5">
				{t.account.profile.nameSection}
			</p>
			<input
				type="text"
				value={name}
				maxLength={80}
				placeholder={t.account.profile.namePlaceholder}
				onChange={(e) => {
					setName(e.target.value);
					setSaved(false);
				}}
				className="w-full rounded-[18px] px-4 py-3.5 text-base bg-input ring-border outline-none placeholder:text-muted/60 mb-4"
			/>

			{error && (
				<p className="text-xs text-center mb-3" style={{ color: AKA }}>
					{error}
				</p>
			)}
			{saved && !error && (
				<p className="text-xs text-center mb-3" style={{ color: "var(--ink-midori)" }}>
					{t.account.profile.nameUpdated}
				</p>
			)}

			<SubmitButton
				label={t.common.save}
				pendingLabel={t.common.saving}
				pending={savingName}
				disabled={name.trim() === (fullName ?? "").trim()}
				onClick={handleSaveName}
			/>
		</>
	);
}
