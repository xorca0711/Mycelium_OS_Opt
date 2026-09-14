export interface LinkDocument { id: string; title: string | null; aliases?: readonly string[] }
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const normalize = (title: string) => title.trim().toLowerCase();

/** Explicit IDs never fall back to a different document, even after deletion or renaming. */
export function resolveWikiTarget(
  attrs: { targetId?: unknown; title?: unknown }, documents: readonly LinkDocument[],
): string | null {
  if (typeof attrs.targetId === 'string' && attrs.targetId) {
    return documents.some(doc => doc.id === attrs.targetId) ? attrs.targetId : null;
  }
  if (typeof attrs.title !== 'string' || !attrs.title.trim()) return null;
  const title = normalize(attrs.title);
  const matches = documents.filter(doc => [doc.title ?? '', ...(doc.aliases ?? [])].some(t => normalize(t) === title));
  return matches.length === 1 ? matches[0].id : null;
}

export function prepareDocumentLinks(sourceId: string, contentJson: string, documents: readonly LinkDocument[]): {
  contentJson: string; targetIds: string[];
} {
  const content: unknown = JSON.parse(contentJson);
  if (!record(content) || content.type !== 'doc') throw new Error('Document content must be a JSON document.');
  const targets = new Set<string>();
  function visit(node: unknown): void {
    if (!record(node)) return;
    if (node.type === 'wikiLink' && record(node.attrs)) {
      const targetId = resolveWikiTarget(node.attrs, documents);
      if (targetId) {
        node.attrs.targetId = targetId;
        if (targetId !== sourceId) targets.add(targetId);
      }
    }
    if (Array.isArray(node.content)) node.content.forEach(visit);
  }
  visit(content);
  return { contentJson: JSON.stringify(content), targetIds: [...targets] };
}
