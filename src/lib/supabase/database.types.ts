/**
 * Generated from the local Postgres schema by `npm run db:types`.
 *
 * Do not edit by hand. Note that the generator maps BIGINT and NUMERIC to the
 * TypeScript `number`, which cannot hold them exactly; the data access layer
 * therefore selects every money, quantity and price column with a `::text`
 * cast and parses it into BigInt, so no financial value passes through a
 * double. See docs/FINANCIAL_CALCULATIONS.md.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      asset_price_history: {
        Row: {
          as_of: string;
          asset_id: string;
          created_at: string;
          currency: string;
          id: string;
          price: number;
          source: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          as_of?: string;
          asset_id: string;
          created_at?: string;
          currency: string;
          id?: string;
          price: number;
          source?: string;
          user_id: string;
        };
        Update: {
          as_of?: string;
          asset_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          price?: number;
          source?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asset_price_history_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "asset_price_history_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
        ];
      };
      assets: {
        Row: {
          archived_at: string | null;
          asset_class: Database["public"]["Enums"]["asset_class"];
          created_at: string;
          currency: string;
          description: string;
          id: string;
          name: string;
          symbol: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          asset_class: Database["public"]["Enums"]["asset_class"];
          created_at?: string;
          currency: string;
          description?: string;
          id?: string;
          name: string;
          symbol: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          asset_class?: Database["public"]["Enums"]["asset_class"];
          created_at?: string;
          currency?: string;
          description?: string;
          id?: string;
          name?: string;
          symbol?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assets_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
        ];
      };
      budgets: {
        Row: {
          category_id: string;
          created_at: string;
          currency: string;
          id: string;
          limit_minor: number;
          period: Database["public"]["Enums"]["budget_period"];
          period_start: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          created_at?: string;
          currency: string;
          id?: string;
          limit_minor: number;
          period?: Database["public"]["Enums"]["budget_period"];
          period_start: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          limit_minor?: number;
          period?: Database["public"]["Enums"]["budget_period"];
          period_start?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budgets_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          id: string;
          is_system: boolean;
          kind: Database["public"]["Enums"]["category_kind"];
          name: string;
          system_key: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_system?: boolean;
          kind: Database["public"]["Enums"]["category_kind"];
          name: string;
          system_key?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_system?: boolean;
          kind?: Database["public"]["Enums"]["category_kind"];
          name?: string;
          system_key?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      currencies: {
        Row: {
          code: string;
          exponent: number;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          exponent: number;
          name: string;
        };
        Update: {
          code?: string;
          exponent?: number;
          name?: string;
        };
        Relationships: [];
      };
      import_batches: {
        Row: {
          byte_size: number;
          completed_at: string | null;
          created_at: string;
          duplicate_count: number;
          error_report: NonNullable<Json>;
          file_name: string;
          id: string;
          inserted_count: number;
          rejected_count: number;
          row_count: number;
          status: Database["public"]["Enums"]["import_status"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          byte_size: number;
          completed_at?: string | null;
          created_at?: string;
          duplicate_count?: number;
          error_report?: NonNullable<Json>;
          file_name: string;
          id?: string;
          inserted_count?: number;
          rejected_count?: number;
          row_count?: number;
          status?: Database["public"]["Enums"]["import_status"];
          user_id: string;
        };
        Update: {
          byte_size?: number;
          completed_at?: string | null;
          created_at?: string;
          duplicate_count?: number;
          error_report?: NonNullable<Json>;
          file_name?: string;
          id?: string;
          inserted_count?: number;
          rejected_count?: number;
          row_count?: number;
          status?: Database["public"]["Enums"]["import_status"];
          user_id?: string;
        };
        Relationships: [];
      };
      investment_transactions: {
        Row: {
          asset_id: string;
          created_at: string;
          currency: string;
          fee_minor: number;
          id: string;
          note: string;
          occurred_on: string;
          quantity: number;
          side: Database["public"]["Enums"]["investment_side"];
          transaction_id: string | null;
          unit_price: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          asset_id: string;
          created_at?: string;
          currency: string;
          fee_minor?: number;
          id?: string;
          note?: string;
          occurred_on: string;
          quantity: number;
          side: Database["public"]["Enums"]["investment_side"];
          transaction_id?: string | null;
          unit_price: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          currency?: string;
          fee_minor?: number;
          id?: string;
          note?: string;
          occurred_on?: string;
          quantity?: number;
          side?: Database["public"]["Enums"]["investment_side"];
          transaction_id?: string | null;
          unit_price?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "investment_transactions_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investment_transactions_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "investment_transactions_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          default_currency: string;
          display_name: string;
          id: string;
          locale: string;
          time_zone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          default_currency?: string;
          display_name?: string;
          id: string;
          locale?: string;
          time_zone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          default_currency?: string;
          display_name?: string;
          id?: string;
          locale?: string;
          time_zone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_default_currency_fkey";
            columns: ["default_currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
        ];
      };
      savings_goal_entries: {
        Row: {
          amount_minor: number;
          created_at: string;
          currency: string;
          direction: Database["public"]["Enums"]["goal_entry_direction"];
          goal_id: string;
          id: string;
          note: string;
          occurred_on: string;
          transaction_id: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_minor: number;
          created_at?: string;
          currency: string;
          direction: Database["public"]["Enums"]["goal_entry_direction"];
          goal_id: string;
          id?: string;
          note?: string;
          occurred_on?: string;
          transaction_id?: string | null;
          user_id: string;
        };
        Update: {
          amount_minor?: number;
          created_at?: string;
          currency?: string;
          direction?: Database["public"]["Enums"]["goal_entry_direction"];
          goal_id?: string;
          id?: string;
          note?: string;
          occurred_on?: string;
          transaction_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "savings_goal_entries_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "savings_goal_entries_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "savings_goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "savings_goal_entries_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      savings_goals: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_on: string;
          currency: string;
          description: string;
          id: string;
          name: string;
          target_date: string | null;
          target_minor: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_on?: string;
          currency: string;
          description?: string;
          id?: string;
          name: string;
          target_date?: string | null;
          target_minor: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_on?: string;
          currency?: string;
          description?: string;
          id?: string;
          name?: string;
          target_date?: string | null;
          target_minor?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "savings_goals_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
        ];
      };
      transactions: {
        Row: {
          amount_minor: number;
          asset_id: string | null;
          category_id: string | null;
          created_at: string;
          currency: string;
          description: string;
          goal_id: string | null;
          id: string;
          import_batch_id: string | null;
          import_fingerprint: string | null;
          kind: Database["public"]["Enums"]["transaction_kind"];
          occurred_on: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_minor: number;
          asset_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          currency: string;
          description?: string;
          goal_id?: string | null;
          id?: string;
          import_batch_id?: string | null;
          import_fingerprint?: string | null;
          kind: Database["public"]["Enums"]["transaction_kind"];
          occurred_on: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_minor?: number;
          asset_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          currency?: string;
          description?: string;
          goal_id?: string | null;
          id?: string;
          import_batch_id?: string | null;
          import_fingerprint?: string | null;
          kind?: Database["public"]["Enums"]["transaction_kind"];
          occurred_on?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_asset_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "transactions_goal_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "savings_goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_import_batch_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      show_limit: { Args: Record<PropertyKey, never>; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
    };
    Enums: {
      asset_class: "stock" | "etf" | "fund" | "crypto" | "gold" | "other";
      budget_period: "monthly";
      category_kind: "income" | "expense";
      goal_entry_direction: "deposit" | "withdrawal";
      import_status: "pending" | "completed" | "failed" | "cancelled";
      investment_side: "buy" | "sell";
      transaction_kind: "income" | "expense" | "transfer_in" | "transfer_out";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      asset_class: ["stock", "etf", "fund", "crypto", "gold", "other"],
      budget_period: ["monthly"],
      category_kind: ["income", "expense"],
      goal_entry_direction: ["deposit", "withdrawal"],
      import_status: ["pending", "completed", "failed", "cancelled"],
      investment_side: ["buy", "sell"],
      transaction_kind: ["income", "expense", "transfer_in", "transfer_out"],
    },
  },
} as const;
