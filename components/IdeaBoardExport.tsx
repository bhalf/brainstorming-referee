'use client';

import { Idea, IdeaConnection } from '@/lib/types';

// --- Markdown generation ---

function generateIdeaBoardMarkdown(
    ideas: Idea[],
    connections: IdeaConnection[],
    roomName: string,
): string {
    const active = ideas.filter(i => !i.isDeleted);
    const categories = active.filter(i => i.ideaType === 'category');
    const standalone = active.filter(i => i.ideaType !== 'category' && !i.parentId);
    const now = new Date().toLocaleString();

    const lines: string[] = [];

    lines.push(`# Idea Board — ${roomName}`);
    lines.push(`> Exported on ${now} · ${active.length} ideas, ${connections.length} connections`);
    lines.push('');

    // Categories with child ideas
    if (categories.length > 0) {
        lines.push('## Categories');
        lines.push('');
        for (const cat of categories) {
            lines.push(`### 📁 ${cat.title}`);
            if (cat.description) lines.push(`> ${cat.description}`);
            const children = active.filter(i => i.parentId === cat.id && i.ideaType !== 'category');
            if (children.length > 0) {
                lines.push('');
                for (const child of children) {
                    lines.push(`- **${child.title}** (${child.author})${child.description ? `  \n  ${child.description}` : ''}`);
                }
            } else {
                lines.push('_No ideas in this category yet._');
            }
            lines.push('');
        }
    }

    // Standalone ideas
    if (standalone.length > 0) {
        lines.push('## Ideas');
        lines.push('');
        for (const idea of standalone) {
            lines.push(`- **${idea.title}** (${idea.author})${idea.description ? `  \n  ${idea.description}` : ''}`);
        }
        lines.push('');
    }

    // Connections
    if (connections.length > 0) {
        const idToTitle = new Map(active.map(i => [i.id, i.title]));
        lines.push('## Connections');
        lines.push('');
        for (const conn of connections) {
            const src = idToTitle.get(conn.sourceIdeaId) || '?';
            const tgt = idToTitle.get(conn.targetIdeaId) || '?';
            const type = conn.connectionType.replace('_', ' ');
            lines.push(`- ${src} → ${tgt} _(${type}${conn.label ? `: ${conn.label}` : ''})_`);
        }
        lines.push('');
    }

    return lines.join('\n');
}

// --- Download trigger ---

export function downloadIdeaBoard(
    ideas: Idea[],
    connections: IdeaConnection[],
    roomName: string,
): void {
    const markdown = generateIdeaBoardMarkdown(ideas, connections, roomName);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `idea-board-${roomName}-${timestamp}.md`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
