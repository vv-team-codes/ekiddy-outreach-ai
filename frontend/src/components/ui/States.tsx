import React from 'react';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 dark:bg-slate-800 ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {icon || <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50/70 px-6 py-8 text-center dark:border-rose-900 dark:bg-rose-950/30">
      <AlertCircle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
      <h3 className="mt-2 text-sm font-semibold text-rose-900 dark:text-rose-200">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-rose-700 dark:text-rose-300">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
