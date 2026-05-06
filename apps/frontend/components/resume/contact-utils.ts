interface ContactDisplay {
  href: string;
  isLink: boolean;
  displayText: string;
  socialSlug: string | null;
  resolvedLabel: string;
}

function stripProtocolAndWww(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^\/\//, '')
    .replace(/^www\./i, '')
    .replace(/[?#].*$/, '');
}

function extractSocialSlug(label: string, value: string): string | null {
  const normalized = stripProtocolAndWww(value).replace(/\/+$/, '');

  if (label === 'LinkedIn') {
    const withoutDomain = normalized.replace(/^linkedin\.com\//i, '');
    const slug = withoutDomain.replace(/^(in|pub)\//i, '').replace(/\/+$/, '');
    return slug || null;
  }

  if (label === 'GitHub') {
    const withoutDomain = normalized.replace(/^github\.com\//i, '');
    const slug = withoutDomain.split('/')[0]?.trim();
    return slug || null;
  }

  return null;
}

function inferContactLabel(label: string, value: string): string {
  const normalized = stripProtocolAndWww(value).toLowerCase();
  if (normalized.startsWith('linkedin.com/')) {
    return 'LinkedIn';
  }
  if (normalized.startsWith('github.com/')) {
    return 'GitHub';
  }
  return label;
}

function buildSocialHref(label: string, value: string, hrefPrefix: string): string {
  const trimmedValue = value.trim();
  const normalized = stripProtocolAndWww(trimmedValue).replace(/^@/, '');

  if (trimmedValue.startsWith('http') || trimmedValue.startsWith('//')) {
    return trimmedValue;
  }

  if (label === 'LinkedIn') {
    const slug = extractSocialSlug(label, trimmedValue);
    if (!slug) return '';
    return `https://www.linkedin.com/in/${slug}`;
  }

  if (label === 'GitHub') {
    const slug = extractSocialSlug(label, trimmedValue);
    if (!slug) return '';
    return `https://github.com/${slug}`;
  }

  if (hrefPrefix) {
    return `${hrefPrefix}${trimmedValue}`;
  }

  if (label === 'Website' && normalized) {
    return `https://${trimmedValue}`;
  }

  return trimmedValue;
}

function isExplicitUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim()) || value.trim().startsWith('//');
}

export function buildContactDisplay(
  label: string,
  value: string | null | undefined,
  hrefPrefix: string = ''
): ContactDisplay {
  if (!value) {
    return {
      href: '',
      isLink: false,
      displayText: '',
      socialSlug: null,
      resolvedLabel: label,
    };
  }

  const trimmedValue = value.trim();
  const resolvedLabel = inferContactLabel(label, trimmedValue);
  const explicitUrl = isExplicitUrl(trimmedValue);
  const explicitSocialUrl =
    explicitUrl && (resolvedLabel === 'LinkedIn' || resolvedLabel === 'GitHub');

  let finalHrefPrefix = hrefPrefix;
  if (
    resolvedLabel === 'Website' &&
    !trimmedValue.startsWith('http') &&
    !trimmedValue.startsWith('//')
  ) {
    finalHrefPrefix = 'https://';
  }

  const href = ['LinkedIn', 'GitHub', 'Website'].includes(resolvedLabel)
    ? buildSocialHref(resolvedLabel, trimmedValue, finalHrefPrefix)
    : finalHrefPrefix + trimmedValue;
  const isLink =
    href.startsWith('http') ||
    href.startsWith('//') ||
    finalHrefPrefix.startsWith('mailto:') ||
    finalHrefPrefix.startsWith('tel:');

  const socialSlug =
    isLink && !explicitSocialUrl ? extractSocialSlug(resolvedLabel, trimmedValue) : null;

  let displayText = trimmedValue;
  if (isLink && ['LinkedIn', 'GitHub', 'Website'].includes(resolvedLabel) && !explicitSocialUrl) {
    displayText = stripProtocolAndWww(trimmedValue);
  }

  return {
    href,
    isLink,
    displayText,
    socialSlug,
    resolvedLabel,
  };
}
