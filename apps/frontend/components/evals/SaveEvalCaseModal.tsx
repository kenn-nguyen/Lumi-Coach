'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { createEvalCase } from '@/lib/api/evals';

const TAG_OPTIONS = ['good', 'bad', 'edge-case', 'swe', 'pm', 'design', 'senior', 'junior'];

interface SaveEvalCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  tailoredResumeId: string;
}

export function SaveEvalCaseModal({ isOpen, onClose, tailoredResumeId }: SaveEvalCaseModalProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedTags([]);
      setNotes('');
      setError(null);
      setSaved(false);
    }
  }, [isOpen]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await createEvalCase(
        {
          tailored_resume_id: tailoredResumeId,
          tags: selectedTags,
          notes: notes.trim() || null,
        },
        { userScoped: true }
      );
      setSaved(true);
      setTimeout(() => {
        onClose();
        setSaved(false);
        setSelectedTags([]);
        setNotes('');
      }, 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Save as Eval Case</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-2">
          <div>
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-gray-600">
              Tags
            </p>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
                    selectedTags.includes(tag)
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-white text-gray-600 hover:bg-secondary'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 font-mono text-xs font-bold uppercase tracking-wider text-gray-600">
              Notes (optional)
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.stopPropagation();
              }}
              rows={3}
              placeholder="What makes this case interesting?"
              className="w-full resize-none rounded-2xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-foreground"
            />
          </div>
          {error && <p className="font-mono text-xs text-red-600">{error}</p>}
        </div>
        <DialogFooter className="px-6 pb-6 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || saved}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : null}
            {saved ? 'Saved!' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
