'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Education } from '@/components/dashboard/resume-component';
import { Plus, Trash2, Type } from 'lucide-react';
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
import { cn } from '@/lib/utils';

interface EducationFormProps {
  data: Education[];
  onChange: (data: Education[]) => void;
}

export const EducationForm: React.FC<EducationFormProps> = ({ data, onChange }) => {
  const { t } = useTranslations();
  const [showFormattingById, setShowFormattingById] = useState<Record<number, boolean>>({});
  const builderEditableFieldClass =
    'rounded-xl border-border bg-white font-semibold focus-visible:border-primary focus-visible:ring-primary/25';

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
        institution: '',
        degree: '',
        years: '',
        description: '',
      },
    ]);
  };

  const handleRemove = (id: number) => {
    onChange(data.filter((item) => item.id !== id));
  };

  const handleChange = (id: number, field: keyof Education, value: string) => {
    onChange(
      data.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const toggleFormatting = (id: number) => {
    setShowFormattingById((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  return (
    <div className="space-y-6">
      {data.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-border bg-card/70">
          <p className="font-mono text-sm text-gray-500 mb-4">
            {t('builder.genericItemForm.noEntries', { label: t('resume.sections.education') })}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            className="h-10 rounded-xl border border-dashed border-border bg-white px-4 text-sm text-foreground hover:bg-secondary/40"
          >
            <Plus className="w-4 h-4 mr-2" /> {t('builder.forms.education.addFirstSchool')}
          </Button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={data.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-8">
              {data.map((item) => (
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
                      <div className="space-y-2">
                        <Input
                          value={item.institution || ''}
                          onChange={(e) => handleChange(item.id, 'institution', e.target.value)}
                          placeholder={t('builder.forms.education.placeholders.institution')}
                          className={builderEditableFieldClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <Input
                          value={item.years || ''}
                          onChange={(e) => handleChange(item.id, 'years', e.target.value)}
                          placeholder={t('builder.forms.education.placeholders.years')}
                          className={builderEditableFieldClass}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Input
                          value={item.degree || ''}
                          onChange={(e) => handleChange(item.id, 'degree', e.target.value)}
                          placeholder={t('builder.forms.education.placeholders.degree')}
                          className={builderEditableFieldClass}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase tracking-wider text-gray-500">
                        {t('builder.forms.education.fields.descriptionOptional')}
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <RichTextEditor
                            value={item.description || ''}
                            onChange={(html) => handleChange(item.id, 'description', html)}
                            placeholder={t('builder.forms.education.placeholders.description')}
                            minHeight="60px"
                            showToolbar={showFormattingById[item.id] ?? false}
                            onToolbarClose={() => toggleFormatting(item.id)}
                          />
                        </div>
                        <div className="flex shrink-0 self-center">
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => toggleFormatting(item.id)}
                            title="Format"
                            className="h-8 w-8 rounded-full border-transparent bg-transparent px-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
                          >
                            <Type
                              className={cn(
                                'h-3.5 w-3.5',
                                showFormattingById[item.id] && 'text-primary'
                              )}
                            />
                          </Button>
                        </div>
                      </div>
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
                <Plus className="w-4 h-4 mr-2" /> {t('builder.forms.education.addSchool')}
              </Button>
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};
