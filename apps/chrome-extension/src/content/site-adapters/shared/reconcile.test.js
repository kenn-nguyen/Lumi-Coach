import { describe, expect, it } from 'vitest';
import { reconcile } from './reconcile.js';

describe('reconcile', () => {
  it('prefers a longer DOM description over JSON-LD', () => {
    const result = reconcile({
      ld: { description: 'short', company: 'Red Gold' },
      testid: { description: 'x'.repeat(300), descriptionProvenance: 'testid', company: 'Red Gold' },
    });
    expect(result.description.length).toBe(300);
    expect(result.provenance.description).toBe('testid');
  });

  it('falls back to heuristic when stronger sources are empty', () => {
    const result = reconcile({
      ld: {},
      testid: {},
      classes: {},
      heuristic: { description: 'Fallback text', descriptionProvenance: 'heuristic' },
    });
    expect(result.description).toBe('Fallback text');
    expect(result.provenance.description).toBe('heuristic');
  });
});
