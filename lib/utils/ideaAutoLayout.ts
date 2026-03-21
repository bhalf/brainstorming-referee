import dagre from '@dagrejs/dagre';
import type { Idea, IdeaConnection } from '@/types';

const NODE_DIMS: Record<string, { width: number; height: number }> = {
  brainstorming_idea: { width: 200, height: 150 },
  ally_intervention:  { width: 200, height: 150 },
  action_item:        { width: 200, height: 120 },
  design_decision:    { width: 200, height: 150 },
  research_question:  { width: 200, height: 150 },
};

const DEFAULT_DIMS = { width: 200, height: 150 };

/**
 * Compute non-overlapping positions for ideas using dagre graph layout.
 *
 * Connections are used as directed edges so connected ideas form a hierarchy.
 * Disconnected ideas are laid out in separate components automatically.
 *
 * @returns Map from idea ID to top-left {x, y} canvas coordinates.
 */
export function computeIdeaLayout(
  ideas: Idea[],
  connections: IdeaConnection[],
): Map<string, { x: number; y: number }> {
  if (ideas.length === 0) return new Map();

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'LR',
    nodesep: 50,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const ideaIdSet = new Set(ideas.map((i) => i.id));

  for (const idea of ideas) {
    const dims = NODE_DIMS[idea.idea_type] ?? DEFAULT_DIMS;
    g.setNode(idea.id, { width: dims.width, height: dims.height });
  }

  for (const conn of connections) {
    if (ideaIdSet.has(conn.source_idea_id) && ideaIdSet.has(conn.target_idea_id)) {
      g.setEdge(conn.source_idea_id, conn.target_idea_id);
    }
  }

  dagre.layout(g);

  // Dagre returns center coordinates; React Flow uses top-left
  const positions = new Map<string, { x: number; y: number }>();
  for (const id of g.nodes()) {
    const node = g.node(id);
    if (node) {
      positions.set(id, {
        x: node.x - node.width / 2,
        y: node.y - node.height / 2,
      });
    }
  }
  return positions;
}
