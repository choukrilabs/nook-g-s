export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      cafes: {
        Row: {
          id: string
          owner_id: string | null
          name: string
          address: string | null
          phone: string | null
          city: string | null
          invite_code: string
          total_seats: number
          default_rate: number
          premium_rate: number
          billing_increment: string
          long_session_alert_hours: number
          low_balance_alert: number
          language: string
          setup_complete: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id?: string | null
          name: string
          address?: string | null
          phone?: string | null
          city?: string | null
          invite_code: string
          total_seats?: number
          default_rate?: number
          premium_rate?: number
          billing_increment?: string
          long_session_alert_hours?: number
          low_balance_alert?: number
          language?: string
          setup_complete?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string | null
          name?: string
          address?: string | null
          phone?: string | null
          city?: string | null
          invite_code?: string
          total_seats?: number
          default_rate?: number
          premium_rate?: number
          billing_increment?: string
          long_session_alert_hours?: number
          low_balance_alert?: number
          language?: string
          setup_complete?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          id: string
          cafe_id: string
          name: string
          phone: string | null
          pin_hash: string
          active: boolean
          permissions: Json
          last_login_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cafe_id: string
          name: string
          phone?: string | null
          pin_hash: string
          active?: boolean
          permissions?: Json
          last_login_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cafe_id?: string
          name?: string
          phone?: string | null
          pin_hash?: string
          active?: boolean
          permissions?: Json
          last_login_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          cafe_id: string
          staff_id: string | null
          customer_name: string
          customer_phone: string | null
          seat_number: number
          rate_per_hour: number
          started_at: string
          ended_at: string | null
          duration_minutes: number | null
          time_cost: number | null
          extras: Json
          extras_total: number
          total_amount: number
          payment_method: string | null
          amount_received: number | null
          change_given: number | null
          client_account_id: string | null
          status: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cafe_id: string
          staff_id?: string | null
          customer_name: string
          customer_phone?: string | null
          seat_number: number
          rate_per_hour: number
          started_at?: string
          ended_at?: string | null
          duration_minutes?: number | null
          time_cost?: number | null
          extras?: Json
          extras_total?: number
          total_amount?: number
          payment_method?: string | null
          amount_received?: number | null
          change_given?: number | null
          client_account_id?: string | null
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cafe_id?: string
          staff_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          seat_number?: number
          rate_per_hour?: number
          started_at?: string
          ended_at?: string | null
          duration_minutes?: number | null
          time_cost?: number | null
          extras?: Json
          extras_total?: number
          total_amount?: number
          payment_method?: string | null
          amount_received?: number | null
          change_given?: number | null
          client_account_id?: string | null
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_accounts: {
        Row: {
          id: string
          cafe_id: string
          name: string
          phone: string | null
          balance: number
          notes: string | null
          total_visits: number
          total_spent: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          cafe_id: string
          name: string
          phone?: string | null
          balance?: number
          notes?: string | null
          total_visits?: number
          total_spent?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cafe_id?: string
          name?: string
          phone?: string | null
          balance?: number
          notes?: string | null
          total_visits?: number
          total_spent?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          cafe_id: string
          name: string
          price: number
          category: string
          active: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          cafe_id: string
          name: string
          price: number
          category?: string
          active?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          cafe_id?: string
          name?: string
          price?: number
          category?: string
          active?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      balance_transactions: {
        Row: {
          id: string
          cafe_id: string
          client_id: string
          session_id: string | null
          staff_id: string | null
          type: string
          amount: number
          balance_before: number
          balance_after: number
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          cafe_id: string
          client_id: string
          session_id?: string | null
          staff_id?: string | null
          type: string
          amount: number
          balance_before: number
          balance_after: number
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          cafe_id?: string
          client_id?: string
          session_id?: string | null
          staff_id?: string | null
          type?: string
          amount?: number
          balance_before?: number
          balance_after?: number
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string
          cafe_id: string
          staff_id: string | null
          is_owner: boolean
          action: string
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          cafe_id: string
          staff_id?: string | null
          is_owner?: boolean
          action: string
          details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          cafe_id?: string
          staff_id?: string | null
          is_owner?: boolean
          action?: string
          details?: Json
          created_at?: string
        }
        Relationships: []
      }
      staff_sessions: {
        Row: {
          user_id: string
          staff_id: string
          cafe_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          staff_id: string
          cafe_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          staff_id?: string
          cafe_id?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_cafe_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      lookup_cafe_by_invite: {
        Args: {
          p_code: string
        }
        Returns: {
          id: string
          name: string
          setup_complete: boolean
        }[]
      }
      list_staff_for_login: {
        Args: {
          p_cafe_id: string
        }
        Returns: {
          id: string
          name: string
        }[]
      }
      staff_pin_login: {
        Args: {
          p_cafe_id: string
          p_staff_id: string
          p_pin: string
        }
        Returns: {
          id: string
          name: string
          permissions: Json
        }[]
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

export type Cafe = Database['public']['Tables']['cafes']['Row']
export type Staff = Database['public']['Tables']['staff']['Row']
export type Session = Database['public']['Tables']['sessions']['Row']
export type ClientAccount = Database['public']['Tables']['client_accounts']['Row']
export type Product = Database['public']['Tables']['products']['Row']
export type BalanceTransaction = Database['public']['Tables']['balance_transactions']['Row']
export type AuditLog = Database['public']['Tables']['audit_log']['Row']

export interface StaffPermissions {
  sessions: boolean
  reports: boolean
  clients: boolean
  settings: boolean
  rates?: boolean
}

export interface SessionExtra {
  id?: string
  name: string
  price: number
  qty: number
  quantity?: number
  added_at?: string
}

export type EnrichedAuditLog = AuditLog & {
  staff_name?: string
}
