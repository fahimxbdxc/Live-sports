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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_hash: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_hash?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_hash?: string | null
        }
        Relationships: []
      }
      advertisements: {
        Row: {
          active: boolean
          created_at: string
          destination_url: string | null
          ends_at: string | null
          html_content: string | null
          id: string
          image_url: string | null
          name: string
          placement: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          destination_url?: string | null
          ends_at?: string | null
          html_content?: string | null
          id?: string
          image_url?: string | null
          name: string
          placement: string
          starts_at?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          destination_url?: string | null
          ends_at?: string | null
          html_content?: string | null
          id?: string
          image_url?: string | null
          name?: string
          placement?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string | null
          id: string
          link_url: string | null
          message_bn: string | null
          message_en: string
          priority: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          link_url?: string | null
          message_bn?: string | null
          message_en: string
          priority?: number
          starts_at?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          link_url?: string | null
          message_bn?: string | null
          message_en?: string
          priority?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      approved_sources: {
        Row: {
          active: boolean
          created_at: string
          embed_allowed: boolean
          id: string
          official_channel_id: string | null
          permission_reference: string
          permission_status: Database["public"]["Enums"]["permission_state"]
          provider_domain: string
          provider_name: string
          rights_expiry: string
          source_page_url: string
          source_type: Database["public"]["Enums"]["stream_source_type"]
          territory: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          embed_allowed?: boolean
          id?: string
          official_channel_id?: string | null
          permission_reference: string
          permission_status?: Database["public"]["Enums"]["permission_state"]
          provider_domain: string
          provider_name: string
          rights_expiry: string
          source_page_url: string
          source_type: Database["public"]["Enums"]["stream_source_type"]
          territory?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          embed_allowed?: boolean
          id?: string
          official_channel_id?: string | null
          permission_reference?: string
          permission_status?: Database["public"]["Enums"]["permission_state"]
          provider_domain?: string
          provider_name?: string
          rights_expiry?: string
          source_page_url?: string
          source_type?: Database["public"]["Enums"]["stream_source_type"]
          territory?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string | null
          id: string
          image_url: string | null
          link_url: string | null
          placement: string
          priority: number
          starts_at: string
          subtitle_bn: string | null
          subtitle_en: string | null
          title_bn: string | null
          title_en: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          placement: string
          priority?: number
          starts_at?: string
          subtitle_bn?: string | null
          subtitle_en?: string | null
          title_bn?: string | null
          title_en: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          placement?: string
          priority?: number
          starts_at?: string
          subtitle_bn?: string | null
          subtitle_en?: string | null
          title_bn?: string | null
          title_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      competitions: {
        Row: {
          active: boolean
          country: string | null
          created_at: string
          external_id: string | null
          external_provider: string | null
          featured: boolean
          id: string
          logo_url: string | null
          name: string
          position: number
          slug: string
          sport_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          country?: string | null
          created_at?: string
          external_id?: string | null
          external_provider?: string | null
          featured?: boolean
          id?: string
          logo_url?: string | null
          name: string
          position?: number
          slug: string
          sport_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          country?: string | null
          created_at?: string
          external_id?: string | null
          external_provider?: string | null
          featured?: boolean
          id?: string
          logo_url?: string | null
          name?: string
          position?: number
          slug?: string
          sport_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      content_rights: {
        Row: {
          active: boolean
          approved_source_id: string
          competition_id: string | null
          created_at: string
          expires_at: string
          id: string
          permission_reference: string
          starts_at: string
          territory: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          approved_source_id: string
          competition_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          permission_reference: string
          starts_at: string
          territory?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          approved_source_id?: string
          competition_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          permission_reference?: string
          starts_at?: string
          territory?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_rights_approved_source_id_fkey"
            columns: ["approved_source_id"]
            isOneToOne: false
            referencedRelation: "approved_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_rights_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      favourites: {
        Row: {
          created_at: string
          id: string
          match_id: string | null
          team_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id?: string | null
          team_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string | null
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourites_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favourites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      highlights: {
        Row: {
          active: boolean
          approved_source_id: string
          created_at: string
          id: string
          match_id: string | null
          provider_name: string
          published_at: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          active?: boolean
          approved_source_id: string
          created_at?: string
          id?: string
          match_id?: string | null
          provider_name: string
          published_at?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          active?: boolean
          approved_source_id?: string
          created_at?: string
          id?: string
          match_id?: string | null
          provider_name?: string
          published_at?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "highlights_approved_source_id_fkey"
            columns: ["approved_source_id"]
            isOneToOne: false
            referencedRelation: "approved_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "highlights_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_streams: {
        Row: {
          approved_source_id: string
          created_at: string
          embed_url: string | null
          expires_at: string | null
          id: string
          match_id: string
          priority: number
          provider_asset_id: string
          source_page_url: string
          source_type: Database["public"]["Enums"]["stream_source_type"]
          starts_at: string
          status: Database["public"]["Enums"]["stream_state"]
          territory: string[]
          updated_at: string
        }
        Insert: {
          approved_source_id: string
          created_at?: string
          embed_url?: string | null
          expires_at?: string | null
          id?: string
          match_id: string
          priority?: number
          provider_asset_id: string
          source_page_url: string
          source_type: Database["public"]["Enums"]["stream_source_type"]
          starts_at: string
          status?: Database["public"]["Enums"]["stream_state"]
          territory?: string[]
          updated_at?: string
        }
        Update: {
          approved_source_id?: string
          created_at?: string
          embed_url?: string | null
          expires_at?: string | null
          id?: string
          match_id?: string
          priority?: number
          provider_asset_id?: string
          source_page_url?: string
          source_type?: Database["public"]["Enums"]["stream_source_type"]
          starts_at?: string
          status?: Database["public"]["Enums"]["stream_state"]
          territory?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_streams_approved_source_id_fkey"
            columns: ["approved_source_id"]
            isOneToOne: false
            referencedRelation: "approved_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_streams_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number | null
          away_team_id: string
          clock: string | null
          competition_id: string
          created_at: string
          ends_at: string | null
          external_id: string | null
          external_provider: string | null
          featured: boolean
          home_score: number | null
          home_team_id: string
          id: string
          is_demo: boolean
          last_synced_at: string | null
          manually_corrected: boolean
          slug: string
          starts_at: string
          statistics: Json
          status: Database["public"]["Enums"]["match_status"]
          title: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_id: string
          clock?: string | null
          competition_id: string
          created_at?: string
          ends_at?: string | null
          external_id?: string | null
          external_provider?: string | null
          featured?: boolean
          home_score?: number | null
          home_team_id: string
          id?: string
          is_demo?: boolean
          last_synced_at?: string | null
          manually_corrected?: boolean
          slug: string
          starts_at: string
          statistics?: Json
          status?: Database["public"]["Enums"]["match_status"]
          title?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: string
          clock?: string | null
          competition_id?: string
          created_at?: string
          ends_at?: string | null
          external_id?: string | null
          external_provider?: string | null
          featured?: boolean
          home_score?: number | null
          home_team_id?: string
          id?: string
          is_demo?: boolean
          last_synced_at?: string | null
          manually_corrected?: boolean
          slug?: string
          starts_at?: string
          statistics?: Json
          status?: Database["public"]["Enums"]["match_status"]
          title?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          match_id: string | null
          read_at: string | null
          scheduled_for: string | null
          sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          id?: string
          match_id?: string | null
          read_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          match_id?: string | null
          read_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          body_bn: string | null
          body_en: string
          created_at: string
          id: string
          meta_description: string | null
          published: boolean
          slug: string
          title_bn: string | null
          title_en: string
          updated_at: string
        }
        Insert: {
          body_bn?: string | null
          body_en: string
          created_at?: string
          id?: string
          meta_description?: string | null
          published?: boolean
          slug: string
          title_bn?: string | null
          title_en: string
          updated_at?: string
        }
        Update: {
          body_bn?: string | null
          body_en?: string
          created_at?: string
          id?: string
          meta_description?: string | null
          published?: boolean
          slug?: string
          title_bn?: string | null
          title_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      playback_logs: {
        Row: {
          created_at: string
          error_code: string | null
          event_type: string
          id: string
          match_id: string | null
          match_stream_id: string | null
          metadata: Json
          session_hash: string | null
          territory: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          event_type: string
          id?: string
          match_id?: string | null
          match_stream_id?: string | null
          metadata?: Json
          session_hash?: string | null
          territory?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          event_type?: string
          id?: string
          match_id?: string | null
          match_stream_id?: string | null
          metadata?: Json
          session_hash?: string | null
          territory?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playback_logs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playback_logs_match_stream_id_fkey"
            columns: ["match_stream_id"]
            isOneToOne: false
            referencedRelation: "match_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          favourite_team_ids: string[]
          id: string
          language: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          favourite_team_ids?: string[]
          id: string
          language?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          favourite_team_ids?: string[]
          id?: string
          language?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          ads_enabled: boolean
          default_language: string
          discovery_interval_minutes: number
          discovery_threshold: number
          favicon_url: string | null
          footer_text: string
          id: number
          logo_url: string | null
          primary_color: string
          site_name: string
          social_links: Json
          tagline: string
          updated_at: string
        }
        Insert: {
          ads_enabled?: boolean
          default_language?: string
          discovery_interval_minutes?: number
          discovery_threshold?: number
          favicon_url?: string | null
          footer_text: string
          id?: number
          logo_url?: string | null
          primary_color?: string
          site_name?: string
          social_links?: Json
          tagline?: string
          updated_at?: string
        }
        Update: {
          ads_enabled?: boolean
          default_language?: string
          discovery_interval_minutes?: number
          discovery_threshold?: number
          favicon_url?: string | null
          footer_text?: string
          id?: number
          logo_url?: string | null
          primary_color?: string
          site_name?: string
          social_links?: Json
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      source_candidates: {
        Row: {
          approved_source_id: string
          confidence_score: number
          created_at: string
          discovered_at: string
          embed_url: string | null
          id: string
          match_id: string
          provider_asset_id: string
          review_status: Database["public"]["Enums"]["review_state"]
          reviewed_at: string | null
          reviewed_by: string | null
          source_page_url: string
          updated_at: string
          validation_reason: string | null
          validation_status: Database["public"]["Enums"]["validation_state"]
        }
        Insert: {
          approved_source_id: string
          confidence_score: number
          created_at?: string
          discovered_at?: string
          embed_url?: string | null
          id?: string
          match_id: string
          provider_asset_id: string
          review_status?: Database["public"]["Enums"]["review_state"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_page_url: string
          updated_at?: string
          validation_reason?: string | null
          validation_status?: Database["public"]["Enums"]["validation_state"]
        }
        Update: {
          approved_source_id?: string
          confidence_score?: number
          created_at?: string
          discovered_at?: string
          embed_url?: string | null
          id?: string
          match_id?: string
          provider_asset_id?: string
          review_status?: Database["public"]["Enums"]["review_state"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_page_url?: string
          updated_at?: string
          validation_reason?: string | null
          validation_status?: Database["public"]["Enums"]["validation_state"]
        }
        Relationships: [
          {
            foreignKeyName: "source_candidates_approved_source_id_fkey"
            columns: ["approved_source_id"]
            isOneToOne: false
            referencedRelation: "approved_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_candidates_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          active: boolean
          created_at: string
          icon: string | null
          id: string
          name: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          error_message: string | null
          finished_at: string | null
          id: string
          job_type: string
          metadata: Json
          provider: string | null
          records_processed: number
          started_at: string
          status: Database["public"]["Enums"]["job_state"]
        }
        Insert: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_type: string
          metadata?: Json
          provider?: string | null
          records_processed?: number
          started_at?: string
          status?: Database["public"]["Enums"]["job_state"]
        }
        Update: {
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_type?: string
          metadata?: Json
          provider?: string | null
          records_processed?: number
          started_at?: string
          status?: Database["public"]["Enums"]["job_state"]
        }
        Relationships: []
      }
      teams: {
        Row: {
          active: boolean
          country: string | null
          created_at: string
          external_id: string | null
          external_provider: string | null
          id: string
          logo_url: string | null
          name: string
          short_name: string
          slug: string
          sport_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          country?: string | null
          created_at?: string
          external_id?: string | null
          external_provider?: string | null
          id?: string
          logo_url?: string | null
          name: string
          short_name: string
          slug: string
          sport_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          country?: string | null
          created_at?: string
          external_id?: string | null
          external_provider?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          short_name?: string
          slug?: string
          sport_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "user" | "admin"
      job_state: "running" | "success" | "failed" | "skipped"
      match_status:
        | "scheduled"
        | "live"
        | "halftime"
        | "finished"
        | "postponed"
        | "cancelled"
      permission_state: "pending" | "approved" | "rejected" | "expired"
      review_state: "pending" | "approved" | "rejected"
      stream_source_type:
        | "youtube_embed"
        | "official_embed"
        | "licensed_hls"
        | "licensed_dash"
        | "external_official_link"
      stream_state: "active" | "disabled" | "expired"
      validation_state:
        | "pending"
        | "valid"
        | "invalid"
        | "expired"
        | "territory_blocked"
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
      app_role: ["user", "admin"],
      job_state: ["running", "success", "failed", "skipped"],
      match_status: [
        "scheduled",
        "live",
        "halftime",
        "finished",
        "postponed",
        "cancelled",
      ],
      permission_state: ["pending", "approved", "rejected", "expired"],
      review_state: ["pending", "approved", "rejected"],
      stream_source_type: [
        "youtube_embed",
        "official_embed",
        "licensed_hls",
        "licensed_dash",
        "external_official_link",
      ],
      stream_state: ["active", "disabled", "expired"],
      validation_state: [
        "pending",
        "valid",
        "invalid",
        "expired",
        "territory_blocked",
      ],
    },
  },
} as const

