const statusStyles = {
  OPEN: 'bg-amber-50 text-amber-800 ring-amber-700/15',
  IN_PROGRESS: 'bg-sky-50 text-sky-800 ring-sky-700/15',
  RESOLVED: 'bg-emerald-50 text-emerald-800 ring-emerald-700/15',
  MERGED: 'bg-slate-100 text-slate-700 ring-slate-600/15',
  SUBMITTED: 'bg-emerald-50 text-emerald-800 ring-emerald-700/15',
  PENDING: 'bg-amber-50 text-amber-800 ring-amber-700/15',
  PROCESSING: 'bg-sky-50 text-sky-800 ring-sky-700/15',
  SUCCEEDED: 'bg-emerald-50 text-emerald-800 ring-emerald-700/15',
  FAILED: 'bg-rose-50 text-rose-800 ring-rose-700/15'
};

export default function StatusBadge({ status }) {
  if (!status) return null;
  const label = status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[status] ?? 'bg-stone-100 text-stone-700 ring-stone-600/15'}`}>{label}</span>;
}
