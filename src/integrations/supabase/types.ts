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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_configs: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      assembly_orders: {
        Row: {
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          reservation_notes: string | null
          status: string
          stock_reserved: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          due_date?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          reservation_notes?: string | null
          status?: string
          stock_reserved?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reservation_notes?: string | null
          status?: string
          stock_reserved?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assembly_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      autocount_sync_log: {
        Row: {
          autocount_doc_no: string | null
          created_at: string | null
          error_message: string | null
          id: string
          reference_id: string
          reference_type: string
          retry_count: number | null
          sync_status: string
          sync_type: string
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          autocount_doc_no?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          reference_id: string
          reference_type: string
          retry_count?: number | null
          sync_status?: string
          sync_type: string
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          autocount_doc_no?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          reference_id?: string
          reference_type?: string
          retry_count?: number | null
          sync_status?: string
          sync_type?: string
          synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      batch_sequences: {
        Row: {
          created_at: string | null
          date_key: string
          id: string
          last_sequence: number | null
        }
        Insert: {
          created_at?: string | null
          date_key: string
          id?: string
          last_sequence?: number | null
        }
        Update: {
          created_at?: string | null
          date_key?: string
          id?: string
          last_sequence?: number | null
        }
        Relationships: []
      }
      bom_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          raw_material_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
          raw_material_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          raw_material_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      components: {
        Row: {
          autocount_item_code: string | null
          cost_per_unit: number | null
          created_at: string
          description: string | null
          has_batch_no: boolean | null
          id: string
          item_group: string | null
          item_type: string | null
          last_synced_at: string | null
          name: string
          price: number | null
          reserved_quantity: number
          sku: string
          stock_control: boolean | null
          stock_quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          autocount_item_code?: string | null
          cost_per_unit?: number | null
          created_at?: string
          description?: string | null
          has_batch_no?: boolean | null
          id?: string
          item_group?: string | null
          item_type?: string | null
          last_synced_at?: string | null
          name: string
          price?: number | null
          reserved_quantity?: number
          sku: string
          stock_control?: boolean | null
          stock_quantity?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          autocount_item_code?: string | null
          cost_per_unit?: number | null
          created_at?: string
          description?: string | null
          has_batch_no?: boolean | null
          id?: string
          item_group?: string | null
          item_type?: string | null
          last_synced_at?: string | null
          name?: string
          price?: number | null
          reserved_quantity?: number
          sku?: string
          stock_control?: boolean | null
          stock_quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          autocount_synced: boolean
          company_name: string
          contact_person: string | null
          created_at: string
          credit_terms: number | null
          customer_code: string
          email: string | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          autocount_synced?: boolean
          company_name: string
          contact_person?: string | null
          created_at?: string
          credit_terms?: number | null
          customer_code: string
          email?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          autocount_synced?: boolean
          company_name?: string
          contact_person?: string | null
          created_at?: string
          credit_terms?: number | null
          customer_code?: string
          email?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      finished_goods: {
        Row: {
          autocount_item_code: string
          autocount_synced: boolean
          cost_per_unit: number | null
          created_at: string
          description: string | null
          id: string
          item_group: string | null
          item_type: string | null
          last_synced_at: string | null
          name: string
          price: number | null
          sku: string
          stock_quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          autocount_item_code: string
          autocount_synced?: boolean
          cost_per_unit?: number | null
          created_at?: string
          description?: string | null
          id?: string
          item_group?: string | null
          item_type?: string | null
          last_synced_at?: string | null
          name: string
          price?: number | null
          sku: string
          stock_quantity?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          autocount_item_code?: string
          autocount_synced?: boolean
          cost_per_unit?: number | null
          created_at?: string
          description?: string | null
          id?: string
          item_group?: string | null
          item_type?: string | null
          last_synced_at?: string | null
          name?: string
          price?: number | null
          sku?: string
          stock_quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      label_templates: {
        Row: {
          created_at: string
          description: string | null
          format: string
          id: string
          is_default: boolean | null
          name: string
          template_content: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          format: string
          id?: string
          is_default?: boolean | null
          name: string
          template_content: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          format?: string
          id?: string
          is_default?: boolean | null
          name?: string
          template_content?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          component_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          sku: string
          stock_quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          component_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sku: string
          stock_quantity?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          component_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sku?: string
          stock_quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: true
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          component_id: string | null
          created_at: string
          id: string
          item_type: string
          line_number: number
          line_remarks: string | null
          purchase_order_id: string
          quantity: number
          raw_material_id: string | null
          unit_price: number
          uom: string
          updated_at: string
        }
        Insert: {
          component_id?: string | null
          created_at?: string
          id?: string
          item_type?: string
          line_number: number
          line_remarks?: string | null
          purchase_order_id: string
          quantity: number
          raw_material_id?: string | null
          unit_price: number
          uom: string
          updated_at?: string
        }
        Update: {
          component_id?: string | null
          created_at?: string
          id?: string
          item_type?: string
          line_number?: number
          line_remarks?: string | null
          purchase_order_id?: string
          quantity?: number
          raw_material_id?: string | null
          unit_price?: number
          uom?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          autocount_doc_no: string | null
          autocount_synced: boolean
          cash_advance: number | null
          cash_given_by: string | null
          cash_returned: number | null
          cash_returned_to: string | null
          created_at: string
          created_by: string
          delivery_date: string | null
          doc_date: string
          goods_received: boolean | null
          id: string
          is_cash_purchase: boolean | null
          po_number: string
          received_at: string | null
          received_by: string | null
          remarks: string | null
          status: string
          supplier_id: string
          sync_error_message: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          autocount_doc_no?: string | null
          autocount_synced?: boolean
          cash_advance?: number | null
          cash_given_by?: string | null
          cash_returned?: number | null
          cash_returned_to?: string | null
          created_at?: string
          created_by: string
          delivery_date?: string | null
          doc_date: string
          goods_received?: boolean | null
          id?: string
          is_cash_purchase?: boolean | null
          po_number: string
          received_at?: string | null
          received_by?: string | null
          remarks?: string | null
          status?: string
          supplier_id: string
          sync_error_message?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          autocount_doc_no?: string | null
          autocount_synced?: boolean
          cash_advance?: number | null
          cash_given_by?: string | null
          cash_returned?: number | null
          cash_returned_to?: string | null
          created_at?: string
          created_by?: string
          delivery_date?: string | null
          doc_date?: string
          goods_received?: boolean | null
          id?: string
          is_cash_purchase?: boolean | null
          po_number?: string
          received_at?: string | null
          received_by?: string | null
          remarks?: string | null
          status?: string
          supplier_id?: string
          sync_error_message?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_cash_given_by_fkey"
            columns: ["cash_given_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_cash_returned_to_fkey"
            columns: ["cash_returned_to"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_materials: {
        Row: {
          autocount_item_code: string | null
          cost_per_unit: number | null
          created_at: string
          description: string | null
          has_batch_no: boolean | null
          id: string
          item_group: string | null
          item_type: string | null
          last_synced_at: string | null
          name: string
          price: number | null
          reserved_quantity: number
          sku: string
          stock_control: boolean | null
          stock_quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          autocount_item_code?: string | null
          cost_per_unit?: number | null
          created_at?: string
          description?: string | null
          has_batch_no?: boolean | null
          id?: string
          item_group?: string | null
          item_type?: string | null
          last_synced_at?: string | null
          name: string
          price?: number | null
          reserved_quantity?: number
          sku: string
          stock_control?: boolean | null
          stock_quantity?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          autocount_item_code?: string | null
          cost_per_unit?: number | null
          created_at?: string
          description?: string | null
          has_batch_no?: boolean | null
          id?: string
          item_group?: string | null
          item_type?: string | null
          last_synced_at?: string | null
          name?: string
          price?: number | null
          reserved_quantity?: number
          sku?: string
          stock_control?: boolean | null
          stock_quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          autocount_doc_no: string | null
          autocount_synced: boolean | null
          batch_number: string | null
          created_at: string
          expired_at: string | null
          expiry_notes: string | null
          id: string
          is_expired: boolean | null
          item_id: string
          item_type: string
          marked_expired_by: string | null
          movement_type: string
          notes: string | null
          performed_by: string
          purchase_order_id: string | null
          quantity: number
          quantity_in_base_unit: number | null
          reference_id: string | null
          reference_type: string | null
          supplier_reference: string | null
          total_cost: number | null
          unit_cost: number | null
          unit_received: string | null
          warehouse_location: string | null
        }
        Insert: {
          autocount_doc_no?: string | null
          autocount_synced?: boolean | null
          batch_number?: string | null
          created_at?: string
          expired_at?: string | null
          expiry_notes?: string | null
          id?: string
          is_expired?: boolean | null
          item_id: string
          item_type: string
          marked_expired_by?: string | null
          movement_type: string
          notes?: string | null
          performed_by: string
          purchase_order_id?: string | null
          quantity: number
          quantity_in_base_unit?: number | null
          reference_id?: string | null
          reference_type?: string | null
          supplier_reference?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          unit_received?: string | null
          warehouse_location?: string | null
        }
        Update: {
          autocount_doc_no?: string | null
          autocount_synced?: boolean | null
          batch_number?: string | null
          created_at?: string
          expired_at?: string | null
          expiry_notes?: string | null
          id?: string
          is_expired?: boolean | null
          item_id?: string
          item_type?: string
          marked_expired_by?: string | null
          movement_type?: string
          notes?: string | null
          performed_by?: string
          purchase_order_id?: string | null
          quantity?: number
          quantity_in_base_unit?: number | null
          reference_id?: string | null
          reference_type?: string | null
          supplier_reference?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          unit_received?: string | null
          warehouse_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_marked_expired_by_fkey"
            columns: ["marked_expired_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          autocount_synced: boolean
          company_name: string
          contact_person: string | null
          created_at: string
          credit_terms: number | null
          email: string | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          phone: string | null
          supplier_code: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          autocount_synced?: boolean
          company_name: string
          contact_person?: string | null
          created_at?: string
          credit_terms?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          phone?: string | null
          supplier_code: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          autocount_synced?: boolean
          company_name?: string
          contact_person?: string | null
          created_at?: string
          credit_terms?: number | null
          email?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          phone?: string | null
          supplier_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      unit_conversions: {
        Row: {
          conversion_factor: number
          created_at: string | null
          from_unit: string
          id: string
          to_unit: string
        }
        Insert: {
          conversion_factor: number
          created_at?: string | null
          from_unit: string
          id?: string
          to_unit: string
        }
        Update: {
          conversion_factor?: number
          created_at?: string | null
          from_unit?: string
          id?: string
          to_unit?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_next_item_code: { Args: never; Returns: string }
      get_next_raw_material_code: { Args: never; Returns: string }
      get_next_supplier_code: { Args: never; Returns: string }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      release_stock_reservation: {
        Args: {
          p_assembly_order_id: string
          p_product_id: string
          p_quantity: number
        }
        Returns: undefined
      }
      reserve_stock_for_assembly: {
        Args: {
          p_assembly_order_id: string
          p_product_id: string
          p_quantity: number
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
