import React from 'react';
import Github from 'lucide-react/dist/esm/icons/github';
import ExternalLink from 'lucide-react/dist/esm/icons/external-link';
import baseStyles from './styles/_base.module.css';

type ResumeLinkKind = 'github' | 'website';

interface ResumeLinkDisplay {
  href: string;
  displayText: string;
}

interface ResumeLinkPillProps {
  value?: string | null;
  kind: ResumeLinkKind;
  iconSize?: number;
}

const URL_WITH_PROTOCOL_RE = /^(https?:)?\/\//i;

export function buildResumeLinkDisplay(value?: string | null): ResumeLinkDisplay | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  return {
    href: URL_WITH_PROTOCOL_RE.test(trimmed) ? trimmed : `https://${trimmed}`,
    displayText: trimmed
      .replace(/^https?:\/\//i, '')
      .replace(/^\/\//, '')
      .replace(/^www\./i, '')
      .replace(/\/$/, ''),
  };
}

export const ResumeLinkPill: React.FC<ResumeLinkPillProps> = ({ value, kind, iconSize = 10 }) => {
  const link = buildResumeLinkDisplay(value);
  if (!link) return null;

  const Icon = kind === 'github' ? Github : ExternalLink;

  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className={baseStyles['resume-link-pill']}
    >
      <Icon size={iconSize} />
      {link.displayText}
    </a>
  );
};
