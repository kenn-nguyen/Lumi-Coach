import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'default'
    | 'destructive'
    | 'success'
    | 'warning'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const baseStyles = cn(
      'inline-flex items-center justify-center gap-2 whitespace-nowrap',
      'text-sm font-semibold tracking-[0.01em]',
      'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0"
    );

    const variants = {
      default: cn(
        'rounded-full border border-primary/10 bg-primary text-white shadow-sm',
        'hover:bg-[#173ce0]'
      ),
      destructive: cn(
        'rounded-full border border-red-200 bg-[#b54444] text-white shadow-sm',
        'hover:bg-[#993939]'
      ),
      success: cn(
        'rounded-full border border-emerald-200 bg-[#1f7a57] text-white shadow-sm',
        'hover:bg-[#176042]'
      ),
      warning: cn(
        'rounded-full border border-amber-200 bg-[#b56a17] text-white shadow-sm',
        'hover:bg-[#955712]'
      ),
      outline: cn(
        'rounded-full border border-border bg-card text-foreground shadow-xs',
        'hover:bg-secondary'
      ),
      secondary: cn(
        'rounded-full border border-border bg-secondary text-foreground shadow-xs',
        'hover:bg-[#ece7db]'
      ),
      ghost: cn('rounded-xl bg-transparent text-foreground shadow-none hover:bg-secondary/70'),
      link: cn(
        'h-auto rounded-none border-none bg-transparent px-0 py-0 text-primary shadow-none',
        'underline-offset-4 hover:underline'
      ),
    };

    const sizes = {
      default: 'h-10 px-5 py-2',
      sm: 'h-9 px-4 py-1 text-xs',
      lg: 'h-12 px-6 py-3 text-base',
      icon: 'h-10 w-10 rounded-xl p-0',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
