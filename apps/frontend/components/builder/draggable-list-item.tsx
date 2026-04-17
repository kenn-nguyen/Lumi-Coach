'use client';

import React, { useEffect, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface DraggableListItemProps {
  id: number;
  children: React.ReactNode;
}

/**
 * DraggableListItem Component
 *
 * Generic wrapper for list items (experience, education, projects, etc.) to make them draggable using @dnd-kit.
 * Provides:
 * - Drag handle (grip icon) for initiating drag operations
 * - Visual feedback during drag (opacity, cursor)
 * - Keyboard accessibility for drag operations
 * - Swiss International Style aesthetic (square corners, high contrast)
 */
export const DraggableListItem: React.FC<DraggableListItemProps> = ({ id, children }) => {
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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group/item relative">
      {/* Drag Handle */}
      {mounted ? (
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-4 top-2 z-10 flex h-5 w-5 items-center justify-center cursor-grab opacity-0 transition-opacity group-hover/item:opacity-100 group-focus-within/item:opacity-100 active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4 text-gray-400 transition-colors hover:text-gray-700" />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="absolute -left-4 top-2 z-10 flex h-5 w-5 items-center justify-center opacity-0"
        >
          <GripVertical className="h-4 w-4 text-transparent" />
        </div>
      )}

      {/* List Item Content */}
      <div>{children}</div>
    </div>
  );
};
