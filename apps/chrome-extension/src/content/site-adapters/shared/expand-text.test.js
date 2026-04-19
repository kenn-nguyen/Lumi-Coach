import { describe, expect, it } from 'vitest';
import { tryExpandJobDescription } from './expand-text.js';

describe('tryExpandJobDescription', () => {
  it('expands through a nested clickable span', async () => {
    document.body.innerHTML = `
      <div data-testid="job-details">
        <span data-testid="expandable-text-box">${'x'.repeat(200)}</span>
        <button data-testid="expandable-text-button" aria-hidden="true" style="pointer-events: none;">
          <span style="pointer-events: auto;">... more</span>
        </button>
      </div>
    `;
    const box = document.querySelector('[data-testid="expandable-text-box"]');
    const nested = document.querySelector('[style*="pointer-events: auto"]');
    nested.addEventListener('click', () => {
      box.textContent = 'x'.repeat(900);
    });
    const result = await tryExpandJobDescription(document, { waitMs: 0 });
    expect(result.expandedAttempted).toBe(true);
    expect(result.expandedSucceeded).toBe(true);
    expect(result.textLengthBefore).toBe(200);
    expect(result.textLengthAfter).toBe(900);
  });
});
