import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAnnouncement } from '../../api/announcements.js';
import { getApiErrorMessage } from '../../api/errors.js';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { requestOnce } from '../../utils/requestOnce.js';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(date);
}

export default function AnnouncementDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [announcement, setAnnouncement] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError('');
    setAnnouncement(null);
    requestOnce(`citizen:${user?.id}:announcement:${id}:${retry}`, () => getAnnouncement(id))
      .then((result) => { if (active) setAnnouncement(result.announcement); })
      .catch((requestError) => { if (active) setError(getApiErrorMessage(requestError, 'Announcement could not be loaded.')); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [id, retry, user?.id]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to="/citizen/announcements" className="inline-flex min-h-10 items-center text-sm font-semibold text-[#1d4933] underline underline-offset-4">Back to announcements</Link>
      {isLoading ? <LoadingState>Loading announcement...</LoadingState> : error ? (
        <ErrorState onRetry={() => setRetry((value) => value + 1)}>{error}</ErrorState>
      ) : !announcement ? (
        <EmptyState>This announcement could not be found.</EmptyState>
      ) : (
        <article className="space-y-4 rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">Community announcement · {formatDate(announcement.publishedAt)}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#20382a]">{announcement.title}</h1>
          <p className="whitespace-pre-wrap text-sm leading-7 text-[#526258]">{announcement.description}</p>
        </article>
      )}
    </div>
  );
}
