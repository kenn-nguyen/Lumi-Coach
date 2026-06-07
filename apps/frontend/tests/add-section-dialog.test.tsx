import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddSectionDialog } from '@/components/builder/add-section-dialog';
import type { SectionMeta } from '@/components/dashboard/resume-component';

vi.mock('@/lib/i18n', () => ({
  useTranslations: () => ({
    t: (key: string) => key,
  }),
}));

describe('AddSectionDialog', () => {
  it('shows missing built-in sections and restores them directly', () => {
    const missingDefaultSections: SectionMeta[] = [
      {
        id: 'personalProjects',
        key: 'personalProjects',
        displayName: 'Projects',
        sectionType: 'itemList',
        isDefault: true,
        isVisible: true,
        order: 4,
      },
    ];

    const onRestoreDefaultSection = vi.fn();

    render(
      <AddSectionDialog
        open
        onOpenChange={vi.fn()}
        onAdd={vi.fn()}
        missingDefaultSections={missingDefaultSections}
        onRestoreDefaultSection={onRestoreDefaultSection}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Projects/i }));

    expect(onRestoreDefaultSection).toHaveBeenCalledWith('personalProjects');
  });
});
