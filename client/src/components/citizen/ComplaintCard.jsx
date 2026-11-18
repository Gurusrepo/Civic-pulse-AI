import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export default function ComplaintCard({ complaint }) {
  return (
    <article className="rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm transition hover:border-[#c9d5c8] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#758077]">Report #{complaint.id} · {formatDate(complaint.createdAt)}</p>
          <h3 className="mt-2 break-words text-lg font-semibold text-[#20382a]">{complaint.title}</h3>
        </div>
        <dl className="flex shrink-0 flex-wrap gap-2">
          <div className="space-y-1">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-[#68736a]">Civic issue</dt>
            <dd><StatusBadge status={complaint.issueStatus} /></dd>
          </div>
          <div className="space-y-1">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-[#68736a]">Your complaint</dt>
            <dd><StatusBadge status={complaint.status} /></dd>
          </div>
        </dl>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#68736a]">{complaint.description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0e9] pt-4">
        <p className="text-xs text-[#758077]">{complaint.reportCount ?? 1} {complaint.reportCount === 1 ? 'community report' : 'community reports'}</p>
        <Link className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-[#1d4933] underline decoration-[#d4ae58] underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#477454]/30" to={`/citizen/complaints/${complaint.id}`}>View details</Link>
      </div>
    </article>
  );
}
