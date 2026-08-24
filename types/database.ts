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
      tenants: {
        Row: {
          id: string
          owner_id: string
          name: string
          slug: string
          institution: string | null
          logo_url: string | null
          theme_color: string
          plan: "STARTER" | "PRO" | "ENTERPRISE"
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["tenants"]["Row"], "id" | "created_at" | "updated_at">
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>
      }
      tenant_members: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          role: "OWNER" | "ADMIN" | "VIEWER"
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["tenant_members"]["Row"], "id" | "created_at">
        Update: Partial<Database["public"]["Tables"]["tenant_members"]["Insert"]>
      }
      elections: {
        Row: {
          id: string
          tenant_id: string
          slug: string
          title: string
          subtitle: string | null
          description: string | null
          banner_url: string | null
          timeline: Json
          contact_info: string | null
          voting_mode: "ONLINE_ONLY" | "OFFLINE_TPS" | "HYBRID"
          status: "DRAFT" | "SCHEDULED" | "ONGOING" | "CLOSED" | "ARCHIVED"
          start_time: string
          end_time: string
          kiosk_pin_hash: string | null
          show_candidates_before_login: boolean
          show_public_result: boolean
          allow_abstain: boolean
          max_voters: number | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["elections"]["Row"], "id" | "created_at" | "updated_at">
        Update: Partial<Database["public"]["Tables"]["elections"]["Insert"]>
      }
      candidates: {
        Row: {
          id: string
          election_id: string
          candidate_number: number
          name: string
          running_mate: string | null
          short_bio: string | null
          vision: string | null
          mission: string | null
          photo_url: string | null
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["candidates"]["Row"], "id" | "created_at">
        Update: Partial<Database["public"]["Tables"]["candidates"]["Insert"]>
      }
      voters: {
        Row: {
          id: string
          election_id: string
          identifier: string
          name: string
          group_name: string | null
          email: string | null
          phone: string | null
          token_hash: string | null
          status: "UNINVITED" | "SENT" | "VOTED" | "BLOCKED"
          has_voted: boolean
          voted_at: string | null
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["voters"]["Row"], "id" | "created_at">
        Update: Partial<Database["public"]["Tables"]["voters"]["Insert"]>
      }
      votes: {
        Row: {
          id: string
          election_id: string
          candidate_id: string | null
          vote_hash: string
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["votes"]["Row"], "id" | "created_at">
        Update: Partial<Database["public"]["Tables"]["votes"]["Insert"]>
      }
      audit_logs: {
        Row: {
          id: string
          tenant_id: string | null
          election_id: string | null
          actor_id: string | null
          actor_label: string | null
          action: string
          meta: Json
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["audit_logs"]["Row"], "id" | "created_at">
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>
      }
      vote_sessions: {
        Row: {
          id: string
          voter_id: string
          election_id: string
          session_token_hash: string
          used: boolean
          expires_at: string
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["vote_sessions"]["Row"], "id" | "created_at">
        Update: Partial<Database["public"]["Tables"]["vote_sessions"]["Insert"]>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
