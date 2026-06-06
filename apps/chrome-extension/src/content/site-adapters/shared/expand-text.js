const EXPAND_LABEL_PATTERN = /\b(show|see|read)\s+more\b|\bexpand\b/i;
const COLLAPSE_LABEL_PATTERN = /\b(show|see|read)\s+less\b|\bcollapse\b/i;

export function getExpandableTextButtonState(button) {
  if (!(button instanceof Element)) return "missing";

  const ariaExpanded = (button.getAttribute("aria-expanded") || "")
    .trim()
    .toLowerCase();
  if (ariaExpanded === "true") return "expanded";
  if (ariaExpanded === "false") return "collapsed";

  const label = [
    button.getAttribute("aria-label"),
    button.getAttribute("title"),
    button.textContent,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (COLLAPSE_LABEL_PATTERN.test(label)) return "expanded";
  if (EXPAND_LABEL_PATTERN.test(label)) return "collapsed";
  return "collapsed";
}

export async function tryExpandJobDescription(doc, opts = {}) {
  const waitMs = opts.waitMs ?? 150;
  const region =
    doc.querySelector('[data-testid="job-details"]') ||
    doc.querySelector('[data-testid="expandable-text-box"]')?.closest('section, article, div') ||
    doc;
  const box = region.querySelector('[data-testid="expandable-text-box"]');
  const button = region.querySelector('[data-testid="expandable-text-button"]');
  const before = (box?.textContent || '').length;
  const buttonState = getExpandableTextButtonState(button);

  if (!box || !button || buttonState === "expanded") {
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
      EXPAND_LABEL_PATTERN.test((node.textContent || '').replace(/\s+/g, ' ').trim()),
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
