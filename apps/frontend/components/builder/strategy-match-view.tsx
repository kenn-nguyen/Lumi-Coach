'use client';

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { type ResumeData } from '@/components/dashboard/resume-component';
import { Textarea } from '@/components/ui/textarea';
import { calculateMatchStats } from '@/lib/utils/keyword-matcher';
import {
  buildStrategyBrief,
  extractStrategyKeywords,
  type StrategyBrief,
} from '@/lib/utils/prompt2-strategy';
import { HighlightedResumeView } from './highlighted-resume-view';
import { CheckCircle, RotateCcw, Save, Sparkles, Target } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface StrategyMatchViewProps {
  prompt2Artifact: Record<string, unknown>;
  resumeData: ResumeData;
  resumeId?: string | null;
}

const buildStorageKey = (resumeId?: string | null) => `ai_strategy_brief:${resumeId ?? 'draft'}`;

function normalizeStrategyBrief(value: unknown): StrategyBrief | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const sections = Array.isArray(raw.sections)
    ? raw.sections
        .map((section) => {
          if (!section || typeof section !== 'object') {
            return null;
          }

          const sectionRecord = section as Record<string, unknown>;
          const title = typeof sectionRecord.title === 'string' ? sectionRecord.title.trim() : '';
          const items = Array.isArray(sectionRecord.items)
            ? sectionRecord.items
                .map((item) => (typeof item === 'string' ? item.trim() : ''))
                .filter(Boolean)
            : [];

          if (!title || items.length === 0) {
            return null;
          }

          return { title, items };
        })
        .filter((section): section is NonNullable<typeof section> => Boolean(section))
    : [];

  const positioningThesis =
    typeof raw.positioningThesis === 'string' && raw.positioningThesis.trim()
      ? raw.positioningThesis.trim()
      : null;
  const recommendedTitle =
    typeof raw.recommendedTitle === 'string' && raw.recommendedTitle.trim()
      ? raw.recommendedTitle.trim()
      : null;
  const summaryLead =
    typeof raw.summaryLead === 'string' && raw.summaryLead.trim() ? raw.summaryLead.trim() : null;

  if (!positioningThesis && !recommendedTitle && !summaryLead && sections.length === 0) {
    return null;
  }

  return {
    positioningThesis,
    recommendedTitle,
    summaryLead,
    sections,
  };
}

function briefsEqual(a: StrategyBrief | null, b: StrategyBrief | null) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function autoResizeTextarea(element: HTMLTextAreaElement | null) {
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
}

