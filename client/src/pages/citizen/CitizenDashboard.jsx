import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listComplaints } from '../../api/complaints.js';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState.jsx';
import ComplaintCard from '../../components/citizen/ComplaintCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { requestOnce } from '../../utils/requestOnce.js';

const PAGE_LIMIT = 50;

async function fetchAllCitizenComplaints() {
  const allItems = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const page = await listComplaints({ limit: PAGE_LIMIT, offset });
    const items = Array.isArray(page.items) ? page.items : [];
    allItems.push(...items);
    hasMore = Boolean(page.pagination?.hasMore);
    offset += PAGE_LIMIT;
    if (hasMore && offset > 1_000_000) throw new Error('The complaint list exceeds the supported pagination range.');
  }
  return allItems;
}

const statistics = [
  { key: 'total', title: 'Total complaints', color: 'border-[#d4ae58]' },
  { key: 'OPEN', title: 'Open', color: 'border-amber-400' },
  { key: 'IN_PROGRESS', title: 'In progress', color: 'border-sky-500' },
  { key: 'RESOLVED', title: 'Resolved', color: 'border-emerald-500' }
];

export default function CitizenDashboard() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    requestOnce(`citizen:${user?.id}:dashboard:all-complaints`, fetchAllCitizenComplaints)
      .then((items) => { if (active) setComplaints(items); })
      .catch((requestError) => { if (active) setError(requestError); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [retry, user?.id]);

  const counts = complaints.reduce((result, complaint) => {
    const status = complaint.issueStatus;
    if (status && Object.hasOwn(result, status)) result[status] += 1;
    return result;
  }, { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0 });

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-[#1d4933] px-6 py-8 text-white sm:px-9 sm:py-10">
        <div aria-hidden="true" className="absolute -right-12 -top-20 h-64 w-64 rounded-full border border-white/10 sm:h-80 sm:w-80" />
        <div className="relative z-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e2c77f]">Citizen space</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome, {user?.name ?? 'Citizen'}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">Follow the civic concerns you have reported and see how your neighbourhood is progressing.</p>
          </div>
          <Link to="/citizen/complaints/new" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-[#e2c77f] px-5 text-sm font-bold text-[#213c2a] shadow-sm transition hover:bg-[#efd995] focus:outline-none focus:ring-4 focus:ring-white/30">Report a complaint</Link>
        </div>
      </section>

      {isLoading ? <LoadingState>Loading your complaint summary...</LoadingState> : error ? (
        <ErrorState onRetry={() => setRetry((value) => value + 1)}>We could not load your complaints. {error.message}</ErrorState>
      ) : (
        <>
          <section aria-label="Complaint totals" className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {statistics.map((stat) => (
              <article key={stat.key} className={`rounded-2xl border-l-4 ${stat.color} bg-white p-4 shadow-sm sm:p-5`}>
                <p className="text-xs font-medium text-[#68736a] sm:text-sm">{stat.title}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-[#20382a]">{stat.key === 'total' ? complaints.length : counts[stat.key]}</p>
              </article>
            ))}
          </section>
          <section aria-labelledby="recent-complaints-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">Your activity</p>
                <h2 id="recent-complaints-heading" className="mt-1 text-2xl font-semibold text-[#20382a]">Recent complaints</h2>
              </div>
              {complaints.length > 0 && <Link to="/citizen/complaints" className="min-h-10 rounded-lg px-3 py-2 text-sm font-semibold text-[#1d4933] underline decoration-[#d4ae58] underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#477454]/30">View all</Link>}
            </div>
            {complaints.length === 0 ? (
              <EmptyState>You have not reported a complaint yet. Your submissions will appear here.</EmptyState>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">{complaints.slice(0, 4).map((complaint) => <ComplaintCard key={complaint.id} complaint={complaint} />)}</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
