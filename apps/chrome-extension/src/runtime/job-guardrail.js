import { extractJsonFromText } from './json.js';
import { logError, logInfo } from './log.js';
import { runPrompt } from './llm/runners.js';

function buildGuardrailPrompt(jobSnapshot) {
  return [
    'You are validating whether the provided text is a real job description suitable for resume tailoring.',
    'Return strict JSON only with this exact shape:',
    '{"is_job_description": boolean, "confidence": "high" | "medium" | "low", "reason": string}',
    'Return false for page chrome, sign-in prompts, search results, company pages, generic marketing copy, snippets that are too short, or text that is not clearly about one role.',
    'Return true only when the text clearly describes a specific role with responsibilities, requirements, qualifications, skills, or similar hiring details.',
    '',
    `Source: ${jobSnapshot?.source || 'unknown'}`,
    `Title hint: ${jobSnapshot?.title || ''}`,
    `Company hint: ${jobSnapshot?.company || ''}`,
    '',
    'Job description text:',
    jobSnapshot?.rawText || '',
  ].join('\n');
}

function normalizeGuardrailResult(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JD guardrail returned an invalid JSON shape.');
  }

  const isJobDescription = parsed.is_job_description === true;
  const confidence =
    typeof parsed.confidence === 'string' &&
    ['high', 'medium', 'low'].includes(parsed.confidence.toLowerCase())
      ? parsed.confidence.toLowerCase()
      : 'low';
  const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : '';

  return {
    is_job_description: isJobDescription,
    confidence,
    reason,
  };
}

export async function evaluateJobDescriptionGuardrail(
  jobSnapshot,
  profile,
  systemPrompt = '',
) {
  const prompt = buildGuardrailPrompt(jobSnapshot);
  logInfo('JobGuardrail', 'Running JD validity guardrail.', {
    source: jobSnapshot?.source ?? 'unknown',
    rawTextLength: jobSnapshot?.rawText?.length ?? 0,
  });

  const result = await runPrompt(prompt, {
    profile,
    promptLabel: 'JD Guardrail',
    systemPrompt,
  });

  if (result.status !== 'success') {
    logError('JobGuardrail', 'JD guardrail prompt failed.', result);
    throw new Error(`JD guardrail failed: ${result.message}`);
  }

  const parsed = normalizeGuardrailResult(extractJsonFromText(result.rawText));
  logInfo('JobGuardrail', 'JD guardrail completed.', parsed);
  return parsed;
}