export function StrategyMatchView({
  prompt2Artifact,
  resumeData,
  resumeId,
}: StrategyMatchViewProps) {
  const { t } = useTranslations();

  const generatedBrief = useMemo(
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

  const storageKey = useMemo(() => buildStorageKey(resumeId), [resumeId]);
  const [savedBrief, setSavedBrief] = useState<StrategyBrief | null>(generatedBrief);
  const [editableBrief, setEditableBrief] = useState<StrategyBrief | null>(generatedBrief);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setSavedBrief(generatedBrief);
      setEditableBrief(generatedBrief);
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? normalizeStrategyBrief(JSON.parse(raw)) : null;
      const initial = parsed ?? generatedBrief;
      setSavedBrief(initial);
      setEditableBrief(initial);
    } catch {
      setSavedBrief(generatedBrief);
      setEditableBrief(generatedBrief);
    }
  }, [generatedBrief, storageKey]);

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
  const hasUnsavedChanges = !briefsEqual(editableBrief, savedBrief);

  const handleSave = () => {
    if (typeof window === 'undefined') return;

    if (!editableBrief) {
      window.localStorage.removeItem(storageKey);
      setSavedBrief(null);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(editableBrief));
    setSavedBrief(editableBrief);
  };

  const handleReset = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(storageKey);
    }
    setSavedBrief(generatedBrief);
    setEditableBrief(generatedBrief);
  };

  return (
    <div className="h-full flex flex-col min-w-0">
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

      <div className="flex-1 grid grid-cols-2 min-h-0 min-w-0">
        <div className="border-r border-gray-200 overflow-hidden min-w-0">
          <StrategyBriefDisplay
            strategyBrief={editableBrief}
            hasUnsavedChanges={hasUnsavedChanges}
            onSave={handleSave}
            onReset={handleReset}
            onUpdate={setEditableBrief}
          />
        </div>

        <div className="overflow-hidden min-w-0">
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

interface StrategyBriefDisplayProps {
  strategyBrief: StrategyBrief | null;
  hasUnsavedChanges: boolean;
  onSave: () => void;
  onReset: () => void;
  onUpdate: Dispatch<SetStateAction<StrategyBrief | null>>;
}

function StrategyBriefDisplay({
  strategyBrief,
  hasUnsavedChanges,
  onSave,
  onReset,
  onUpdate,
}: StrategyBriefDisplayProps) {
  const { t } = useTranslations();

  const updateTextField = (
    field: 'positioningThesis' | 'recommendedTitle' | 'summaryLead',
    value: string
  ) => {
    onUpdate((current) => {
      if (!current) return current;
      return {
        ...current,
        [field]: value.trim() ? value : null,
      };
    });
  };

  const updateSectionItems = (sectionTitle: string, value: string) => {
    onUpdate((current) => {
      if (!current) return current;

      return {
        ...current,
        sections: current.sections.map((section) =>
          section.title === sectionTitle
            ? {
                ...section,
                items: value
                  .split('\n')
                  .map((item) => item.trim())
                  .filter(Boolean),
              }
            : section
        ),
      };
    });
  };

  return (
    <div className="h-full flex flex-col bg-[#fcfaf4]">
      <div className="flex min-h-[72px] items-center justify-between gap-3 border-b border-[#ddd5c4] bg-[#f6f1e6] px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          <h3 className="font-mono text-sm font-bold uppercase text-gray-700 truncate">
            {t('builder.strategyMatch.briefTitle')}
          </h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <IconActionButton
            ariaLabel={t('common.reset')}
            disabled={!strategyBrief}
            icon={<RotateCcw className="h-4 w-4" />}
            onClick={onReset}
            title={t('common.reset')}
          />
          <IconActionButton
            ariaLabel={t('common.save')}
            disabled={!strategyBrief || !hasUnsavedChanges}
            icon={<Save className="h-4 w-4" />}
            onClick={onSave}
            title={t('common.save')}
            variant="primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!strategyBrief ? (
          <div className="border border-[#ddd5c4] bg-white p-4 text-sm text-gray-600 rounded-[18px]">
            {t('builder.strategyMatch.empty')}
          </div>
        ) : (
          <>
            {strategyBrief.positioningThesis && (
              <EditableTextBlock
                key="positioningThesis"
                title={t('builder.strategyMatch.positioningThesis')}
                text={strategyBrief.positioningThesis}
                onChange={(value) => updateTextField('positioningThesis', value)}
              />
            )}
            {strategyBrief.recommendedTitle && (
              <EditableTextBlock
                key="recommendedTitle"
                title={t('builder.strategyMatch.recommendedTitle')}
                text={strategyBrief.recommendedTitle}
                onChange={(value) => updateTextField('recommendedTitle', value)}
              />
            )}
            {strategyBrief.summaryLead && (
              <EditableTextBlock
                key="summaryLead"
                title={t('builder.strategyMatch.summaryLead')}
                text={strategyBrief.summaryLead}
                onChange={(value) => updateTextField('summaryLead', value)}
              />
            )}
            {strategyBrief.sections.map((section) => (
              <EditableListBlock
                key={section.title}
                title={section.title}
                items={section.items}
                onChange={(value) => updateSectionItems(section.title, value)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function EditableTextBlock({
  title,
  text,
  onChange,
}: {
  title: string;
  text: string;
  onChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    autoResizeTextarea(textareaRef.current);
  }, [text]);

  return (
    <div className="space-y-2">
      <span className="block px-1 font-mono text-xs font-bold uppercase text-gray-600">
        {title}
      </span>
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          onChange(e.target.value);
          autoResizeTextarea(e.currentTarget);
        }}
        rows={1}
        className="min-h-0 resize-none overflow-hidden rounded-[14px] border-[#ddd5c4] bg-white px-4 py-3 text-sm leading-relaxed text-gray-700 shadow-none"
        style={{ height: 'auto' }}
      />
    </div>
  );
}

function EditableListBlock({
  title,
  items,
  onChange,
}: {
  title: string;
  items: string[];
  onChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const value = items.join('\n');

  useEffect(() => {
    autoResizeTextarea(textareaRef.current);
  }, [value]);

  return (
    <div className="space-y-2">
      <span className="block px-1 font-mono text-xs font-bold uppercase text-gray-600">
        {title}
      </span>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          autoResizeTextarea(e.currentTarget);
        }}
        rows={1}
        className="min-h-0 resize-none overflow-hidden rounded-[14px] border-[#ddd5c4] bg-white px-4 py-3 text-sm leading-relaxed text-gray-700 shadow-none"
        style={{ height: 'auto' }}
      />
    </div>
  );
}

function IconActionButton({
  ariaLabel,
  disabled,
  icon,
  onClick,
  title,
  variant = 'default',
}: {
  ariaLabel: string;
  disabled?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
  variant?: 'default' | 'primary';
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary'
          ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
          : 'border-[#d9d1c0] bg-white text-gray-600 hover:bg-[#f7f2e8]'
      )}
    >
      {icon}
    </button>
  );
}
