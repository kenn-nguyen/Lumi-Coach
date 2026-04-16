'use client';

import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Experience } from '@/components/dashboard/resume-component';
import { rewriteExperienceBullet } from '@/lib/api/resume';
import { Check, Eye, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
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
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DraggableListItem } from '../draggable-list-item';

interface ExperienceFormProps {
  data: Experience[];
  resumeId?: string | null;
  linkedJobDescription?: string | null;
  originalData?: Experience[];
  onChange: (data: Experience[]) => void;
}

type PopoverType = 'original' | 'rewrite';
type PopoverPlacement = 'above' | 'below';

export const ExperienceForm: React.FC<ExperienceFormProps> = ({
  data,
  resumeId,
  linkedJobDescription,
  originalData,
  onChange,
}) => {
  const { t } = useTranslations();
  const [activePopover, setActivePopover] = useState<{
    key: string;
    type: PopoverType;
    placement: PopoverPlacement;
  } | null>(null);
  const [instructionByKey, setInstructionByKey] = useState<Record<string, string>>({});
  const [generatedBulletByKey, setGeneratedBulletByKey] = useState<Record<string, string>>({});
  const [isGeneratingByKey, setIsGeneratingByKey] = useState<Record<string, boolean>>({});

  const originalExperienceById = useMemo(
    () => new Map((originalData || []).map((item) => [item.id, item])),
    [originalData]
  );

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

  const getPopoverPlacement = (
    event: React.MouseEvent<HTMLButtonElement>,
    estimatedHeight: number
  ): PopoverPlacement => {
    if (typeof window === 'undefined') {
      return 'below';
    }

    const row = (event.currentTarget as HTMLElement).closest('[data-bullet-row]');
    if (!(row instanceof HTMLElement)) {
      return 'below';
    }

    const rect = row.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
      return 'above';
    }

    return 'below';
  };

  const togglePopover = (
    event: React.MouseEvent<HTMLButtonElement>,
    key: string,
    type: PopoverType
  ) => {
    const estimatedHeight = type === 'rewrite' ? 360 : 180;
    const placement = getPopoverPlacement(event, estimatedHeight);

    setActivePopover((current) =>
      current?.key === key && current.type === type ? null : { key, type, placement }
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
        <div className="mr-10 border border-black bg-[#F0F0E8] p-3 shadow-[4px_4px_0_0_#000]">
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
      <div className="mr-10 border border-black bg-[#F0F0E8] p-3 shadow-[4px_4px_0_0_#000]">
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
            <div className="min-h-[72px] border border-black bg-white px-3 py-2 text-sm leading-5 text-black">
              {originalBullet || t('builder.forms.experience.originalBullet.empty')}
            </div>
          </div>

          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {t('builder.forms.experience.aiRewrite.instructionLabel')}
            </Label>
            <Textarea
              value={instructionByKey[key] || ''}
              onChange={(e) => handleInstructionChange(key, e.target.value)}
              placeholder={t('builder.forms.experience.aiRewrite.instructionPlaceholder')}
              className="min-h-[76px] bg-white text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {t('builder.forms.experience.aiRewrite.resultLabel')}
            </Label>
            <Textarea
              value={generatedBullet}
              onChange={(e) => handleGeneratedBulletChange(key, e.target.value)}
              placeholder={t('builder.forms.experience.aiRewrite.resultPlaceholder')}
              className="min-h-[92px] bg-white text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerateRewrite(key, item, currentBullet, originalBullet)}
              disabled={!resumeId || isGenerating}
              className="rounded-none border-black bg-white"
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
              className="rounded-none border-black bg-white"
            >
              {t('builder.forms.experience.aiRewrite.cancel')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUseGeneratedBullet(item.id, bulletIndex, key)}
              disabled={!generatedBullet.trim()}
              className="rounded-none border-black bg-black text-white hover:bg-white hover:text-black"
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
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="rounded-none border-black hover:bg-black hover:text-white transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" /> {t('builder.forms.experience.addJob')}
        </Button>
      </div>

      {data.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 border border-dashed border-black">
          <p className="font-mono text-sm text-gray-500 mb-4">
            {t('builder.genericItemForm.noEntries', { label: t('resume.sections.experience') })}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAdd}
            className="rounded-none border-black"
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
                  <div className="p-6 border border-black bg-gray-50 relative group">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemove(item.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pr-8">
                      <div className="space-y-2">
                        <Label className="font-mono text-xs uppercase tracking-wider text-gray-500">
                          {t('builder.forms.experience.fields.jobTitle')}
                        </Label>
                        <Input
                          value={item.title || ''}
                          onChange={(e) => handleChange(item.id, 'title', e.target.value)}
                          placeholder={t('builder.forms.experience.placeholders.jobTitle')}
                          className="rounded-none border-black bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-mono text-xs uppercase tracking-wider text-gray-500">
                          {t('builder.forms.experience.fields.company')}
                        </Label>
                        <Input
                          value={item.company || ''}
                          onChange={(e) => handleChange(item.id, 'company', e.target.value)}
                          placeholder={t('builder.forms.experience.placeholders.company')}
                          className="rounded-none border-black bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-mono text-xs uppercase tracking-wider text-gray-500">
                          {t('builder.genericItemForm.fields.location')}
                        </Label>
                        <Input
                          value={item.location || ''}
                          onChange={(e) => handleChange(item.id, 'location', e.target.value)}
                          placeholder={t('builder.forms.experience.placeholders.location')}
                          className="rounded-none border-black bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-mono text-xs uppercase tracking-wider text-gray-500">
                          {t('builder.genericItemForm.fields.years')}
                        </Label>
                        <Input
                          value={item.years || ''}
                          onChange={(e) => handleChange(item.id, 'years', e.target.value)}
                          placeholder={t('builder.forms.experience.placeholders.years')}
                          className="rounded-none border-black bg-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="font-mono text-xs uppercase tracking-wider text-gray-500">
                          {t('builder.genericItemForm.fields.descriptionPoints')}
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddDescription(item.id)}
                          className="h-6 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                        >
                          <Plus className="w-3 h-3 mr-1" />{' '}
                          {t('builder.genericItemForm.actions.addPoint')}
                        </Button>
                      </div>
                      {item.description?.map((desc, idx) => {
                        const bulletPopoverKey = `${item.id}-${idx}`;
                        const originalBullet = getOriginalBullet(item, experienceIndex, idx);
                        const isActive = activePopover?.key === bulletPopoverKey;
                        const activeType = isActive ? activePopover.type : null;
                        const activePlacement = isActive ? activePopover.placement : 'below';
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
                          <div key={idx} data-bullet-row className="space-y-2">
                            {isActive && activePlacement === 'above' ? popover : null}
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                <RichTextEditor
                                  value={desc}
                                  onChange={(html) => handleDescriptionChange(item.id, idx, html)}
                                  placeholder={t('builder.forms.experience.placeholders.description')}
                                  minHeight="60px"
                                />
                              </div>
                              <div className="flex flex-col gap-1 pt-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(event) =>
                                    togglePopover(event, bulletPopoverKey, 'rewrite')
                                  }
                                  disabled={!resumeId}
                                  title={t('builder.forms.experience.aiRewrite.button')}
                                  className="h-[28px] w-8 text-muted-foreground hover:text-black"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                </Button>
                                {originalData && originalData.length > 0 ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(event) =>
                                      togglePopover(event, bulletPopoverKey, 'original')
                                    }
                                    title={t('builder.forms.experience.originalBullet.button')}
                                    className="h-[28px] w-8 text-muted-foreground hover:text-black"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveDescription(item.id, idx)}
                                  className="h-[28px] w-8 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            {isActive && activePlacement === 'below' ? popover : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </DraggableListItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};
