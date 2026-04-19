import { describe, expect, it } from 'vitest';

describe('test tooling', () => {
  it('runs a trivial assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('has a DOM via jsdom', () => {
    document.body.innerHTML = '<p data-testid="x">hi</p>';
    expect(document.querySelector('[data-testid="x"]')?.textContent).toBe('hi');
  });
});
