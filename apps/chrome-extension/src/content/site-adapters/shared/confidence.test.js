import { describe, expect, it } from 'vitest';
import { scoreConfidence } from './confidence.js';

describe('scoreConfidence', () => {
  it('caps heuristic extraction at low confidence', () => {
    const result = scoreConfidence({
      description: 'x'.repeat(2000),
      descriptionProvenance: 'heuristic',
    });
    expect(result.confidence).toBe('low');
  });

  it('marks expanded testid text as high confidence when long enough', () => {
    const result = scoreConfidence({
      description: `${'x'.repeat(799)}.`,
      descriptionProvenance: 'testid_expanded',
    });
    expect(result.confidence).toBe('high');
  });
});
