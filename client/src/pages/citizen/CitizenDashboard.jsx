import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAnnouncements } from '../../api/announcements.js';
import { getApiErrorMessage } from '../../api/errors.js';
import { getComplaintSummary, listComplaints } from '../../api/complaints.js';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState.jsx';
import ComplaintCard from '../../components/citizen/ComplaintCard.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { requestOnce } from '../../utils/requestOnce.js';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

const statistics = [
  { key: 'total', title: 'Total complaints', color: 'border-[#d4ae58]' },
  { key: 'open', title: 'Open', color: 'border-amber-400' },
  { key: 'inProgress', title: 'In progress', color: 'border-sky-500' },
  { key: 'resolved', title: 'Resolved', color: 'border-emerald-500' }
];

export default function CitizenDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [complaintsLoading, setComplaintsLoading] = useState(true);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');
  const [complaintsError, setComplaintsError] = useState('');
  const [announcementsError, setAnnouncementsError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setSummaryLoading(true);
    setComplaintsLoading(true);
    setAnnouncementsLoading(true);
    setSummaryError('');
    setComplaintsError('');
    setAnnouncementsError('');

    requestOnce(`citizen:${user?.id}:dashboard:summary:${retry}`, getComplaintSummary)
      .then(({ summary: result }) => { if (active) setSummary(result); })
      .catch((error) => { if (active) setSummaryError(getApiErrorMessage(error, 'Complaint totals could not be loaded.')); })
      .finally(() => { if (active) setSummaryLoading(false); });

    requestOnce(`citizen:${user?.id}:dashboard:recent:${retry}`, () => listComplaints({ limit: 4, offset: 0 }))
      .then((result) => { if (active) setComplaints(Array.isArray(result.items) ? result.items : []); })
      .catch((error) => { if (active) setComplaintsError(getApiErrorMessage(error, 'Recent complaints could not be loaded.')); })
      .finally(() => { if (active) setComplaintsLoading(false); });

    requestOnce(`citizen:${user?.id}:dashboard:announcements:${retry}`, () => listAnnouncements({ limit: 3, offset: 0 }))
      .then((result) => { if (active) setAnnouncements(Array.isArray(result.items) ? result.items : []); })
      .catch((error) => { if (active) setAnnouncementsError(getApiErrorMessage(error, 'Announcements could not be loaded.')); })
      .finally(() => { if (active) setAnnouncementsLoading(false); });

    return () => { active = false; };
  }, [retry, user?.id]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="relative isolate overflow-hidden rounded-3xl bg-[#1d4933] px-6 py-8 text-white shadow-sm sm:px-9 sm:py-10">
        <div aria-hidden="true" className="absolute -right-12 -top-20 -z-10 h-64 w-64 rounded-full border border-white/10 sm:h-80 sm:w-80" />
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#e2c77f]">NamMakkal · Your citizen dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome, {user?.name ?? 'Citizen'}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75">Together, we can make our neighbourhood a better place. Follow the issues you have reported and see how your community is progressing.</p>
          </div>
          <Link to="/citizen/complaints/new" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-[#e2c77f] px-5 text-sm font-bold text-[#213c2a] shadow-sm transition hover:bg-[#efd995] focus:outline-none focus:ring-4 focus:ring-white/30">Report an issue</Link>
        </div>
      </section>

      <section aria-label="Complaint totals" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#20382a]">Your complaint activity</h2>
        </div>
        {summaryLoading ? <LoadingState>Loading complaint totals...</LoadingState> : summaryError ? (
          <ErrorState onRetry={() => setRetry((value) => value + 1)}>{summaryError}</ErrorState>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {statistics.map((stat) => (
                <article key={stat.key} className={`rounded-2xl border-l-4 ${stat.color} bg-white p-4 shadow-sm sm:p-5`}>
                  <p className="text-xs font-medium text-[#68736a] sm:text-sm">{stat.title}</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums text-[#20382a]">{summary?.[stat.key] ?? 0}</p>
                </article>
              ))}
            </div>
            <p className="text-xs leading-5 text-[#68736a]">Status totals reflect civic issue progress. The total also includes reports linked to merged issues.</p>
          </>
        )}
      </section>

      <section aria-labelledby="recent-complaints-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">Your activity</p>
            <h2 id="recent-complaints-heading" className="mt-1 text-2xl font-semibold text-[#20382a]">Recent complaints</h2>
          </div>
          <Link to="/citizen/complaints" className="min-h-10 rounded-lg px-3 py-2 text-sm font-semibold text-[#1d4933] underline decoration-[#d4ae58] underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#477454]/30">View all complaints</Link>
        </div>
        {complaintsLoading ? <LoadingState>Loading your recent complaints...</LoadingState> : complaintsError ? (
          <ErrorState onRetry={() => setRetry((value) => value + 1)}>{complaintsError}</ErrorState>
        ) : complaints.length === 0 ? (
          <EmptyState>You have not reported an issue yet. Your latest reports will appear here.</EmptyState>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">{complaints.map((complaint) => <ComplaintCard key={complaint.id} complaint={complaint} />)}</div>
        )}
      </section>

      <section aria-labelledby="announcements-heading" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">From your community</p>
            <h2 id="announcements-heading" className="mt-1 text-2xl font-semibold text-[#20382a]">Latest announcements</h2>
          </div>
          <Link to="/citizen/announcements" className="min-h-10 rounded-lg px-3 py-2 text-sm font-semibold text-[#1d4933] underline decoration-[#d4ae58] underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#477454]/30">View all announcements</Link>
        </div>
        {announcementsLoading ? <LoadingState>Loading announcements...</LoadingState> : announcementsError ? (
          <ErrorState onRetry={() => setRetry((value) => value + 1)}>{announcementsError}</ErrorState>
        ) : announcements.length === 0 ? (
          <EmptyState>There are no public announcements yet. Please check back soon.</EmptyState>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {announcements.map((announcement) => (
              <article key={announcement.id} className="flex flex-col rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm">
                <p className="text-xs font-medium text-[#758077]">{formatDate(announcement.publishedAt)}</p>
                <h3 className="mt-2 text-lg font-semibold text-[#20382a]">{announcement.title}</h3>
                <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-[#68736a]">{announcement.description}</p>
                <Link to={`/citizen/announcements/${announcement.id}`} className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-[#1d4933] underline decoration-[#d4ae58] underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#477454]/30">View announcement</Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="quick-actions-heading" className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">Shortcuts</p>
          <h2 id="quick-actions-heading" className="mt-1 text-2xl font-semibold text-[#20382a]">Quick actions</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/citizen/complaints/new" className="rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm transition hover:border-[#c9d5c8] focus:outline-none focus:ring-4 focus:ring-[#477454]/20">
            <span className="text-sm font-semibold text-[#20382a]">Report an issue</span>
            <span className="mt-1 block text-sm text-[#68736a]">Tell your local team what needs attention.</span>
          </Link>
          <Link to="/citizen/complaints" className="rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm transition hover:border-[#c9d5c8] focus:outline-none focus:ring-4 focus:ring-[#477454]/20">
            <span className="text-sm font-semibold text-[#20382a]">Track complaints</span>
            <span className="mt-1 block text-sm text-[#68736a]">Check updates on your submitted reports.</span>
          </Link>
          <Link to="/citizen/announcements" className="rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm transition hover:border-[#c9d5c8] focus:outline-none focus:ring-4 focus:ring-[#477454]/20">
            <span className="text-sm font-semibold text-[#20382a]">View announcements</span>
            <span className="mt-1 block text-sm text-[#68736a]">Read news and notices for the community.</span>
          </Link>
          <Link to="/citizen/profile" className="rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm transition hover:border-[#c9d5c8] focus:outline-none focus:ring-4 focus:ring-[#477454]/20">
            <span className="text-sm font-semibold text-[#20382a]">Access profile</span>
            <span className="mt-1 block text-sm text-[#68736a]">Review and update your account details.</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
