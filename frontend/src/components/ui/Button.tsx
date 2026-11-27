import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => {
    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'bg-slate-950 text-white hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500 shadow-xs',
      secondary:
        'bg-blue-700 text-white hover:bg-blue-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white',
      outline:
        'border border-stone-300 bg-white text-slate-800 hover:bg-stone-50 hover:border-stone-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
      ghost:
        'bg-transparent text-slate-700 hover:bg-stone-200/60 dark:text-slate-300 dark:hover:bg-slate-800',
      danger: 'bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600'
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-9 px-4 text-sm gap-2',
      lg: 'h-11 px-5 text-sm gap-2'
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
