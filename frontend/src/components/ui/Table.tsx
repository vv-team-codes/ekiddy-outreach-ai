import React from 'react';
import { cn } from '@/lib/utils';

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  emptyState
}: {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAll?: () => void;
  emptyState?: React.ReactNode;
}) {
  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const allSelected =
    selectedIds && data.length > 0 && data.every((row) => selectedIds.has(keyExtractor(row)));

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-950/60">
          <tr>
            {onToggleSelect && (
              <th className="w-10 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={Boolean(allSelected)}
                  onChange={onToggleAll}
                  aria-label="Select all rows"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400',
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
          {data.map((row) => {
            const id = keyExtractor(row);
            return (
              <tr
                key={id}
                className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
              >
                {onToggleSelect && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedIds?.has(id))}
                      onChange={() => onToggleSelect(id)}
                      aria-label={`Select row ${id}`}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn('px-4 py-3 text-slate-700 dark:text-slate-200', col.className)}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
