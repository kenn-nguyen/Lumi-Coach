'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Plus, Trash2 } from 'lucide-react';
import type { CustomSectionItem } from '@/components/dashboard/resume-component';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface GenericItemFormProps {
  items: CustomSectionItem[];
  onChange: (items: CustomSectionItem[]) => void;
  itemLabel?: string;
  addLabel?: string;
  showSubtitle?: boolean;
  showLocation?: boolean;
  showYears?: boolean;
  titlePlaceholder?: string;
  subtitlePlaceholder?: string;
  locationPlaceholder?: string;
  yearsPlaceholder?: string;
  descriptionPlaceholder?: string;
}

/**
 * Generic Item Form Component
 *
 * Used for ITEM_LIST type sections (like Experience, Education, Projects).
 * Renders a list of items with configurable fields.
 */
export const GenericItemForm: React.FC<GenericItemFormProps> = ({
  items,
  onChange,
  itemLabel,
  addLabel,
  showSubtitle = true,
  showLocation = true,
  showYears = true,
  titlePlaceholder,
  subtitlePlaceholder,
  locationPlaceholder,
  yearsPlaceholder,
  descriptionPlaceholder,
}) => {
  const { t } = useTranslations();
  const builderEditableFieldClass =
    'rounded-xl border-border bg-white focus-visible:border-primary focus-visible:ring-primary/25';

  const finalItemLabel = itemLabel ?? t('builder.genericItemForm.itemLabel');
  const finalAddLabel =
    addLabel ?? t('builder.genericItemForm.addItemLabel', { label: finalItemLabel });

  const finalTitlePlaceholder = titlePlaceholder ?? t('builder.genericItemForm.placeholders.title');
  const finalSubtitlePlaceholder =
    subtitlePlaceholder ?? t('builder.genericItemForm.placeholders.organization');
  const finalLocationPlaceholder =
    locationPlaceholder ?? t('builder.genericItemForm.placeholders.location');
  const finalYearsPlaceholder = yearsPlaceholder ?? t('builder.genericItemForm.placeholders.years');
  const finalDescriptionPlaceholder =
    descriptionPlaceholder ?? t('builder.genericItemForm.placeholders.description');

  const handleAdd = () => {
    const newId = Math.max(...items.map((d) => d.id), 0) + 1;
    onChange([
      ...items,
      {
        id: newId,
        title: '',
        subtitle: '',
        location: '',
        years: '',
        description: [''],
      },
    ]);
  };

  const handleRemove = (id: number) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const handleChange = (id: number, field: keyof CustomSectionItem, value: string | string[]) => {
    onChange(
      items.map((item) => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const handleDescriptionChange = (id: number, index: number, value: string) => {
    onChange(
      items.map((item) => {
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
      items.map((item) => {
        if (item.id === id) {
          return { ...item, description: [...(item.description || []), ''] };
        }
        return item;
      })
    );
  };

  const handleRemoveDescription = (id: number, index: number) => {
    onChange(
      items.map((item) => {
        if (item.id === id) {
          const newDesc = [...(item.description || [])];
          newDesc.splice(index, 1);
          return { ...item, description: newDesc };
        }
        return item;
      })
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-8">
        {items.map((item) => (
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

            <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3 pr-8">
              <div className="space-y-2">
                <Input
                  value={item.title || ''}
                  onChange={(e) => handleChange(item.id, 'title', e.target.value)}
                  placeholder={finalTitlePlaceholder}
                  className={cn(builderEditableFieldClass, 'font-semibold')}
                />
              </div>
              {showYears ? (
                <div className="space-y-2">
                  <Input
                    value={item.years || ''}
                    onChange={(e) => handleChange(item.id, 'years', e.target.value)}
                    placeholder={finalYearsPlaceholder}
                    className={cn(builderEditableFieldClass, 'font-semibold')}
                  />
                </div>
              ) : showSubtitle ? (
                <div className="space-y-2">
                  <Input
                    value={item.subtitle || ''}
                    onChange={(e) => handleChange(item.id, 'subtitle', e.target.value)}
                    placeholder={finalSubtitlePlaceholder}
                    className={cn(builderEditableFieldClass, 'font-semibold')}
                  />
                </div>
              ) : showLocation ? (
                <div className="space-y-2">
                  <Input
                    value={item.location || ''}
                    onChange={(e) => handleChange(item.id, 'location', e.target.value)}
                    placeholder={finalLocationPlaceholder}
                    className={cn(builderEditableFieldClass, 'font-normal')}
                  />
                </div>
              ) : null}
              {showYears && showSubtitle ? (
                <div className="space-y-2">
                  <Input
                    value={item.subtitle || ''}
                    onChange={(e) => handleChange(item.id, 'subtitle', e.target.value)}
                    placeholder={finalSubtitlePlaceholder}
                    className={cn(builderEditableFieldClass, 'font-normal')}
                  />
                </div>
              ) : null}
              {showLocation && (showYears || showSubtitle) ? (
                <div className="space-y-2">
                  <Input
                    value={item.location || ''}
                    onChange={(e) => handleChange(item.id, 'location', e.target.value)}
                    placeholder={finalLocationPlaceholder}
                    className={cn(builderEditableFieldClass, 'font-normal')}
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="flex items-center">
                <Label className="font-mono text-xs uppercase tracking-wider text-gray-500">
                  {t('builder.genericItemForm.fields.descriptionPoints')}
                </Label>
              </div>
              {item.description?.map((desc, idx) => (
                <div key={idx} className="flex gap-2">
                  <div className="flex-1">
                    <RichTextEditor
                      value={desc}
                      onChange={(html) => handleDescriptionChange(item.id, idx, html)}
                      placeholder={finalDescriptionPlaceholder}
                      minHeight="60px"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveDescription(item.id, idx)}
                    className="h-[60px] w-8 text-muted-foreground hover:text-destructive self-end"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
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

        {items.length === 0 && (
          <div className="text-center py-12 rounded-2xl border border-dashed border-border bg-card/70">
            <p className="font-mono text-sm text-gray-500 mb-4">
              {t('builder.genericItemForm.noEntries', { label: finalItemLabel })}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAdd}
              className="h-10 rounded-xl border border-dashed border-border bg-white px-4 text-sm text-foreground hover:bg-secondary/40"
            >
              <Plus className="w-4 h-4 mr-2" />{' '}
              {t('builder.genericItemForm.addFirstItem', { label: finalItemLabel })}
            </Button>
          </div>
        )}
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            className="h-10 w-full justify-center rounded-xl border border-dashed border-border bg-white text-sm text-foreground hover:bg-secondary/40"
          >
            <Plus className="w-4 h-4 mr-2" /> {finalAddLabel}
          </Button>
        )}
      </div>
    </div>
  );
};
