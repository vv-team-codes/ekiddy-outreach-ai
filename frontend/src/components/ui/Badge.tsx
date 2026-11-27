import React from 'react';
import { cn } from '@/lib/utils';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'indigo';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-stone-100 text-slate-700 border border-stone-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  warning: 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  danger: 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  info: 'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  indigo: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
};

export function Badge({
  children,
  tone = 'neutral',
  className
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusIndicator({ status }: { status: string }) {
  const lower = status.toLowerCase();
  let tone: BadgeTone = 'neutral';
  if (
    ['active', 'verified', 'completed', 'approved', 'connected', 'interested', 'positive response', 'scheduled'].includes(
      lower
    )
  ) {
    tone = 'success';
  } else if (['paused', 'unverified', 'ready for review', 'researching', 'running', 'queued', 'rescheduled'].includes(lower)) {
    tone = 'warning';
  } else if (['failed', 'invalid', 'bounced', 'cancelled', 'error', 'unsubscribed', 'negative response'].includes(lower)) {
    tone = 'danger';
  } else if (['meeting request', 'demo', 'test_mode'].includes(lower)) {
    tone = 'indigo';
  }

  return <Badge tone={tone}>{status}</Badge>;
}
