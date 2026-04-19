export function extractHeuristic(doc) {
  const headings = doc.querySelectorAll('h1,h2,h3');
  for (const heading of headings) {
    if (!/about the job/i.test(heading.textContent || '')) continue;
    const container = heading.closest('section, article, div');
    if (!container) continue;
    const blocks = Array.from(container.querySelectorAll('p, li'))
      .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const text = blocks.join('\n').trim();
    if (text.length > 0) {
      return { description: text, descriptionProvenance: 'heuristic' };
    }
  }
  return { description: '', descriptionProvenance: 'missing' };
}
