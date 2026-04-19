'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PersonalInfo } from '@/components/dashboard/resume-component';
import { useTranslations } from '@/lib/i18n';

interface PersonalInfoFormProps {
  data: PersonalInfo;
  masterPersonalInfo?: PersonalInfo | null;
  onChange: (data: PersonalInfo) => void;
}

const REFRESHABLE_PERSONAL_INFO_FIELDS: (keyof PersonalInfo)[] = [
  'name',
  'customTagline',
  'email',
  'phone',
  'location',
  'website',
  'linkedin',
  'github',
];

export const PersonalInfoForm: React.FC<PersonalInfoFormProps> = ({
  data,
  masterPersonalInfo,
  onChange,
}) => {
  const { t } = useTranslations();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const builderEditableFieldClass =
    'rounded-xl border-border bg-white font-semibold focus-visible:border-primary focus-visible:ring-primary/25';

  const handleChange = (field: keyof PersonalInfo, value: string) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handleRefreshFromMaster = () => {
    if (!masterPersonalInfo) {
      return;
    }

    const nextData: PersonalInfo = {
      ...data,
    };

    for (const field of REFRESHABLE_PERSONAL_INFO_FIELDS) {
      nextData[field] = masterPersonalInfo[field] ?? undefined;
    }

    onChange(nextData);
  };

  return (
    <div
      className={`rounded-2xl border border-border bg-card/80 p-6 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ${
        isCollapsed ? '' : 'space-y-4'
      }`}
    >
      <div
        className={`flex items-center justify-between gap-3 ${
          isCollapsed ? '' : 'mb-4 border-b border-border pb-3'
        }`}
      >
        <h3 className="font-serif text-xl font-bold">{t('builder.personalInfo')}</h3>
        <div className="flex items-center gap-2">
          {masterPersonalInfo ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRefreshFromMaster}
              title={t('builder.personalInfoForm.refreshFromMasterTitle')}
              className="h-8 gap-1 rounded-xl border border-border bg-white px-3 font-mono text-[10px] uppercase tracking-wider text-foreground hover:bg-secondary/50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('builder.personalInfoForm.refreshFromMaster')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-gray-500 hover:bg-secondary/60 hover:text-gray-700"
            onClick={() => setIsCollapsed((current) => !current)}
            title={
              isCollapsed
                ? `Expand ${t('builder.personalInfo')}`
                : `Collapse ${t('builder.personalInfo')}`
            }
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
      {isCollapsed ? null : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            id="name"
            value={data.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.name')}
            className={builderEditableFieldClass}
          />
          <Input
            id="title"
            value={data.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.title')}
            className={builderEditableFieldClass}
          />
          <Input
            id="customTagline"
            value={data.customTagline || ''}
            onChange={(e) => handleChange('customTagline', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.customTagline')}
            className={builderEditableFieldClass}
          />
          <Input
            id="email"
            type="email"
            value={data.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.email')}
            className={builderEditableFieldClass}
          />
          <Input
            id="phone"
            type="tel"
            value={data.phone || ''}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.phone')}
            className={builderEditableFieldClass}
          />
          <Input
            id="location"
            value={data.location || ''}
            onChange={(e) => handleChange('location', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.location')}
            className={builderEditableFieldClass}
          />
          <Input
            id="linkedin"
            value={data.linkedin || ''}
            onChange={(e) => handleChange('linkedin', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.linkedin')}
            className={builderEditableFieldClass}
          />
          <Input
            id="github"
            value={data.github || ''}
            onChange={(e) => handleChange('github', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.github')}
            className={builderEditableFieldClass}
          />
          <Input
            id="website"
            value={data.website || ''}
            onChange={(e) => handleChange('website', e.target.value)}
            placeholder={t('builder.personalInfoForm.placeholders.website')}
            className={builderEditableFieldClass}
          />
        </div>
      )}
    </div>
  );
};
