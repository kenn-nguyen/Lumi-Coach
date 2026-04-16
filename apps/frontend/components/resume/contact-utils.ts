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

  let finalHrefPrefix = hrefPrefix;
  if (
    ['Website', 'LinkedIn', 'GitHub'].includes(resolvedLabel) &&
    !trimmedValue.startsWith('http') &&
    !trimmedValue.startsWith('//')
  ) {
    finalHrefPrefix = 'https://';
  }

  const href = finalHrefPrefix + trimmedValue;
  const isLink =
    finalHrefPrefix.startsWith('http') ||
    finalHrefPrefix.startsWith('mailto:') ||
    finalHrefPrefix.startsWith('tel:');

  const socialSlug = isLink ? extractSocialSlug(resolvedLabel, trimmedValue) : null;

  let displayText = trimmedValue;
  if (isLink && ['LinkedIn', 'GitHub', 'Website'].includes(resolvedLabel)) {
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
