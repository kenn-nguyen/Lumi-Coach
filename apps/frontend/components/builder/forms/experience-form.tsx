'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Experience } from '@/components/dashboard/resume-component';
import { rewriteExperienceBullet } from '@/lib/api/resume';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  X,
  Type,
} from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DraggableListItem } from '../draggable-list-item';
import { cn } from '@/lib/utils';
import { CSS } from '@dnd-kit/utilities';

interface ExperienceFormProps {
  data: Experience[];
  resumeId?: string | null;
  linkedJobDescription?: string | null;
  originalData?: Experience[];
  onChange: (data: Experience[]) => void;
}

type PopoverType = 'original' | 'rewrite';
const SortableBulletRow: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const [mounted, setMounted] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/bullet">
      {mounted ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="absolute -left-6 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-transparent bg-transparent text-muted-foreground opacity-0 transition-all hover:text-foreground group-hover/bullet:opacity-100 group-focus-within/bullet:opacity-100 active:cursor-grabbing"
          title="Drag to reorder point"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <div
          aria-hidden="true"
          className="absolute -left-6 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center opacity-0"
        >
          <GripVertical className="h-4 w-4 text-transparent" />
        </div>
      )}
      {children}
    </div>
  );
};

export const ExperienceForm: React.FC<ExperienceFormProps> = ({
  data,
  resumeId,
  linkedJobDescription,
  originalData,
  onChange,
}) => {
  const { t } = useTranslations();
  const builderEditableFieldClass =
    'rounded-xl border-border bg-white focus-visible:border-primary focus-visible:ring-primary/25';
  const [activePopover, setActivePopover] = useState<{
    key: string;
    type: PopoverType;
  } | null>(null);
  const [instructionByKey, setInstructionByKey] = useState<Record<string, string>>({});
  const [generatedBulletByKey, setGeneratedBulletByKey] = useState<Record<string, string>>({});
  const [isGeneratingByKey, setIsGeneratingByKey] = useState<Record<string, boolean>>({});
  const [showFormattingByKey, setShowFormattingByKey] = useState<Record<string, boolean>>({});
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [collapsedDescriptionsById, setCollapsedDescriptionsById] = useState<Record<number, boolean>>(
    {}
  );
  const instructionTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const generatedBulletTextareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const originalExperienceById = useMemo(
    () => new Map((originalData || []).map((item) => [item.id, item])),
    [originalData]
  );

  useEffect(() => {
    if (!openMenuKey) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(`[data-bullet-menu-root="${openMenuKey}"]`)) {
        return;
      }
      setOpenMenuKey(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openMenuKey]);

  const resizeTextarea = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = '0px';
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    Object.values(instructionTextareaRefs.current).forEach((element) => resizeTextarea(element));
  }, [instructionByKey, activePopover]);

  useEffect(() => {
    Object.values(generatedBulletTextareaRefs.current).forEach((element) => resizeTextarea(element));
  }, [generatedBulletByKey, activePopover]);

  const normalizeBulletText = (value: string): string =>
    value
      .toLowerCase()
      .replace(/<[^>]+>/g, ' ')
      .replace(/[—–]/g, '-')
      .replace(/[^a-z0-9%+\-./ ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const getTokenSet = (value: string): Set<string> =>
    new Set(
      normalizeBulletText(value)
        .split(' ')
        .filter((token) => token.length >= 3 && !/^\d+$/.test(token))
    );

  const getNumericTokens = (value: string): Set<string> =>
    new Set((normalizeBulletText(value).match(/\b\d+(?:\.\d+)?%?\b/g) || []).map((token) => token));

  const getLeadingVerb = (value: string): string => {
    const [firstToken = ''] = normalizeBulletText(value).split(' ');
    return firstToken;
  };

  const computeBulletSimilarity = (generatedBullet: string, originalBullet: string): number => {
    const generatedNormalized = normalizeBulletText(generatedBullet);
    const originalNormalized = normalizeBulletText(originalBullet);
    if (!generatedNormalized || !originalNormalized) {
      return 0;
    }

    const generatedTokens = getTokenSet(generatedNormalized);
    const originalTokens = getTokenSet(originalNormalized);
    const sharedTokens = [...generatedTokens].filter((token) => originalTokens.has(token));
    const unionSize = new Set([...generatedTokens, ...originalTokens]).size;
    const tokenScore = unionSize > 0 ? sharedTokens.length / unionSize : 0;

    const generatedNumbers = getNumericTokens(generatedNormalized);
    const originalNumbers = getNumericTokens(originalNormalized);
    const sharedNumbers = [...generatedNumbers].filter((token) => originalNumbers.has(token));
    const numberScore =
      generatedNumbers.size > 0 || originalNumbers.size > 0
        ? sharedNumbers.length / Math.max(generatedNumbers.size, originalNumbers.size, 1)
        : 0;

    const generatedVerb = getLeadingVerb(generatedNormalized);
    const originalVerb = getLeadingVerb(originalNormalized);
    const verbScore = generatedVerb && generatedVerb === originalVerb ? 1 : 0;

    const lengthRatio =
      Math.min(generatedNormalized.length, originalNormalized.length) /
      Math.max(generatedNormalized.length, originalNormalized.length);

    return tokenScore * 0.55 + numberScore * 0.2 + verbScore * 0.15 + lengthRatio * 0.1;
  };

  const findMatchingOriginalExperience = (item: Experience, experienceIndex: number): Experience | null =>
    originalExperienceById.get(item.id) ||
    originalData?.find(
      (originalItem) =>
        originalItem.company === item.company &&
        originalItem.title === item.title &&
        originalItem.years === item.years
    ) ||
    originalData?.[experienceIndex] ||
    null;

  const originalBulletMappings = useMemo(() => {
    const mappings = new Map<string, string | null>();

    data.forEach((item, experienceIndex) => {
      const matchedExperience = findMatchingOriginalExperience(item, experienceIndex);
      const generatedBullets = item.description || [];
      const originalBullets = matchedExperience?.description || [];

      if (!matchedExperience || generatedBullets.length === 0 || originalBullets.length === 0) {
        generatedBullets.forEach((_, bulletIndex) => {
          mappings.set(`${item.id}:${bulletIndex}`, null);
        });
        return;
      }

      const candidates = generatedBullets.map((generatedBullet, generatedIndex) => {
        const scoredOriginals = originalBullets
          .map((originalBullet, originalIndex) => ({
            originalBullet,
            originalIndex,
            score: computeBulletSimilarity(generatedBullet || '', originalBullet || ''),
          }))
          .sort((left, right) => right.score - left.score);

        return {
          generatedIndex,
          scoredOriginals,
          bestScore: scoredOriginals[0]?.score ?? 0,
          secondBestScore: scoredOriginals[1]?.score ?? 0,
        };
      });

      candidates.sort((left, right) => right.bestScore - left.bestScore);

      const usedOriginalIndexes = new Set<number>();
      candidates.forEach((candidate) => {
        const selected = candidate.scoredOriginals.find(
          (option) => !usedOriginalIndexes.has(option.originalIndex)
        );
        const confidenceGap = (selected?.score ?? 0) - candidate.secondBestScore;
        const hasConfidentMatch = (selected?.score ?? 0) >= 0.5 && confidenceGap >= 0.1;

        if (selected && hasConfidentMatch) {
          usedOriginalIndexes.add(selected.originalIndex);
          mappings.set(`${item.id}:${candidate.generatedIndex}`, selected.originalBullet);
        } else {
          mappings.set(`${item.id}:${candidate.generatedIndex}`, null);
        }
      });
    });

    return mappings;
  }, [data, originalData, originalExperienceById]);

  // Configure drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handler for drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = data.findIndex((item) => item.id === active.id);
    const newIndex = data.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder the array using arrayMove from @dnd-kit
    const reordered = arrayMove(data, oldIndex, newIndex);
    onChange(reordered);
  };

  const handleAdd = () => {
    const newId = Math.max(...data.map((d) => d.id), 0) + 1;
    onChange([
      ...data,
      {
        id: newId,
        title: '',
        company: '',
        location: '',
        years: '',
        description: [''],
      },
    ]);
  };

  const handleRemove = (id: number) => {
    onChange(data.filter((item) => item.id !== id));
  };

  const handleChange = (id: number, field: keyof Experience, value: string | string[]) => {
    onChange(
      data.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const handleDescriptionChange = (id: number, index: number, value: string) => {
    onChange(
      data.map((item) => {
        if (item.id === id) {
          const newDesc = [...(item.description || [])];
          newDesc[index] = value;
          return { ...item, description: newDesc };
        }
        return item;
      })
    );
  };

  const handleAddDescription = (id: number) => {
    onChange(
      data.map((item) => {
        if (item.id === id) {
          return { ...item, description: [...(item.description || []), ''] };
        }
        return item;
      })
    );
  };

  const handleDescriptionDragEnd = (id: number, event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const currentItem = data.find((item) => item.id === id);
    if (!currentItem?.description) return;

    const ids = currentItem.description.map((_, index) => `${id}:${index}`);
    const oldIndex = ids.findIndex((value) => value === active.id);
    const newIndex = ids.findIndex((value) => value === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    onChange(
      data.map((item) =>
        item.id === id
          ? { ...item, description: arrayMove(item.description || [], oldIndex, newIndex) }
          : item
      )
    );
  };

  const toggleDescriptionsCollapsed = (id: number) => {
    setCollapsedDescriptionsById((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  const toggleFormatting = (key: string) => {
    setShowFormattingByKey((current) => ({
      ...current,
      [key]: !current[key],
    }));
    setOpenMenuKey(null);
  };

  const handleRemoveDescription = (id: number, index: number) => {
    onChange(
      data.map((item) => {
        if (item.id === id) {
          const newDesc = [...(item.description || [])];
          newDesc.splice(index, 1);
          return { ...item, description: newDesc };
        }
        return item;
      })
    );
  };

  const getOriginalBullet = (
    item: Experience,
    experienceIndex: number,
    bulletIndex: number
  ): string | null => {
    const mappingKey = `${item.id}:${bulletIndex}`;
    if (originalBulletMappings.has(mappingKey)) {
      const mappedBullet = originalBulletMappings.get(mappingKey);
      return typeof mappedBullet === 'string' && mappedBullet.trim() ? mappedBullet : null;
    }
    const matchedExperience = findMatchingOriginalExperience(item, experienceIndex);
    const originalBullet = matchedExperience?.description?.[bulletIndex];
    return typeof originalBullet === 'string' && originalBullet.trim() ? originalBullet : null;
  };

  const togglePopover = (
    _event: React.MouseEvent<HTMLButtonElement>,
    key: string,
    type: PopoverType
  ) => {
    setActivePopover((current) =>
      current?.key === key && current.type === type ? null : { key, type }
    );
  };

  const handleInstructionChange = (key: string, value: string) => {
    setInstructionByKey((current) => ({ ...current, [key]: value }));
  };

  const handleGeneratedBulletChange = (key: string, value: string) => {
    setGeneratedBulletByKey((current) => ({ ...current, [key]: value }));
  };

  const handleGenerateRewrite = async (
    key: string,
    item: Experience,
    currentBullet: string,
    originalBullet: string | null
  ) => {
    if (!resumeId) {
      return;
    }

    try {
      setIsGeneratingByKey((current) => ({ ...current, [key]: true }));
      const response = await rewriteExperienceBullet(resumeId, {
        current_bullet: currentBullet,
        original_bullet: originalBullet,
        role_context: {
          title: item.title || '',
          company: item.company || '',
          years: item.years || '',
        },
        job_description: linkedJobDescription,
        user_instruction: instructionByKey[key] || '',
      });
      setGeneratedBulletByKey((current) => ({
        ...current,
        [key]: response.rewritten_bullet,
      }));
    } catch (error) {
      console.error('Failed to rewrite bullet:', error);
    } finally {
      setIsGeneratingByKey((current) => ({ ...current, [key]: false }));
    }
  };

  const handleUseGeneratedBullet = (id: number, index: number, key: string) => {
    const generatedBullet = generatedBulletByKey[key]?.trim();
    if (!generatedBullet) {
      return;
    }

    handleDescriptionChange(id, index, generatedBullet);
    setActivePopover(null);
  };

  const renderPopover = (
    key: string,
    type: PopoverType,
    item: Experience,
    bulletIndex: number,
    currentBullet: string,
    originalBullet: string | null
  ) => {
    if (type === 'original') {
      return (
        <div className="mr-10 rounded-2xl border border-border bg-[rgba(255,253,248,0.96)] p-4 shadow-[0_18px_36px_rgba(15,23,42,0.12)]">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {t('builder.forms.experience.originalBullet.title')}
            </p>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActivePopover(null)}
              className="h-6 w-6 text-muted-foreground hover:text-black"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-sm leading-5 text-black">
            {originalBullet || t('builder.forms.experience.originalBullet.empty')}
          </p>
        </div>
      );
    }

    const generatedBullet = generatedBulletByKey[key] || '';
    const isGenerating = Boolean(isGeneratingByKey[key]);

    return (
      <div className="mr-10 rounded-2xl border border-border bg-[rgba(255,253,248,0.96)] p-4 shadow-[0_18px_36px_rgba(15,23,42,0.12)]">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
            {t('builder.forms.experience.aiRewrite.title')}
          </p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setActivePopover(null)}
            className="h-6 w-6 text-muted-foreground hover:text-black"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {t('builder.forms.experience.originalBullet.title')}
            </Label>
            <div className="min-h-[72px] rounded-xl border border-border bg-white px-3 py-2 text-sm leading-6 text-foreground shadow-xs">
              {originalBullet || t('builder.forms.experience.originalBullet.empty')}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {t('builder.forms.experience.aiRewrite.instructionLabel')}
            </Label>
            <Textarea
              ref={(element) => {
                instructionTextareaRefs.current[key] = element;
              }}
              value={instructionByKey[key] || ''}
              onChange={(e) => {
                resizeTextarea(e.currentTarget);
                handleInstructionChange(key, e.target.value);
              }}
              placeholder={t('builder.forms.experience.aiRewrite.instructionPlaceholder')}
              rows={1}
              className="min-h-0 resize-none overflow-hidden rounded-xl border-border bg-white px-3 py-2 text-sm leading-6 shadow-xs focus-visible:border-primary focus-visible:ring-primary/25 focus-visible:ring-offset-0"
            />
          </div>

          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {t('builder.forms.experience.aiRewrite.resultLabel')}
            </Label>
            <Textarea
              ref={(element) => {
                generatedBulletTextareaRefs.current[key] = element;
              }}
              value={generatedBullet}
              onChange={(e) => {
                resizeTextarea(e.currentTarget);
                handleGeneratedBulletChange(key, e.target.value);
              }}
              placeholder={t('builder.forms.experience.aiRewrite.resultPlaceholder')}
              rows={1}
              className="min-h-0 resize-none overflow-hidden rounded-xl border-border bg-white px-3 py-2 text-sm leading-6 shadow-xs focus-visible:border-primary focus-visible:ring-primary/25 focus-visible:ring-offset-0"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerateRewrite(key, item, currentBullet, originalBullet)}
              disabled={!resumeId || isGenerating}
              className="rounded-xl border-border bg-white"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('builder.forms.experience.aiRewrite.generating')}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t('builder.forms.experience.aiRewrite.generate')}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActivePopover(null)}
              className="rounded-xl border-border bg-white"
            >
              {t('builder.forms.experience.aiRewrite.cancel')}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => handleUseGeneratedBullet(item.id, bulletIndex, key)}
              disabled={!generatedBullet.trim()}
              className="rounded-xl"
            >
              <Check className="mr-2 h-4 w-4" />
              {t('builder.forms.experience.aiRewrite.use')}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {data.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-border bg-card/70">
          <p className="font-mono text-sm text-gray-500 mb-4">
            {t('builder.genericItemForm.noEntries', { label: t('resume.sections.experience') })}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            className="h-10 rounded-xl border border-dashed border-border bg-white px-4 text-sm text-foreground hover:bg-secondary/40"
          >
            <Plus className="w-4 h-4 mr-2" /> {t('builder.forms.experience.addFirstJob')}
          </Button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={data.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-8">
              {data.map((item, experienceIndex) => (
                <DraggableListItem key={item.id} id={item.id}>
                  <div className="relative group rounded-2xl border border-border bg-card/80 p-6 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemove(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>

                    <div className="mb-3 grid grid-cols-1 gap-3 pr-8 md:grid-cols-2">
                      <div className="space-y-1">
                        <Input
                          value={item.title || ''}
                          onChange={(e) => handleChange(item.id, 'title', e.target.value)}
                          placeholder={t('builder.forms.experience.placeholders.jobTitle')}
                          className={cn(builderEditableFieldClass, 'font-semibold')}
                        />
                      </div>
                      <div className="space-y-1">
                        <Input
                          value={item.years || ''}
                          onChange={(e) => handleChange(item.id, 'years', e.target.value)}
                          placeholder={t('builder.forms.experience.placeholders.years')}
                          className={cn(builderEditableFieldClass, 'font-semibold')}
                        />
                      </div>
                      <div className="space-y-1">
                        <Input
                          value={item.company || ''}
                          onChange={(e) => handleChange(item.id, 'company', e.target.value)}
                          placeholder={t('builder.forms.experience.placeholders.company')}
                          className={cn(builderEditableFieldClass, 'font-semibold')}
                        />
                      </div>
                      <div className="space-y-1">
                        <Input
                          value={item.location || ''}
                          onChange={(e) => handleChange(item.id, 'location', e.target.value)}
                          placeholder={t('builder.forms.experience.placeholders.location')}
                          className={cn(builderEditableFieldClass, 'font-semibold')}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <Label className="font-mono text-xs uppercase tracking-wider text-gray-500">
                          {t('builder.genericItemForm.fields.descriptionPoints')}
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleDescriptionsCollapsed(item.id)}
                          className="h-7 w-7 rounded-full border-none bg-transparent p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
                          title={
                            collapsedDescriptionsById[item.id]
                              ? 'Expand description points'
                              : 'Collapse description points'
                          }
                        >
                          {collapsedDescriptionsById[item.id] ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {collapsedDescriptionsById[item.id] ? null : (
                        <>
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={(event) => handleDescriptionDragEnd(item.id, event)}
                          >
                            <SortableContext
                              items={(item.description || []).map((_, idx) => `${item.id}:${idx}`)}
                              strategy={verticalListSortingStrategy}
                            >
                              {item.description?.map((desc, idx) => {
                                const bulletPopoverKey = `${item.id}-${idx}`;
                                const originalBullet = getOriginalBullet(item, experienceIndex, idx);
                                const isActive = activePopover?.key === bulletPopoverKey;
                                const activeType = isActive ? activePopover.type : null;
                                const showFormatting = showFormattingByKey[bulletPopoverKey] ?? false;
                                const popover =
                                  isActive && activeType
                                    ? renderPopover(
                                        bulletPopoverKey,
                                        activeType,
                                        item,
                                        idx,
                                        desc,
                                        originalBullet
                                      )
                                    : null;

                                return (
                                  <SortableBulletRow key={bulletPopoverKey} id={`${item.id}:${idx}`}>
                                    <div data-bullet-row className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1">
                                          <RichTextEditor
                                            value={desc}
                                            onChange={(html) =>
                                              handleDescriptionChange(item.id, idx, html)
                                            }
                                            placeholder={t('builder.forms.experience.placeholders.description')}
                                            minHeight="60px"
                                            showToolbar={showFormatting}
                                            onToolbarClose={() => toggleFormatting(bulletPopoverKey)}
                                          />
                                        </div>
                                        <div
                                          className="relative flex shrink-0 flex-col items-center justify-center gap-0.5 self-center"
                                          data-bullet-menu-root={bulletPopoverKey}
                                        >
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(event) =>
                                              togglePopover(event, bulletPopoverKey, 'rewrite')
                                            }
                                            disabled={!resumeId}
                                            title={t('builder.forms.experience.aiRewrite.button')}
                                            className="h-8 w-8 rounded-full border-transparent bg-transparent px-0 text-xs font-semibold text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
                                          >
                                            <Sparkles className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              setOpenMenuKey((current) =>
                                                current === bulletPopoverKey ? null : bulletPopoverKey
                                              )
                                            }
                                            title="More actions"
                                            className="h-8 w-8 rounded-full border-transparent bg-transparent px-0 text-xs font-semibold text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
                                          >
                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                          </Button>
                                          {openMenuKey === bulletPopoverKey ? (
                                            <div className="absolute right-full top-8 z-20 mr-2 min-w-[164px] overflow-hidden rounded-2xl border border-border bg-white shadow-[0_16px_36px_rgba(15,23,42,0.12)]">
                                              {originalData && originalData.length > 0 ? (
                                                <button
                                                  type="button"
                                                  onClick={(event) => {
                                                    setOpenMenuKey(null);
                                                    togglePopover(event, bulletPopoverKey, 'original');
                                                  }}
                                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-secondary/60"
                                                >
                                                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                                  <span>View original</span>
                                                </button>
                                              ) : null}
                                              <button
                                                type="button"
                                                onClick={() => toggleFormatting(bulletPopoverKey)}
                                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-secondary/60"
                                              >
                                                <Type
                                                  className={cn(
                                                    'h-3.5 w-3.5 text-muted-foreground',
                                                    showFormatting && 'text-primary'
                                                  )}
                                                />
                                                <span>Format</span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setOpenMenuKey(null);
                                                  handleRemoveDescription(item.id, idx);
                                                }}
                                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/5"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                <span>Delete</span>
                                              </button>
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>
                                      {popover}
                                    </div>
                                  </SortableBulletRow>
                                );
                              })}
                            </SortableContext>
                          </DndContext>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddDescription(item.id)}
                            className="mt-1 h-auto w-auto justify-start rounded-none border-none bg-transparent px-0 py-0 text-xs font-semibold text-blue-700 shadow-none hover:bg-transparent hover:text-blue-800"
                          >
                            <Plus className="w-3 h-3 mr-1" /> {t('builder.genericItemForm.actions.addPoint')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </DraggableListItem>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAdd}
                className="h-10 w-full justify-center rounded-xl border border-dashed border-border bg-white text-sm text-foreground hover:bg-secondary/40"
              >
                <Plus className="w-4 h-4 mr-2" /> {t('builder.forms.experience.addJob')}
              </Button>
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};
