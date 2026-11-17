/**
 * ⚠️ GENERATO da `npm run db:types` — non modificare a mano (#157).
 *
 * Lo schema `public` del Supabase locale, ricostruito dalle migration. Dopo
 * una migration: `npx supabase migration up` e `npm run db:types`. (Uno
 * stack fermato col backup riparte dal backup, SENZA le migration nuove.)
 * La CI lo rigenera e fallisce se questo file non coincide.
 *
 * ⚠️ Il generatore non sa tutto: i CHECK che restringono un testo, gli
 * argomenti di una funzione che possono essere NULL, le colonne di un
 * `RETURNS TABLE` che possono esserlo. Quelle stanno in
 * `types/database-app.ts`, ed è `AppDatabase` il tipo dei client.
 */

export type Json = string | number | boolean | null | {
	[key: string]: Json | undefined;
} | Json[];
export type Database = {
	"public": {
		Tables: {
			"accounts": {
				Row: {
					"archived": boolean;
					"color": string | null;
					"created_at": string;
					"icon": string | null;
					"id": string;
					"initial_balance": number;
					"name": string;
					"type": string | null;
					"user_id": string;
				};
				ComputedFields: never;
				Insert: {
					"archived"?: boolean;
					"color"?: string | null;
					"created_at"?: string;
					"icon"?: string | null;
					"id"?: string;
					"initial_balance"?: number;
					"name": string;
					"type"?: string | null;
					"user_id": string;
				};
				Update: {
					"archived"?: boolean;
					"color"?: string | null;
					"created_at"?: string;
					"icon"?: string | null;
					"id"?: string;
					"initial_balance"?: number;
					"name"?: string;
					"type"?: string | null;
					"user_id"?: string;
				};
				Relationships: [
				];
			};
			"attachments": {
				Row: {
					"created_at": string;
					"id": string;
					"mime_type": string;
					"size_bytes": number;
					"storage_path": string;
					"transaction_id": string;
					"user_id": string;
				};
				ComputedFields: never;
				Insert: {
					"created_at"?: string;
					"id"?: string;
					"mime_type": string;
					"size_bytes": number;
					"storage_path": string;
					"transaction_id": string;
					"user_id": string;
				};
				Update: {
					"created_at"?: string;
					"id"?: string;
					"mime_type"?: string;
					"size_bytes"?: number;
					"storage_path"?: string;
					"transaction_id"?: string;
					"user_id"?: string;
				};
				Relationships: [
					{
						foreignKeyName: "attachments_transaction_owner_fkey";
						columns: [
							"transaction_id",
							"user_id"
						];
						isOneToOne: false;
						referencedRelation: "transactions";
						referencedColumns: [
							"id",
							"user_id"
						];
					}
				];
			};
			"budgets": {
				Row: {
					"amount": number | null;
					"category_id": string | null;
					"created_at": string;
					"id": string;
					"period": string;
					"user_id": string;
					"valid_from": string;
				};
				ComputedFields: never;
				Insert: {
					"amount"?: number | null;
					"category_id"?: string | null;
					"created_at"?: string;
					"id"?: string;
					"period": string;
					"user_id": string;
					"valid_from": string;
				};
				Update: {
					"amount"?: number | null;
					"category_id"?: string | null;
					"created_at"?: string;
					"id"?: string;
					"period"?: string;
					"user_id"?: string;
					"valid_from"?: string;
				};
				Relationships: [
					{
						foreignKeyName: "budgets_category_owner_fkey";
						columns: [
							"category_id",
							"user_id"
						];
						isOneToOne: false;
						referencedRelation: "categories";
						referencedColumns: [
							"id",
							"user_id"
						];
					}
				];
			};
			"categories": {
				Row: {
					"color": string;
					"created_at": string;
					"icon": string;
					"id": string;
					"name": string;
					"target_amount": number | null;
					"target_date": string | null;
					"type": string;
					"user_id": string;
				};
				ComputedFields: never;
				Insert: {
					"color": string;
					"created_at"?: string;
					"icon": string;
					"id"?: string;
					"name": string;
					"target_amount"?: number | null;
					"target_date"?: string | null;
					"type": string;
					"user_id": string;
				};
				Update: {
					"color"?: string;
					"created_at"?: string;
					"icon"?: string;
					"id"?: string;
					"name"?: string;
					"target_amount"?: number | null;
					"target_date"?: string | null;
					"type"?: string;
					"user_id"?: string;
				};
				Relationships: [
				];
			};
			"imports": {
				Row: {
					"account_id": string;
					"created_at": string;
					"filename": string;
					"id": string;
					"source": string;
					"user_id": string;
				};
				ComputedFields: never;
				Insert: {
					"account_id": string;
					"created_at"?: string;
					"filename": string;
					"id"?: string;
					"source": string;
					"user_id": string;
				};
				Update: {
					"account_id"?: string;
					"created_at"?: string;
					"filename"?: string;
					"id"?: string;
					"source"?: string;
					"user_id"?: string;
				};
				Relationships: [
					{
						foreignKeyName: "imports_account_owner_fkey";
						columns: [
							"account_id",
							"user_id"
						];
						isOneToOne: false;
						referencedRelation: "account_balances";
						referencedColumns: [
							"id",
							"user_id"
						];
					},
					{
						foreignKeyName: "imports_account_owner_fkey";
						columns: [
							"account_id",
							"user_id"
						];
						isOneToOne: false;
						referencedRelation: "accounts";
						referencedColumns: [
							"id",
							"user_id"
						];
					}
				];
			};
			"job_runs": {
				Row: {
					"details": string | null;
					"id": number;
					"job_name": string;
					"logged_at": string;
					"run_at": string;
					"status": string;
					"step": string;
				};
				ComputedFields: never;
				Insert: {
					"details"?: string | null;
					"id"?: never;
					"job_name": string;
					"logged_at"?: string;
					"run_at": string;
					"status": string;
					"step": string;
				};
				Update: {
					"details"?: string | null;
					"id"?: never;
					"job_name"?: string;
					"logged_at"?: string;
					"run_at"?: string;
					"status"?: string;
					"step"?: string;
				};
				Relationships: [
				];
			};
			"notifications": {
				Row: {
					"created_at": string;
					"dedup_key": string;
					"destination": string;
					"id": string;
					"payload": NonNullable<Json>;
					"read": boolean;
					"type": string;
					"user_id": string;
				};
				ComputedFields: never;
				Insert: {
					"created_at"?: string;
					"dedup_key": string;
					"destination": string;
					"id"?: string;
					"payload"?: NonNullable<Json>;
					"read"?: boolean;
					"type": string;
					"user_id": string;
				};
				Update: {
					"created_at"?: string;
					"dedup_key"?: string;
					"destination"?: string;
					"id"?: string;
					"payload"?: NonNullable<Json>;
					"read"?: boolean;
					"type"?: string;
					"user_id"?: string;
				};
				Relationships: [
				];
			};
			"profiles": {
				Row: {
					"avatar_url": string | null;
					"created_at": string | null;
					"currency": string | null;
					"full_name": string | null;
					"id": string;
					"language": string | null;
					"theme": string | null;
				};
				ComputedFields: never;
				Insert: {
					"avatar_url"?: string | null;
					"created_at"?: string | null;
					"currency"?: string | null;
					"full_name"?: string | null;
					"id": string;
					"language"?: string | null;
					"theme"?: string | null;
				};
				Update: {
					"avatar_url"?: string | null;
					"created_at"?: string | null;
					"currency"?: string | null;
					"full_name"?: string | null;
					"id"?: string;
					"language"?: string | null;
					"theme"?: string | null;
				};
				Relationships: [
				];
			};
			"rate_events": {
				Row: {
					"action": string;
					"created_at": string;
					"id": string;
					"user_id": string;
				};
				ComputedFields: never;
				Insert: {
					"action": string;
					"created_at"?: string;
					"id"?: string;
					"user_id": string;
				};
				Update: {
					"action"?: string;
					"created_at"?: string;
					"id"?: string;
					"user_id"?: string;
				};
				Relationships: [
				];
			};
			"recurring_rules": {
				Row: {
					"account_id": string;
					"active": boolean;
					"amount": number;
					"category_id": string | null;
					"created_at": string;
					"end_date": string | null;
					"frequency": string;
					"id": string;
					"next_run": string;
					"notes": string | null;
					"start_date": string;
					"type": string;
					"user_id": string;
				};
				ComputedFields: never;
				Insert: {
					"account_id": string;
					"active"?: boolean;
					"amount": number;
					"category_id"?: string | null;
					"created_at"?: string;
					"end_date"?: string | null;
					"frequency": string;
					"id"?: string;
					"next_run": string;
					"notes"?: string | null;
					"start_date": string;
					"type": string;
					"user_id": string;
				};
				Update: {
					"account_id"?: string;
					"active"?: boolean;
					"amount"?: number;
					"category_id"?: string | null;
					"created_at"?: string;
					"end_date"?: string | null;
					"frequency"?: string;
					"id"?: string;
					"next_run"?: string;
					"notes"?: string | null;
					"start_date"?: string;
					"type"?: string;
					"user_id"?: string;
				};
				Relationships: [
					{
						foreignKeyName: "recurring_rules_account_owner_fkey";
						columns: [
							"account_id",
							"user_id"
						];
						isOneToOne: false;
						referencedRelation: "account_balances";
						referencedColumns: [
							"id",
							"user_id"
						];
					},
					{
						foreignKeyName: "recurring_rules_account_owner_fkey";
						columns: [
							"account_id",
							"user_id"
						];
						isOneToOne: false;
						referencedRelation: "accounts";
						referencedColumns: [
							"id",
							"user_id"
						];
					},
					{
						foreignKeyName: "recurring_rules_category_owner_fkey";
						columns: [
							"category_id",
							"user_id"
						];
						isOneToOne: false;
						referencedRelation: "categories";
						referencedColumns: [
							"id",
							"user_id"
						];
					}
				];
			};
			"transactions": {
				Row: {
					"account_id": string;
					"amount": number;
					"category_id": string | null;
					"created_at": string | null;
					"date": string;
					"id": string;
					"import_id": string | null;
					"import_key": string | null;
					"investment_type": string | null;
					"notes": string | null;
					"recurring_rule_id": string | null;
					"to_account_id": string | null;
					"type": string;
					"user_id": string;
				};
				ComputedFields: never;
				Insert: {
					"account_id": string;
					"amount": number;
					"category_id"?: string | null;
					"created_at"?: string | null;
					"date"?: string;
					"id"?: string;
					"import_id"?: string | null;
					"import_key"?: string | null;
					"investment_type"?: string | null;
					"notes"?: string | null;
					"recurring_rule_id"?: string | null;
					"to_account_id"?: string | null;
					"type": string;
					"user_id": string;
				};
				Update: {
					"account_id"?: string;
					"amount"?: number;
					"category_id"?: string | null;
					"created_at"?: string | null;
					"date"?: string;
					"id"?: string;
					"import_id"?: string | null;
					"import_key"?: string | null;
					"investment_type"?: string | null;
					"notes"?: string | null;
					"recurring_rule_id"?: string | null;
					"to_account_id"?: string | null;
					"type"?: string;
					"user_id"?: string;
				};
				Relationships: [
					{
						foreignKeyName: "transactions_account_owner_fkey";
						columns: [
							"account_id",
							"user_id"
						];
						isOneToOne: false;
						referencedRelation: "account_balances";
						referencedColumns: [
							"id",
							"user_id"
						];
					},
					{
						foreignKeyName: "transactions_account_owner_fkey";
						columns: [
							"account_id",
							"user_id"
						];
						isOneToOne: false;
						referencedRelation: "accounts";
						referencedColumns: [
							"id",
							"user_id"
						];
					},
					{
						foreignKeyName: "transactions_category_owner_fkey";
						columns: [
							"category_id",
							"user_id"
						];
						isOneToOne: false;
						referencedRelation: "categories";
						referencedColumns: [
							"id",
							"user_id"
						];
					},
					{
						foreignKeyName: "transactions_import_id_fkey";
						columns: [
							"import_id"
						];
						isOneToOne: false;
						referencedRelation: "imports";
						referencedColumns: [
							"id"
						];
					},
					{
						foreignKeyName: "transactions_recurring_rule_id_fkey";
						columns: [
							"recurring_rule_id"
						];
						isOneToOne: false;
						referencedRelation: "recurring_rules";
						referencedColumns: [
							"id"
						];
					},
					{
						foreignKeyName: "transactions_to_account_owner_fkey";
						columns: [
							"to_account_id",
							"user_id"
						];
						isOneToOne: false;
						referencedRelation: "account_balances";
						referencedColumns: [
							"id",
							"user_id"
						];
					},
					{
						foreignKeyName: "transactions_to_account_owner_fkey";
						columns: [
							"to_account_id",
							"user_id"
						];
						isOneToOne: false;
						referencedRelation: "accounts";
						referencedColumns: [
							"id",
							"user_id"
						];
					}
				];
			};
		};
		Views: {
			"account_balances": {
				Row: {
					"archived": boolean;
					"balance": number | null;
					"color": string | null;
					"created_at": string;
					"icon": string | null;
					"id": string;
					"initial_balance": number;
					"name": string;
					"type": string | null;
					"user_id": string;
				};
				ComputedFields: never;
				Relationships: [
				];
			};
		};
		Functions: {
			"budget_period_end": {
				Args: {
					"p_period": string;
					"ref_date": string;
				};
				Returns: string;
			};
			"budget_period_start": {
				Args: {
					"p_period": string;
					"ref_date": string;
				};
				Returns: string;
			};
			"budget_warning_threshold": {
				Args: Record<PropertyKey, never>;
				Returns: number;
			};
			"budgets_at": {
				Args: {
					"ref_date"?: string;
				};
				Returns: {
					"amount": number;
					"budget_id": string;
					"category_id": string;
					"period": string;
					"period_end": string;
					"period_start": string;
					"valid_from": string;
				}[];
			};
			"consume_rate_limit": {
				Args: {
					"p_action": string;
				};
				Returns: number;
			};
			"daily_job_health": {
				Args: Record<PropertyKey, never>;
				Returns: {
					"failed_steps": (string)[];
					"had_error": boolean;
					"last_ok_at": string;
					"last_run_at": string;
					"watching_since": string;
				}[];
			};
			"dashboard_totals": {
				Args: {
					"p_account_id": string;
					"p_bounds": (string)[];
				};
				Returns: {
					"bucket_index": number;
					"total": number;
					"type": string;
				}[];
			};
			"delete_current_user": {
				Args: {
					"dry_run"?: boolean;
				};
				Returns: undefined;
			};
			"generate_notifications": {
				Args: Record<PropertyKey, never>;
				Returns: undefined;
			};
			"generate_recurring_transactions": {
				Args: Record<PropertyKey, never>;
				Returns: number;
			};
			"import_transactions": {
				Args: {
					"p_account_id": string;
					"p_filename": string;
					"p_rows": Json;
					"p_source": string;
				};
				Returns: {
					"import_id": string;
					"inserted": number;
					"submitted": number;
				}[];
			};
			"run_daily_jobs": {
				Args: Record<PropertyKey, never>;
				Returns: undefined;
			};
			"set_budget": {
				Args: {
					"p_amount": number;
					"p_category_id": string;
					"p_period": string;
					"p_today"?: string;
				};
				Returns: undefined;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];
export type Tables<DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | {
	schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
} ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]) : never = never> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
} ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
	Row: infer R;
} ? R : never : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
	Row: infer R;
} ? R : never : never;
export type TablesInsert<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
	schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
	Insert: infer I;
} ? I : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
	Insert: infer I;
} ? I : never : never;
export type TablesUpdate<DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | {
	schema: keyof DatabaseWithoutInternals;
}, TableName extends DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
	Update: infer U;
} ? U : never : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
	Update: infer U;
} ? U : never : never;
export type Enums<DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | {
	schema: keyof DatabaseWithoutInternals;
}, EnumName extends DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName] : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions] : never;
export type CompositeTypes<PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | {
	schema: keyof DatabaseWithoutInternals;
}, CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
} ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
} ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName] : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] : never;
export const Constants = {
	"public": {
		Enums: {}
	}
} as const;
