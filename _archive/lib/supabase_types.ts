/**
 * Supabase Database type interface.
 *
 * Mirrors the Supabase schema defined in `supabase/schema.sql`.
 * Each table has Row (read), Insert (create), and Update (patch) shapes.
 * Used for type-safe queries throughout the app and converters.
 */
export interface Database {
  public: {
    Tables: {
      /** Brainstorming sessions -- one per room, created by the host. */
      sessions: {
        Row: {
          id: string;
          room_name: string;
          scenario: string;
          language: string;
          config: Record<string, unknown>;
          host_identity: string;
          started_at: string;
          ended_at: string | null;
          last_heartbeat: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_name: string;
          scenario: string;
          language: string;
          config: Record<string, unknown>;
          host_identity: string;
          started_at?: string;
          ended_at?: string | null;
          last_heartbeat?: string | null;
          created_at?: string;
        };
        Update: {
          ended_at?: string | null;
          last_heartbeat?: string | null;
        };
      };
      /** Participants who joined a session, tracked for presence and roles. */
      session_participants: {
        Row: {
          id: string;
          session_id: string;
          identity: string;
          display_name: string;
          role: string;
          joined_at: string;
          last_heartbeat: string;
          left_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          identity: string;
          display_name: string;
          role?: string;
          joined_at?: string;
          last_heartbeat?: string;
          left_at?: string | null;
        };
        Update: {
          last_heartbeat?: string;
          left_at?: string | null;
        };
      };
      /** Speech-to-text transcript segments with speaker attribution. */
      transcript_segments: {
        Row: {
          id: string;
          session_id: string;
          speaker: string;
          text: string;
          language: string | null;
          timestamp: number;
          is_final: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          session_id: string;
          speaker: string;
          text: string;
          language?: string | null;
          timestamp: number;
          is_final?: boolean;
          created_at?: string;
        };
        Update: {
          text?: string;
          is_final?: boolean;
        };
      };
      /** Periodic snapshots of computed participation and semantic metrics. */
      metric_snapshots: {
        Row: {
          id: string;
          session_id: string;
          timestamp: number;
          metrics: Record<string, unknown>;
          state_inference: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          timestamp: number;
          metrics: Record<string, unknown>;
          state_inference?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      /** AI-generated moderator and ally interventions with delivery status. */
      interventions: {
        Row: {
          id: string;
          session_id: string;
          type: string;
          intent: string | null;
          trigger: string | null;
          message: string;
          timestamp: number;
          status: string;
          delivered_at: number | null;
          metrics_at_intervention: Record<string, unknown> | null;
          engine_state_snapshot: Record<string, unknown> | null;
          model: string | null;
          recovery_result: string | null;
          recovery_checked_at: number | null;
          rule_violated: string | null;
          rule_evidence: string | null;
          rule_severity: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          session_id: string;
          type: string;
          intent?: string | null;
          trigger?: string | null;
          message: string;
          timestamp: number;
          status?: string;
          delivered_at?: number | null;
          metrics_at_intervention?: Record<string, unknown> | null;
          engine_state_snapshot?: Record<string, unknown> | null;
          model?: string | null;
          recovery_result?: string | null;
          rule_violated?: string | null;
          rule_evidence?: string | null;
          rule_severity?: string | null;
          created_at?: string;
        };
        Update: {
          status?: string;
          delivered_at?: number | null;
          recovery_result?: string | null;
          recovery_checked_at?: number | null;
          rule_violated?: string | null;
          rule_evidence?: string | null;
          rule_severity?: string | null;
        };
      };
      /** Decision engine state (one row per session, upserted on phase changes). */
      engine_state: {
        Row: {
          session_id: string;
          phase: string;
          active_intent: string | null;
          confirmation_start: number | null;
          last_intervention_time: number | null;
          intervention_count: number;
          decision_owner: string | null;
          decision_heartbeat: string | null;
          updated_at: string;
        };
        Insert: {
          session_id: string;
          phase?: string;
          active_intent?: string | null;
          confirmation_start?: number | null;
          last_intervention_time?: number | null;
          intervention_count?: number;
          decision_owner?: string | null;
          decision_heartbeat?: string | null;
          updated_at?: string;
        };
        Update: {
          phase?: string;
          active_intent?: string | null;
          confirmation_start?: number | null;
          last_intervention_time?: number | null;
          intervention_count?: number;
          decision_owner?: string | null;
          decision_heartbeat?: string | null;
          updated_at?: string;
        };
      };
      /** Brainstorming ideas extracted from transcript or added manually. */
      ideas: {
        Row: {
          id: string;
          session_id: string;
          title: string;
          description: string | null;
          author: string;
          source: string;
          source_segment_ids: string[];
          position_x: number;
          position_y: number;
          color: string;
          is_deleted: boolean;
          idea_type: string;
          parent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          session_id: string;
          title: string;
          description?: string | null;
          author: string;
          source?: string;
          source_segment_ids?: string[];
          position_x?: number;
          position_y?: number;
          color?: string;
          is_deleted?: boolean;
          idea_type?: string;
          parent_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          position_x?: number;
          position_y?: number;
          color?: string;
          is_deleted?: boolean;
          idea_type?: string;
          parent_id?: string | null;
          updated_at?: string;
        };
      };
      /** Edges between ideas on the idea board (builds_on, contrasts, etc.). */
      idea_connections: {
        Row: {
          id: string;
          session_id: string;
          source_idea_id: string;
          target_idea_id: string;
          label: string | null;
          connection_type: string;
          created_at: string;
        };
        Insert: {
          id: string;
          session_id: string;
          source_idea_id: string;
          target_idea_id: string;
          label?: string | null;
          connection_type?: string;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      /** Per-call LLM routing logs (model, latency, tokens, errors). */
      model_routing_logs: {
        Row: {
          id: string;
          session_id: string;
          timestamp: number;
          route: string;
          model: string | null;
          latency_ms: number | null;
          token_count: number | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          timestamp: number;
          route: string;
          model?: string | null;
          latency_ms?: number | null;
          token_count?: number | null;
          error?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      /** Post-hoc annotations on interventions (rating, relevance, notes). */
      intervention_annotations: {
        Row: {
          id: string;
          intervention_id: string;
          session_id: string;
          rating: number | null;
          relevance: string | null;
          effectiveness: string | null;
          notes: string | null;
          annotator: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          intervention_id: string;
          session_id: string;
          rating?: number | null;
          relevance?: string | null;
          effectiveness?: string | null;
          notes?: string | null;
          annotator?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          rating?: number | null;
          relevance?: string | null;
          effectiveness?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };
      /** Client-side errors logged during a session for debugging. */
      session_errors: {
        Row: {
          id: string;
          session_id: string;
          timestamp: number;
          message: string;
          context: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          timestamp: number;
          message: string;
          context?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      /** Session lifecycle events (start, join, leave, end) for timeline analysis. */
      session_events: {
        Row: {
          id: string;
          session_id: string;
          event_type: string;
          payload: Record<string, unknown> | null;
          actor: string | null;
          timestamp: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          event_type: string;
          payload?: Record<string, unknown> | null;
          actor?: string | null;
          timestamp: number;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
    };
  };
}
