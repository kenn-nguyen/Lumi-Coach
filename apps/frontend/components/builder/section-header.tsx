'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import type { SectionMeta } from '@/components/dashboard/resume-component';
import { useTranslations } from '@/lib/i18n';

interface SectionHeaderProps {
  section: SectionMeta;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onUndoDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisibility: () => void;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  headerActions?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * SectionHeader Component
 *
 * Provides controls for section management:
 * - Editable display name
 * - Move up/down buttons for reordering
 * - Delete button with confirmation
 * - Visibility toggle
 */
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  section,
  onRename,
  onDelete,
  onUndoDelete,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  isFirst,
  isLast,
  canDelete,
  headerActions,
  children,
}) => {
  const { t } = useTranslations();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(section.displayName);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleStartEdit = () => {
    setEditedName(section.displayName);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (editedName.trim()) {
      onRename(editedName.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedName(section.displayName);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const isPersonalInfo = section.id === 'personalInfo';
  const isHidden = !section.isVisible;
  const isPendingRemoval = section.pendingRemoval === true;

  return (
    <div
      className={`space-y-0 rounded-[24px] border p-6 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ${
        isPendingRemoval
          ? 'border-dashed border-orange-300 bg-[rgba(255,249,240,0.92)]'
          : isHidden
          ? 'border-dashed border-gray-300 bg-[rgba(255,255,255,0.72)] opacity-70'
          : 'border-border bg-[rgba(255,253,248,0.92)]'
      }`}
    >
      {/* Section Header */}
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
        {/* Section Name (editable) */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-10 w-56 rounded-xl border-border bg-white font-serif text-lg font-bold"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-700 hover:text-green-800 hover:bg-green-50"
                onClick={handleSaveEdit}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                onClick={handleCancelEdit}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <h3 className="font-serif text-xl font-bold">{section.displayName}</h3>
              {!isPersonalInfo && !isPendingRemoval && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full text-gray-400 hover:bg-secondary/60 hover:text-gray-600"
                  onClick={handleStartEdit}
                  title={t('builder.sectionHeader.renameSection')}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              )}
              {!section.isDefault && (
                <span className="border border-border bg-white px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gray-400">
                  {t('builder.sectionHeader.customTag')}
                </span>
              )}
              {isHidden && !isPendingRemoval && (
                <span className="border border-orange-300 bg-white px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-orange-600">
                  {t('builder.sectionHeader.hiddenFromPdfTag')}
                </span>
              )}
              {isPendingRemoval && (
                <span className="border border-orange-300 bg-white px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-orange-600">
                  {t('builder.sectionHeader.pendingRemovalTag')}
                </span>
              )}
            </>
          )}
        </div>

        {/* Section Controls */}
        <div className="flex items-center gap-1">
          {isPendingRemoval ? null : headerActions}

          {isPendingRemoval ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-full border border-border bg-white px-3 text-xs font-semibold text-foreground hover:bg-secondary/60"
              onClick={onUndoDelete}
            >
              {t('builder.sectionHeader.undoRemove')}
            </Button>
          ) : null}

          {/* Visibility Toggle */}
          {!isPersonalInfo && !isPendingRemoval && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full hover:bg-secondary/60 ${section.isVisible ? 'text-gray-500' : 'text-gray-300'}`}
              onClick={onToggleVisibility}
              title={
                section.isVisible
                  ? t('builder.sectionHeader.hideSection')
                  : t('builder.sectionHeader.showSection')
              }
            >
              {section.isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
          )}

          {/* Move Up */}
          {!isPersonalInfo && !isPendingRemoval && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-gray-500 hover:bg-secondary/60 hover:text-gray-700 disabled:opacity-30"
              onClick={onMoveUp}
              disabled={isFirst}
              title={t('builder.sectionHeader.moveUp')}
            >
              <ArrowUp className="w-4 h-4" />
            </Button>
          )}

          {/* Move Down */}
          {!isPersonalInfo && !isPendingRemoval && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-gray-500 hover:bg-secondary/60 hover:text-gray-700 disabled:opacity-30"
              onClick={onMoveDown}
              disabled={isLast}
              title={t('builder.sectionHeader.moveDown')}
            >
              <ArrowDown className="w-4 h-4" />
            </Button>
          )}

          {/* Delete / Hide */}
          {canDelete && !isPendingRemoval && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDeleteClick}
              title={t('builder.sectionHeader.deleteSection')}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Section Content */}
      {children}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('builder.sectionHeader.deleteTitle')}
        description={t('builder.sectionHeader.deleteDescription', { name: section.displayName })}
        confirmLabel={t('builder.sectionHeader.deleteSection')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={onDelete}
      />
    </div>
  );
};
