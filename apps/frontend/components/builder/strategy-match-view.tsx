'use client';

import { useMemo } from 'react';
import { type ResumeData } from '@/components/dashboard/resume-component';
import { calculateMatchStats } from '@/lib/utils/keyword-matcher';
import {
  buildStrategyBrief,
  extractStrategyKeywords,
  type StrategyBrief,
} from '@/lib/utils/prompt2-strategy';
import { HighlightedResumeView } from './highlighted-resume-view';
import { CheckCircle, Sparkles, Target } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

interface StrategyMatchViewProps {
  prompt2Artifact: Record<string, unknown>;
  resumeData: ResumeData;
}

export function StrategyMatchView({ prompt2Artifact, resumeData }: StrategyMatchViewProps) {
  const { t } = useTranslations();

  const strategyBrief = useMemo(
    () =>
      buildStrategyBrief(prompt2Artifact, {
        topGoals: t('builder.strategyMatch.sections.topGoals'),
        summaryFocus: t('builder.strategyMatch.sections.summaryFocus'),
        signalsToSurface: t('builder.strategyMatch.sections.signalsToSurface'),
        storylines: t('builder.strategyMatch.sections.storylines'),
        experienceThemes: t('builder.strategyMatch.sections.experienceThemes'),
        mirrorPhrases: t('builder.strategyMatch.sections.mirrorPhrases'),
        finalSkills: t('builder.strategyMatch.sections.finalSkills'),
      }),
    [prompt2Artifact, t]
  );

  const keywords = useMemo(() => extractStrategyKeywords(prompt2Artifact), [prompt2Artifact]);

  const resumeText = useMemo(() => {
    const parts: string[] = [];

    if (resumeData.summary) parts.push(resumeData.summary);

    resumeData.workExperience?.forEach((exp) => {
      if (exp.title) parts.push(exp.title);
      if (exp.company) parts.push(exp.company);
      exp.description?.forEach((d) => parts.push(d));
    });

    resumeData.education?.forEach((edu) => {
      if (edu.degree) parts.push(edu.degree);
      if (edu.institution) parts.push(edu.institution);
    });

    resumeData.personalProjects?.forEach((proj) => {
      if (proj.name) parts.push(proj.name);
      if (proj.role) parts.push(proj.role);
      proj.description?.forEach((d) => parts.push(d));
    });

    if (resumeData.additional) {
      resumeData.additional.technicalSkills?.forEach((s) => parts.push(s));
      resumeData.additional.languages?.forEach((l) => parts.push(l));
      resumeData.additional.certificationsTraining?.forEach((c) => parts.push(c));
    }

    return parts.join(' ');
  }, [resumeData]);

  const stats = useMemo(() => calculateMatchStats(resumeText, keywords), [resumeText, keywords]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-mono">
              {t('builder.strategyMatch.stats.signalsTracked', { count: keywords.size })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-mono">
              {t('builder.strategyMatch.stats.matchesFound', { count: stats.matchCount })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-gray-600">
            {t('builder.strategyMatch.stats.coverageLabel')}
          </span>
          <span
            className={`text-lg font-bold ${
              stats.matchPercentage >= 50
                ? 'text-green-600'
                : stats.matchPercentage >= 30
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }`}
          >
            {stats.matchPercentage}%
          </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 min-h-0">
        <div className="border-r border-gray-200 overflow-hidden">
          <StrategyBriefDisplay strategyBrief={strategyBrief} />
        </div>

        <div className="overflow-hidden">
          <HighlightedResumeView
            resumeData={resumeData}
            keywords={keywords}
            title={t('builder.strategyMatch.resumeTitle')}
            subtitle={t('builder.strategyMatch.resumeSubtitle')}
          />
        </div>
      </div>
    </div>
  );
}

function StrategyBriefDisplay({ strategyBrief }: { strategyBrief: StrategyBrief | null }) {
  const { t } = useTranslations();

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 bg-gray-50">
        <Sparkles className="w-4 h-4 text-gray-600 shrink-0" />
        <h3 className="font-mono text-sm font-bold uppercase text-gray-700">
          {t('builder.strategyMatch.briefTitle')}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!strategyBrief ? (
          <div className="border border-gray-200 bg-white p-4 text-sm text-gray-600">
            {t('builder.strategyMatch.empty')}
          </div>
        ) : (
          <>
            {strategyBrief.positioningThesis && (
              <TextBlock
                title={t('builder.strategyMatch.positioningThesis')}
                text={strategyBrief.positioningThesis}
              />
            )}
            {strategyBrief.recommendedTitle && (
              <TextBlock
                title={t('builder.strategyMatch.recommendedTitle')}
                text={strategyBrief.recommendedTitle}
              />
            )}
            {strategyBrief.summaryLead && (
              <TextBlock
                title={t('builder.strategyMatch.summaryLead')}
                text={strategyBrief.summaryLead}
              />
            )}
            {strategyBrief.sections.map((section) => (
              <ListBlock key={section.title} title={section.title} items={section.items} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="border border-gray-200 bg-white rounded-none">
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <span className="font-mono text-xs font-bold uppercase text-gray-600">{title}</span>
      </div>
      <div className="p-3 text-sm leading-relaxed text-gray-700">{text}</div>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border border-gray-200 bg-white rounded-none">
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <span className="font-mono text-xs font-bold uppercase text-gray-600">{title}</span>
      </div>
      <ul className="p-3 space-y-1 text-sm text-gray-700 list-disc list-inside">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
