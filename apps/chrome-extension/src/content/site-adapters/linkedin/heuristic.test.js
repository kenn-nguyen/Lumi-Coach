import { describe, expect, it } from 'vitest';
import { extractHeuristic } from './heuristic.js';

describe('extractHeuristic', () => {
  it('extracts text near an About the job heading', () => {
    document.body.innerHTML = `
      <section>
        <h2>About the job</h2>
        <p>Paragraph one with enough detail to matter.</p>
        <p>Paragraph two describing responsibilities and qualifications.</p>
      </section>
    `;
    const result = extractHeuristic(document);
    expect(result.description).toContain('Paragraph one');
    expect(result.descriptionProvenance).toBe('heuristic');
  });
});
