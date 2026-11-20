import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, RefreshCw, X } from 'lucide-react';
import { getDispute, listDisputes, reviewDispute } from '../../api/admin.js';
import { getApiErrorMessage } from '../../api/errors.js';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState.jsx';

const PAGE_LIMIT = 20;

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function DisputeDetails({ dispute, onClose, onRefresh }) {
  const [decision, setDecision] = useState('ACCEPT');
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function submitReview(event) {
    event.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setActionError('Enter a review reason before submitting.');
      return;
    }
    if (trimmed.length > 2000) {
      setActionError('The review reason must be 2,000 characters or fewer.');
      return;
    }
    setIsSaving(true);
    setActionError('');
    try {
      await reviewDispute(dispute.issue.id, { decision, reason: trimmed });
      onRefresh();
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'The dispute review could not be saved.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="dispute-detail-title">
      <section className="my-auto w-full max-w-4xl rounded-2xl bg-[#f7f6ef] shadow-2xl">
        <header className="flex items-start justify-between gap-4 rounded-t-2xl bg-[#173d2b] px-5 py-4 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#e2c77f]">Citizen resolution dispute</p>
            <h2 id="dispute-detail-title" className="mt-1 text-xl font-semibold">Issue #{dispute.issue.id}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dispute details" className="rounded-lg p-2 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="space-y-5 p-4 sm:p-6">
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#e5e2d5] bg-white p-4"><p className="text-xs text-[#68736a]">Issue status</p><p className="mt-1 font-semibold text-[#20382a]">{dispute.issue.status.replaceAll('_', ' ')}</p></div>
            <div className="rounded-xl border border-[#e5e2d5] bg-white p-4"><p className="text-xs text-[#68736a]">Citizen reports</p><p className="mt-1 font-semibold text-[#20382a]">{dispute.issue.reportCount}</p></div>
            <div className="rounded-xl border border-[#e5e2d5] bg-white p-4"><p className="text-xs text-[#68736a]">Confirmations</p><p className="mt-1 font-semibold text-[#20382a]">{dispute.confirmationCount}</p></div>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold text-[#20382a]">Citizen reasons</h3>
            {dispute.disputes.map((entry, index) => (
              <article key={`${entry.submittedAt}-${index}`} className="rounded-xl border border-[#e5e2d5] bg-white p-4">
                <p className="whitespace-pre-wrap text-sm leading-6 text-[#34483a]">{entry.reason}</p>
                <p className="mt-2 text-xs text-[#68736a]">Submitted {formatDate(entry.submittedAt)}</p>
              </article>
            ))}
          </section>

          {dispute.evidence.length > 0 && (
            <section>
              <h3 className="mb-3 font-semibold text-[#20382a]">Repair evidence</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {dispute.evidence.map((entry) => (
                  <a key={entry.id} href={entry.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-[#e5e2d5] bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#477454]">
                    <img src={entry.url} alt={`${entry.stage.toLowerCase()} repair evidence`} loading="lazy" className="h-36 w-full object-cover" />
                    <span className="block p-2 text-xs text-[#68736a]">{entry.stage} · {formatDate(entry.createdAt)}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {dispute.workHistory.length > 0 && (
            <section className="rounded-xl border border-[#e5e2d5] bg-white p-4">
              <h3 className="font-semibold text-[#20382a]">Work history</h3>
              <ol className="mt-3 space-y-3">
                {dispute.workHistory.map((event) => (
                  <li key={event.id} className="border-l-2 border-[#d8c58f] pl-3 text-sm">
                    <p className="font-medium text-[#34483a]">{event.eventType.replaceAll('_', ' ')} · {event.team.name}</p>
                    <p className="mt-1 text-xs text-[#68736a]">{event.officer.name} · {formatDate(event.createdAt)}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {dispute.review ? (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="font-semibold text-emerald-900">Final review: {dispute.review.decision}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-emerald-900">{dispute.review.reason}</p>
              <p className="mt-2 text-xs text-emerald-800">Reviewed {formatDate(dispute.review.reviewedAt)} · status {dispute.review.statusBefore} → {dispute.review.statusAfter}</p>
            </section>
          ) : (
            <form onSubmit={submitReview} className="space-y-3 rounded-xl border border-[#e5e2d5] bg-white p-4">
              <div>
                <h3 className="font-semibold text-[#20382a]">Record a final review</h3>
                <p className="mt-1 text-sm text-[#68736a]">Accepting reopens the issue. Rejecting leaves it resolved. This decision is final.</p>
              </div>
              <label className="block text-sm font-medium text-[#34483a]">Decision
                <select value={decision} onChange={(event) => setDecision(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ded5] px-3">
                  <option value="ACCEPT">Accept dispute and reopen issue</option>
                  <option value="REJECT">Reject dispute and keep issue resolved</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-[#34483a]">Review reason
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} rows={4} required className="mt-1 w-full rounded-xl border border-[#d9ded5] px-3 py-2" />
                <span className="mt-1 block text-right text-xs text-[#68736a]">{reason.length}/2000</span>
              </label>
              {actionError && <p role="alert" className="rounded-lg bg-[#fff5f2] px-3 py-2 text-sm text-[#8b3c2d]">{actionError}</p>}
              <button type="submit" disabled={isSaving} className="min-h-11 rounded-xl bg-[#1d4933] px-5 text-sm font-semibold text-white disabled:opacity-50">{isSaving ? 'Saving review…' : 'Submit final review'}</button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

export default function Disputes() {
  const [items, setItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [dispute, setDispute] = useState(null);
  const [detailError, setDetailError] = useState('');
  const [detailRetry, setDetailRetry] = useState(0);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    listDisputes({ limit: PAGE_LIMIT, offset })
      .then((result) => {
        if (!active) return;
        setItems(result.items ?? []);
        setHasMore(Boolean(result.pagination?.hasMore));
      })
      .catch((error) => { if (active) setLoadError(getApiErrorMessage(error, 'Resolution disputes could not be loaded.')); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [offset, retry]);

  useEffect(() => {
    if (!selectedId) {
      setDispute(null);
      setDetailError('');
      return undefined;
    }
    let active = true;
    setDispute(null);
    setIsDetailLoading(true);
    setDetailError('');
    getDispute(selectedId)
      .then((result) => { if (active) setDispute(result.dispute); })
      .catch((error) => { if (active) setDetailError(getApiErrorMessage(error, 'Dispute details could not be loaded.')); })
      .finally(() => { if (active) setIsDetailLoading(false); });
    return () => { active = false; };
  }, [selectedId, detailRetry]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">Resolution review</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#20382a]">Citizen resolution disputes</h1>
        <p className="mt-2 text-sm leading-6 text-[#68736a]">Review citizen objections, repair evidence, and issue history before recording a final decision.</p>
      </header>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#20382a]">Open disputes</h2>
        <button type="button" onClick={() => setRetry((value) => value + 1)} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#1d4933] hover:bg-white"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</button>
      </div>
      {isLoading ? <LoadingState>Loading disputes…</LoadingState> : loadError ? <ErrorState onRetry={() => setRetry((value) => value + 1)}>{loadError}</ErrorState> : items.length === 0 ? <EmptyState>There are no open resolution disputes.</EmptyState> : (
        <section className="overflow-hidden rounded-2xl border border-[#e5e2d5] bg-white shadow-sm">
          <ul className="divide-y divide-[#ebe9df]">
            {items.map((item) => (
              <li key={item.issueId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <h3 className="font-semibold text-[#20382a]">Issue #{item.issueId}</h3>
                  <p className="mt-1 text-sm text-[#68736a]">{item.disputeCount} dispute{item.disputeCount === 1 ? '' : 's'} · {item.confirmationCount} confirmations</p>
                  <p className="mt-1 text-xs text-[#68736a]">Latest dispute {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.latestDisputeAt))}</p>
                </div>
                <button type="button" onClick={() => setSelectedId(item.issueId)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#1d4933] px-4 text-sm font-semibold text-white hover:bg-[#163b29]"><Eye className="h-4 w-4" aria-hidden="true" /> Review</button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-[#ebe9df] px-4 py-3">
            <span className="text-xs text-[#68736a]">Page {Math.floor(offset / PAGE_LIMIT) + 1}</span>
            <div className="flex gap-2">
              <button type="button" disabled={offset === 0 || isLoading} onClick={() => setOffset((value) => Math.max(0, value - PAGE_LIMIT))} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#d9ded5] px-3 text-sm disabled:opacity-50"><ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous</button>
              <button type="button" disabled={!hasMore || isLoading} onClick={() => setOffset((value) => value + PAGE_LIMIT)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#d9ded5] px-3 text-sm disabled:opacity-50">Next <ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
            </div>
          </div>
        </section>
      )}
      {selectedId && (isDetailLoading ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"><LoadingState>Loading dispute details…</LoadingState></div>
      ) : detailError ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5">
            <p role="alert" className="text-sm text-[#8b3c2d]">{detailError}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setSelectedId(null)} className="min-h-10 rounded-lg border border-[#d9ded5] px-4 text-sm">Close</button>
              <button type="button" onClick={() => setDetailRetry((value) => value + 1)} className="min-h-10 rounded-lg bg-[#1d4933] px-4 text-sm font-semibold text-white">Retry</button>
            </div>
          </div>
        </div>
      ) : dispute ? <DisputeDetails dispute={dispute} onClose={() => setSelectedId(null)} onRefresh={() => { setRetry((value) => value + 1); setDetailRetry((value) => value + 1); }} /> : null)}
    </div>
  );
}
