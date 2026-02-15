export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ads_audit_logs: {
        Row: {
          action: string
          campaign_id: string | null
          created_at: string
          details: string | null
          id: string
          performed_by: string
        }
        Insert: {
          action: string
          campaign_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          performed_by: string
        }
        Update: {
          action?: string
          campaign_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_audit_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ads_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_campaigns: {
        Row: {
          assigned_leads: string[] | null
          assigned_products: string[] | null
          budget: number
          campaign_name: string
          clicks: number
          conversions: number
          created_at: string
          id: string
          impressions: number
          notes: string | null
          platform: string
          spent: number
          status: string
          updated_at: string
        }
        Insert: {
          assigned_leads?: string[] | null
          assigned_products?: string[] | null
          budget?: number
          campaign_name: string
          clicks?: number
          conversions?: number
          created_at?: string
          id?: string
          impressions?: number
          notes?: string | null
          platform?: string
          spent?: number
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_leads?: string[] | null
          assigned_products?: string[] | null
          budget?: number
          campaign_name?: string
          clicks?: number
          conversions?: number
          created_at?: string
          id?: string
          impressions?: number
          notes?: string | null
          platform?: string
          spent?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          agent_id: string
          context_id: string
          context_type: string
          created_at: string
          id: string
          notes: string | null
          outcome: string
        }
        Insert: {
          agent_id: string
          context_id: string
          context_type: string
          created_at?: string
          id?: string
          notes?: string | null
          outcome: string
        }
        Update: {
          agent_id?: string
          context_id?: string
          context_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          outcome?: string
        }
        Relationships: []
      }
      call_scripts: {
        Row: {
          context_type: string
          id: string
          script_text: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          context_type: string
          id?: string
          script_text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          context_type?: string
          id?: string
          script_text?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      inbound_leads: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_logs: {
        Row: {
          change_amount: number
          created_at: string
          id: string
          new_stock: number
          previous_stock: number
          product_id: string
          reason: string
          user_id: string | null
        }
        Insert: {
          change_amount: number
          created_at?: string
          id?: string
          new_stock: number
          previous_stock: number
          product_id: string
          reason?: string
          user_id?: string | null
        }
        Update: {
          change_amount?: number
          created_at?: string
          id?: string
          new_stock?: number
          previous_stock?: number
          product_id?: string
          reason?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_by_name: string | null
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_by_name?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          author_id: string | null
          author_name: string
          created_at: string
          id: string
          order_id: string
          text: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          created_at?: string
          id?: string
          order_id: string
          text: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          created_at?: string
          id?: string
          order_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_agent_id: string | null
          assigned_agent_name: string | null
          assigned_at: string | null
          assigned_by: string | null
          birthday: string | null
          created_at: string
          customer_address: string
          customer_city: string
          customer_name: string
          customer_phone: string
          display_id: string
          id: string
          postal_code: string | null
          price: number
          product_id: string | null
          product_name: string
          source_lead_id: string | null
          source_type: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          assigned_agent_name?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          birthday?: string | null
          created_at?: string
          customer_address?: string
          customer_city?: string
          customer_name?: string
          customer_phone?: string
          display_id: string
          id?: string
          postal_code?: string | null
          price?: number
          product_id?: string | null
          product_name: string
          source_lead_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          assigned_agent_name?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          birthday?: string | null
          created_at?: string
          customer_address?: string
          customer_city?: string
          customer_name?: string
          customer_phone?: string
          display_id?: string
          id?: string
          postal_code?: string | null
          price?: number
          product_id?: string | null
          product_name?: string
          source_lead_id?: string | null
          source_type?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_source_lead_id_fkey"
            columns: ["source_lead_id"]
            isOneToOne: false
            referencedRelation: "prediction_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_leads: {
        Row: {
          address: string | null
          assigned_agent_id: string | null
          assigned_agent_name: string | null
          city: string | null
          created_at: string
          id: string
          list_id: string
          name: string
          notes: string | null
          product: string | null
          status: Database["public"]["Enums"]["lead_status"]
          telephone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_agent_id?: string | null
          assigned_agent_name?: string | null
          city?: string | null
          created_at?: string
          id?: string
          list_id: string
          name?: string
          notes?: string | null
          product?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          telephone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_agent_id?: string | null
          assigned_agent_name?: string | null
          city?: string | null
          created_at?: string
          id?: string
          list_id?: string
          name?: string
          notes?: string | null
          product?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          telephone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_leads_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "prediction_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_lists: {
        Row: {
          assigned_count: number
          id: string
          name: string
          total_records: number
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          assigned_count?: number
          id?: string
          name: string
          total_records?: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          assigned_count?: number
          id?: string
          name?: string
          total_records?: number
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          low_stock_threshold: number
          name: string
          photo_url: string | null
          price: number
          sku: string | null
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          name: string
          photo_url?: string | null
          price?: number
          sku?: string | null
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          name?: string
          photo_url?: string | null
          price?: number
          sku?: string | null
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shift_assignments: {
        Row: {
          created_at: string
          id: string
          shift_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shift_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shift_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          end_time: string
          id: string
          name: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          end_time: string
          id?: string
          name: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          end_time?: string
          id?: string
          name?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_warehouse: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_warehouse_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_phone_duplicates: {
        Args: { _exclude_order_id?: string; _phone: string }
        Returns: {
          source: string
          source_id: string
          source_name: string
        }[]
      }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "agent" | "warehouse" | "ads_admin"
      lead_status:
        | "not_contacted"
        | "no_answer"
        | "interested"
        | "not_interested"
        | "confirmed"
      order_status:
        | "pending"
        | "take"
        | "call_again"
        | "confirmed"
        | "shipped"
        | "delivered"
        | "returned"
        | "paid"
        | "trashed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "agent", "warehouse", "ads_admin"],
      lead_status: [
        "not_contacted",
        "no_answer",
        "interested",
        "not_interested",
        "confirmed",
      ],
      order_status: [
        "pending",
        "take",
        "call_again",
        "confirmed",
        "shipped",
        "delivered",
        "returned",
        "paid",
        "trashed",
        "cancelled",
      ],
    },
  },
} as const
