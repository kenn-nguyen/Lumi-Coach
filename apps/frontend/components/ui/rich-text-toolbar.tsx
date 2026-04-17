'use client';

import React from 'react';
import { Editor } from '@tiptap/react';
import { Bold, Italic, Underline, Link, X } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface RichTextToolbarProps {
  editor: Editor;
  onLinkClick: () => void;
  onClose?: () => void;
}

/**
 * Rich Text Toolbar Component
 *
 * Bright skin formatting toolbar for dense editing workflows.
 */
export const RichTextToolbar: React.FC<RichTextToolbarProps> = ({
  editor,
  onLinkClick,
  onClose,
}) => {
  const tools = [
    {
      icon: Bold,
      label: 'Bold',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
      shortcut: 'Ctrl+B',
    },
    {
      icon: Italic,
      label: 'Italic',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
      shortcut: 'Ctrl+I',
    },
    {
      icon: Underline,
      label: 'Underline',
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: editor.isActive('underline'),
      shortcut: 'Ctrl+U',
    },
    {
      icon: Link,
      label: 'Link',
      action: onLinkClick,
      isActive: editor.isActive('link'),
      shortcut: 'Ctrl+K',
    },
  ];

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-[rgba(255,253,248,0.96)] p-1.5 shadow-xs">
      {tools.map((tool) => (
        <Button
          key={tool.label}
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.preventDefault();
            tool.action();
          }}
          title={`${tool.label} (${tool.shortcut})`}
          className={cn(
            'h-8 w-8 rounded-xl',
            tool.isActive && 'bg-primary text-white hover:bg-[#173ce0] hover:text-white'
          )}
        >
          <tool.icon className="w-4 h-4" />
        </Button>
      ))}
      {onClose ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.preventDefault();
            onClose();
          }}
          title="Close formatting"
          className="ml-auto h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </Button>
      ) : null}
    </div>
  );
};
