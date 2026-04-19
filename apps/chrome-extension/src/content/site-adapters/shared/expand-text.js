export async function tryExpandJobDescription(doc, opts = {}) {
  const waitMs = opts.waitMs ?? 150;
  const region =
    doc.querySelector('[data-testid="job-details"]') ||
    doc.querySelector('[data-testid="expandable-text-box"]')?.closest('section, article, div') ||
    doc;
  const box = region.querySelector('[data-testid="expandable-text-box"]');
  const button = region.querySelector('[data-testid="expandable-text-button"]');
  const before = (box?.textContent || '').length;

  if (!box || !button) {
    return {
      expandedAttempted: false,
      expandedSucceeded: false,
      textLengthBefore: before,
      textLengthAfter: before,
    };
  }

  const clickableTargets = [
    button,
    button.querySelector('[style*="pointer-events: auto"]'),
    ...Array.from(button.querySelectorAll('span, div')).filter((node) =>
      /more|see more|show more/i.test((node.textContent || '').replace(/\s+/g, ' ').trim()),
    ),
  ].filter((node, index, list) => node && list.indexOf(node) === index);

  for (const target of clickableTargets) {
    try {
      target.click();
    } catch {}
    try {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }));
    } catch {}
  }

  await new Promise((resolve) => setTimeout(resolve, waitMs));
  const after = (box.textContent || '').length;
  return {
    expandedAttempted: true,
    expandedSucceeded: after > before,
    textLengthBefore: before,
    textLengthAfter: after,
  };
}
