'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Project } from '@/components/dashboard/resume-component';
import { Plus, Trash2, Type } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ProjectsFormProps {
  data: Project[];
  onChange: (data: Project[]) => void;
}

export const ProjectsForm: React.FC<ProjectsFormProps> = ({ data, onChange }) => {
  const { t } = useTranslations();
  const [showFormattingByKey, setShowFormattingByKey] = useState<Record<string, boolean>>({});
  const builderEditableFieldClass =
    'rounded-xl border-border bg-white font-semibold focus-visible:border-primary focus-visible:ring-primary/25';

  const handleAdd = () => {
    const newId = Math.max(...data.map((d) => d.id), 0) + 1;
    onChange([
      ...data,
      {
        id: newId,
        name: '',
        role: '',
        years: '',
        github: '',
        website: '',
        description: [''],
      },
    ]);
  };

  const handleRemove = (id: number) => {
    onChange(data.filter((item) => item.id !== id));
  };

  const handleChange = (id: number, field: keyof Project, value: string | string[]) => {
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

  const toggleFormatting = (key: string) => {
    setShowFormattingByKey((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="space-y-8">
        {data.map((item) => (
          <div
            key={item.id}
            className="relative group rounded-2xl border border-border bg-card/80 p-6 shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
          >
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
                  value={item.name || ''}
                  onChange={(e) => handleChange(item.id, 'name', e.target.value)}
                  placeholder={t('builder.forms.projects.placeholders.projectName')}
                  className={builderEditableFieldClass}
                />
              </div>
              <div className="space-y-2">
                <Input
                  value={item.years || ''}
                  onChange={(e) => handleChange(item.id, 'years', e.target.value)}
                  placeholder={t('builder.forms.projects.placeholders.years')}
                  className={builderEditableFieldClass}
                />
              </div>
              <div className="space-y-2">
                <Input
                  value={item.role || ''}
                  onChange={(e) => handleChange(item.id, 'role', e.target.value)}
                  placeholder={t('builder.forms.projects.placeholders.role')}
                  className={builderEditableFieldClass}
                />
              </div>
              <div className="space-y-2">
                <Input
                  value={item.github || ''}
                  onChange={(e) => handleChange(item.id, 'github', e.target.value)}
                  placeholder={t('builder.forms.projects.placeholders.github')}
                  className={cn(builderEditableFieldClass, 'font-normal')}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Input
                  value={item.website || ''}
                  onChange={(e) => handleChange(item.id, 'website', e.target.value)}
                  placeholder={t('builder.forms.projects.placeholders.website')}
                  className={cn(builderEditableFieldClass, 'font-normal')}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center">
                <Label className="font-mono text-xs uppercase tracking-wider text-gray-500">
                  {t('builder.genericItemForm.fields.descriptionPoints')}
                </Label>
              </div>
              {item.description?.map((desc, idx) => {
                const descriptionKey = `${item.id}:${idx}`;
                const showFormatting = showFormattingByKey[descriptionKey] ?? false;

                return (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1">
                      <RichTextEditor
                        value={desc}
                        onChange={(html) => handleDescriptionChange(item.id, idx, html)}
                        placeholder={t('builder.forms.projects.placeholders.description')}
                        minHeight="60px"
                        showToolbar={showFormatting}
                        onToolbarClose={() => toggleFormatting(descriptionKey)}
                      />
                    </div>
                    <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 self-center">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => toggleFormatting(descriptionKey)}
                        title="Format"
                        className="h-8 w-8 rounded-full border-transparent bg-transparent px-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
                      >
                        <Type className={cn('h-3.5 w-3.5', showFormatting && 'text-primary')} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => handleRemoveDescription(item.id, idx)}
                        title="Delete"
                        className="h-8 w-8 rounded-full border-transparent bg-transparent px-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAddDescription(item.id)}
                className="mt-1 h-auto w-auto justify-start rounded-none border-none bg-transparent px-0 py-0 text-xs font-semibold text-blue-700 shadow-none hover:bg-transparent hover:text-blue-800"
              >
                <Plus className="w-3 h-3 mr-1" /> {t('builder.genericItemForm.actions.addPoint')}
              </Button>
            </div>
          </div>
        ))}

        {data.length === 0 && (
          <div className="text-center py-12 rounded-2xl border border-dashed border-border bg-card/70">
            <p className="font-mono text-sm text-gray-500 mb-4">
              {t('builder.genericItemForm.noEntries', { label: t('resume.sections.projects') })}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAdd}
              className="h-10 rounded-xl border border-dashed border-border bg-white px-4 text-sm text-foreground hover:bg-secondary/40"
            >
              <Plus className="w-4 h-4 mr-2" /> {t('builder.forms.projects.addFirstProject')}
            </Button>
          </div>
        )}
        {data.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            className="h-10 w-full justify-center rounded-xl border border-dashed border-border bg-white text-sm text-foreground hover:bg-secondary/40"
          >
            <Plus className="w-4 h-4 mr-2" /> {t('builder.forms.projects.addProject')}
          </Button>
        )}
      </div>
    </div>
  );
};
