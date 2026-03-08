export interface Database {
  public: {
    Tables: {
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
          created_at?: string;
        };
        Update: {
          status?: string;
          delivered_at?: number | null;
        };
      };
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
    };
  };
}
