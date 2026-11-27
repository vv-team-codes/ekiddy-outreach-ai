import React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-stone-200/90 bg-white shadow-[0_1px_2px_rgba(17,19,24,0.04)] dark:border-slate-800 dark:bg-[#111622]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 px-5 py-3.5 dark:border-slate-800',
        className
      )}
    >
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

export function MetricCard({
  label,
  value,
  sublabel,
  icon
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-4 transition-colors hover:border-stone-300 dark:hover:border-slate-700">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        {icon && (
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {icon}
          </div>
        )}
      </div>
      <div className="font-display mt-2.5 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
        {value}
      </div>
      {sublabel && <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sublabel}</div>}
    </Card>
  );
}
