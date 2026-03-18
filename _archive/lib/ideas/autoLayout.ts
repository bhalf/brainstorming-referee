/**
 * Auto-layout utility using dagre for hierarchical graph layout.
 *
 * Computes ideal positions for ideas on the canvas based on their
 * connections and parent-child relationships.
 * @module
 */

import dagre from '@dagrejs/dagre';
import type { Idea, IdeaConnection } from '@/lib/types';

/**
 * Compute auto-layout positions for ideas using dagre's directed graph layout.
 *
 * Ideas become graph nodes sized by their type; connections and parent→child
 * links become edges. The result is a map of idea IDs to {x, y} positions.
 *
 * @param ideas - Active (non-deleted) ideas to lay out.
 * @param connections - Active connections between ideas.
 * @returns A Map from idea ID to computed {x, y} canvas coordinates.
 */
export function computeAutoLayout(
  ideas: Idea[],
  connections: IdeaConnection[],
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    nodesep: 60,
    ranksep: 80,
    marginx: 40,
    marginy: 40,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const ideaIdSet = new Set(ideas.map(i => i.id));

  for (const idea of ideas) {
    const w = idea.ideaType === 'category' ? 280 : 200;
    const h = idea.ideaType === 'action_item' ? 100 : idea.ideaType === 'category' ? 80 : 130;
    g.setNode(idea.id, { width: w, height: h });
  }

  // Add connection edges
  for (const conn of connections) {
    if (ideaIdSet.has(conn.sourceIdeaId) && ideaIdSet.has(conn.targetIdeaId)) {
      g.setEdge(conn.sourceIdeaId, conn.targetIdeaId);
    }
  }

  // Add parent→child edges
  for (const idea of ideas) {
    if (idea.parentId && ideaIdSet.has(idea.parentId)) {
      // Only add if not already an edge (avoid duplicates)
      if (!g.hasEdge(idea.parentId, idea.id)) {
        g.setEdge(idea.parentId, idea.id);
      }
    }
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const id of g.nodes()) {
    const node = g.node(id);
    if (node) positions.set(id, { x: node.x, y: node.y });
  }
  return positions;
}
