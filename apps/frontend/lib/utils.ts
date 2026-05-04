import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type DateDisplayMode } from '@/lib/types/template-settings';

/**
 * Combines multiple class names or class name objects into a single string.
 * Uses clsx for conditional class logic.
 *
 * @param inputs - Class values to be combined (strings, objects, arrays)
 * @returns A string of combined class names
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date range string with a hyphen separator for ATS compatibility.
 * Uses ASCII hyphen-minus (-) instead of en-dash for reliable PDF text extraction.
 *
 * Handles various input formats:
 * - "Jun 2025 Aug 2025" → "Jun 2025 - Aug 2025"
 * - "Jun 2025 - Aug 2025" → "Jun 2025 - Aug 2025"
 * - "2023 2025" → "2023 - 2025"
 * - "Present" → "Present" (no change for single dates)
 *
 * @param dateString - The date range string to format
 * @param options - Optional date display mode for rendered output
 * @returns Formatted date string with hyphen separator
 */
export function formatDateRange(
  dateString: string | undefined | null,
  options?: { dateDisplay?: DateDisplayMode }
): string {
  if (!dateString) return '';

  const normalized = normalizeDateRangeSeparators(dateString);

  if (options?.dateDisplay === 'year-only') {
    return formatYearOnlyDateRange(dateString, normalized);
  }

  return normalized;
}

function normalizeDateRangeSeparators(dateString: string): string {
  // Normalize any existing dashes (en-dash, em-dash) to hyphen-minus for ATS compatibility
  let formatted = dateString.replace(/[–—]/g, '-');

  // Normalize spacing around existing hyphens
  formatted = formatted.replace(/\s*-\s*/g, ' - ');

  // Handle "Jun 2025 Aug 2025" pattern (month year month year without separator)
  // Match: word/abbrev + 4-digit year + space + word/abbrev + 4-digit year
  formatted = formatted.replace(/([A-Za-z]+\.?\s+\d{4})\s+([A-Za-z]+\.?\s+\d{4})/g, '$1 - $2');

  // Handle "2023 2025" pattern (year year without separator)
  formatted = formatted.replace(/(\d{4})\s+(\d{4})/g, '$1 - $2');

  // Handle "Jun 2025 Present" pattern
  formatted = formatted.replace(
    /([A-Za-z]+\.?\s+\d{4})\s+(Present|Current|Now|Ongoing)/gi,
    '$1 - $2'
  );

  return formatted;
}

const YEAR_PATTERN = '(?:19|20)\\d{2}';
const MONTH_PATTERN =
  '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\\.?';
const MONTH_YEAR_PATTERN = `${MONTH_PATTERN}\\s+${YEAR_PATTERN}`;
const NUMERIC_MONTH_YEAR_PATTERN = `(?:0?[1-9]|1[0-2])\\/${YEAR_PATTERN}`;
const DATE_PART_PATTERN = `(?:${MONTH_YEAR_PATTERN}|${NUMERIC_MONTH_YEAR_PATTERN}|${YEAR_PATTERN})`;
const PRESENT_PATTERN = '(?:Present|Current|Now|Ongoing)';
const AMBIGUOUS_DATE_PATTERN = /\b(?:Spring|Summer|Fall|Autumn|Winter|Q[1-4]|Class\s+of)\b/i;

const SINGLE_SUPPORTED_DATE_RE = new RegExp(`^${DATE_PART_PATTERN}$`, 'i');
const SUPPORTED_RANGE_RE = new RegExp(
  `^(${DATE_PART_PATTERN})\\s+-\\s+(${DATE_PART_PATTERN})$`,
  'i'
);
const PRESENT_RANGE_RE = new RegExp(
  `^(${DATE_PART_PATTERN})(?:\\s+-\\s+|\\s+)(${PRESENT_PATTERN})$`,
  'i'
);
const YEAR_RE = new RegExp(YEAR_PATTERN);

function formatYearOnlyDateRange(original: string, normalized: string): string {
  const compact = normalized.trim().replace(/\s+/g, ' ');

  if (!compact || AMBIGUOUS_DATE_PATTERN.test(compact)) {
    return original;
  }

  const presentMatch = compact.match(PRESENT_RANGE_RE);
  if (presentMatch) {
    return `${extractYear(presentMatch[1])} - ${normalizePresentLabel(presentMatch[2])}`;
  }

  const rangeMatch = compact.match(SUPPORTED_RANGE_RE);
  if (rangeMatch) {
    return `${extractYear(rangeMatch[1])} - ${extractYear(rangeMatch[2])}`;
  }

  if (SINGLE_SUPPORTED_DATE_RE.test(compact)) {
    return extractYear(compact);
  }

  return original;
}

function extractYear(value: string): string {
  return value.match(YEAR_RE)?.[0] ?? value;
}

function normalizePresentLabel(value: string): string {
  const lower = value.toLowerCase();
  if (lower === 'current') return 'Current';
  if (lower === 'now') return 'Now';
  if (lower === 'ongoing') return 'Ongoing';
  return 'Present';
}
