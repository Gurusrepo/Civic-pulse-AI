import { EmptyState, ErrorState, LoadingState } from '../AsyncState.jsx';

function formatTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function eventTitle(event) {
  if (event.eventType === 'DISPUTE_REVIEWED') {
    return event.decision === 'ACCEPTED' ? 'Dispute accepted by an administrator' : 'Dispute rejected by an administrator';
  }
  return {
    REPORT_SUBMITTED: 'Complaint submitted',
    WORK_STARTED: 'Work started on the civic issue',
    ISSUE_RESOLVED: 'Civic issue marked resolved',
    RESOLUTION_CONFIRMED: 'You confirmed the resolution',
    RESOLUTION_DISPUTED: 'You disputed the resolution'
  }[event.eventType] ?? 'Civic issue updated';
}

export default function IssueTimeline({ items, isLoading, error, onRetry }) {
  return (
    <section aria-labelledby="timeline-heading" className="space-y-4 rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">Progress updates</p>
        <h2 id="timeline-heading" className="mt-1 text-xl font-semibold text-[#20382a]">Complaint timeline</h2>
      </div>
      {isLoading && !items ? <LoadingState>Loading complaint timeline...</LoadingState> : error && !items ? (
        <ErrorState onRetry={onRetry}>{error}</ErrorState>
      ) : !items?.length ? (
        <EmptyState>No timeline updates are available yet.</EmptyState>
      ) : (
        <ol className="space-y-5">
          {items.map((item, index) => (
            <li key={item.id} className="relative min-w-0 border-l border-[#d9ded5] pl-5 last:border-transparent">
              <span aria-hidden="true" className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-[#1d4933] ring-2 ring-white" />
              <h3 className="break-words text-sm font-semibold text-[#34483a]">{eventTitle(item)}</h3>
              <time dateTime={item.createdAt} className="mt-1 block text-xs text-[#68736a]">{formatTimestamp(item.createdAt)}</time>
              {index === items.length - 1 && <span className="sr-only">Latest update</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
