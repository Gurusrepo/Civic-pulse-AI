import { useEffect, useState } from 'react';
import {
  AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock,
  ExternalLink, Eye, Filter, Image as ImageIcon, Mail, MessageSquare,
  Phone, RefreshCw, Search, User, X, XCircle
} from 'lucide-react';
import {
  listReportedProblems,
  getReportedProblem,
  updateReportedProblemStatus
} from '../../api/admin.js';
import { getApiErrorMessage } from '../../api/errors.js';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState.jsx';
import { useTranslation } from '../../i18n/LocaleProvider.jsx';

const PAGE_LIMIT = 15;

const STATUS_CONFIG = {
  NEW: {
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    icon: Clock
  },
  IN_PROGRESS: {
    bg: 'bg-sky-50 text-sky-800 border-sky-200',
    dot: 'bg-sky-500',
    icon: RefreshCw
  },
  RESOLVED: {
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    icon: CheckCircle2
  },
  REJECTED: {
    bg: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-500',
    icon: XCircle
  }
};

const CATEGORIES = [
  'LOGIN_ISSUE',
  'PROFILE_ISSUE',
  'TECHNICAL_ERROR',
  'UI_DESIGN',
  'OTHER'
];

const STATUSES = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'];

function formatDate(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export default function ReportedProblems() {
  const { locale, t } = useTranslation();

  // Filter state
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [offset, setOffset] = useState(0);

  // Data state
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Detail & Edit Modal state
  const [selectedReference, setSelectedReference] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Status update form inside modal
  const [editStatus, setEditStatus] = useState('NEW');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  // Image lightbox state
  const [showLightbox, setShowLightbox] = useState(false);

  // Fetch problems list
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');

    const params = {
      limit: PAGE_LIMIT,
      offset
    };
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;
    if (searchQuery.trim()) params.search = searchQuery.trim();

    listReportedProblems(params)
      .then((res) => {
        if (!active) return;
        setItems(res.items || []);
        setTotalCount(res.pagination?.total ?? 0);
        setHasMore(Boolean(res.pagination?.hasMore));
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(getApiErrorMessage(err, t('admin.reportedProblems.loadError')));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [statusFilter, categoryFilter, searchQuery, offset, refreshTrigger, t]);

  // Fetch single problem details when modal opens
  useEffect(() => {
    if (!selectedReference) {
      setDetailData(null);
      setSaveSuccess('');
      setSaveError('');
      return;
    }

    let active = true;
    setIsDetailLoading(true);
    setDetailError('');
    setSaveSuccess('');
    setSaveError('');

    getReportedProblem(selectedReference)
      .then((res) => {
        if (!active) return;
        const problem = res.problem;
        setDetailData(problem);
        setEditStatus(problem.status);
        setEditNotes(problem.adminNotes || '');
      })
      .catch((err) => {
        if (!active) return;
        setDetailError(getApiErrorMessage(err, t('admin.reportedProblems.detailLoadError')));
      })
      .finally(() => {
        if (active) setIsDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedReference, t]);

  // Handle status update submission
  async function handleStatusSubmit(e) {
    e.preventDefault();
    if (!selectedReference) return;

    setIsSaving(true);
    setSaveSuccess('');
    setSaveError('');

    try {
      const res = await updateReportedProblemStatus(selectedReference, {
        status: editStatus,
        adminNotes: editNotes.trim() || null
      });
      const updated = res.problem;
      setDetailData(updated);
      setEditStatus(updated.status);
      setEditNotes(updated.adminNotes || '');
      setSaveSuccess(t('admin.reportedProblems.updateSuccess'));

      // Update in items list without full refetch
      setItems((prev) =>
        prev.map((item) =>
          item.referenceId === updated.referenceId
            ? {
                ...item,
                status: updated.status,
                adminNotes: updated.adminNotes,
                updatedAt: updated.updatedAt,
                closedAt: updated.closedAt
              }
            : item
        )
      );
    } catch (err) {
      setSaveError(getApiErrorMessage(err, t('admin.reportedProblems.updateError')));
    } finally {
      setIsSaving(false);
    }
  }

  function handleFilterReset() {
    setStatusFilter('');
    setCategoryFilter('');
    setSearchQuery('');
    setOffset(0);
  }

  const hasActiveFilters = Boolean(statusFilter || categoryFilter || searchQuery);

  const startIdx = totalCount === 0 ? 0 : offset + 1;
  const endIdx = Math.min(offset + PAGE_LIMIT, totalCount);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">
            {t('admin.reportedProblems.eyebrow')}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#20382a] sm:text-3xl">
            {t('admin.reportedProblems.title')}
          </h1>
          <p className="mt-1 text-sm text-[#68736a]">
            {t('admin.reportedProblems.intro')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9ded5] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#20382a] shadow-xs">
            <span className="h-2 w-2 rounded-full bg-[#1d4933]" />
            {t('admin.reportedProblems.pageInfo', {
              from: startIdx,
              to: endIdx,
              total: totalCount
            })}
          </span>
          <button
            type="button"
            onClick={() => setRefreshTrigger((c) => c + 1)}
            aria-label={t('admin.reportedProblems.retry')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#d9ded5] bg-white text-[#20382a] transition hover:bg-[#f7f8f5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#477454]"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <section
        aria-label={t('admin.reportedProblems.filterStatus')}
        className="rounded-2xl border border-[#e5e2d5] bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#758077]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setOffset(0);
              }}
              placeholder={t('admin.reportedProblems.searchPlaceholder')}
              className="h-11 w-full rounded-xl border border-[#d9ded5] bg-[#fafaf7] pl-10 pr-4 text-sm text-[#20382a] placeholder-[#758077] outline-none transition focus:border-[#477454] focus:bg-white focus:ring-4 focus:ring-[#477454]/10"
            />
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setOffset(0);
              }}
              aria-label={t('admin.reportedProblems.filterStatus')}
              className="h-11 w-full rounded-xl border border-[#d9ded5] bg-[#fafaf7] px-3 text-sm text-[#20382a] outline-none transition focus:border-[#477454] focus:bg-white focus:ring-4 focus:ring-[#477454]/10"
            >
              <option value="">{t('admin.reportedProblems.allStatuses')}</option>
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {t(`admin.reportedProblems.statuses.${st}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setOffset(0);
              }}
              aria-label={t('admin.reportedProblems.filterCategory')}
              className="h-11 w-full rounded-xl border border-[#d9ded5] bg-[#fafaf7] px-3 text-sm text-[#20382a] outline-none transition focus:border-[#477454] focus:bg-white focus:ring-4 focus:ring-[#477454]/10"
            >
              <option value="">{t('admin.reportedProblems.allCategories')}</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {t(`admin.reportedProblems.categories.${cat}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-center">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleFilterReset}
                className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#d9ded5] bg-[#f7f8f5] px-4 text-sm font-semibold text-[#20382a] transition hover:bg-[#eceee8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#477454]"
              >
                <X className="h-4 w-4" />
                {t('admin.reportedProblems.clearFilters')}
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs text-[#758077]">
                <Filter className="h-4 w-4" />
                <span>{t('admin.reportedProblems.allStatuses')}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main List Section */}
      {isLoading ? (
        <LoadingState>{t('admin.reportedProblems.loading')}</LoadingState>
      ) : loadError ? (
        <ErrorState onRetry={() => setRefreshTrigger((c) => c + 1)}>
          {loadError}
        </ErrorState>
      ) : items.length === 0 ? (
        <EmptyState>
          <div className="text-center">
            <p className="font-semibold text-[#20382a]">
              {hasActiveFilters
                ? t('admin.reportedProblems.emptyTitle')
                : t('admin.reportedProblems.emptyAll')}
            </p>
            {hasActiveFilters && (
              <p className="mt-1 text-sm text-[#758077]">
                {t('admin.reportedProblems.emptyDescription')}
              </p>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleFilterReset}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#1d4933] px-4 py-2 text-sm font-semibold text-white hover:bg-[#163b29]"
              >
                {t('admin.reportedProblems.clearFilters')}
              </button>
            )}
          </div>
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e5e2d5] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#20382a]">
              <thead className="border-b border-[#e5e2d5] bg-[#f7f8f5] text-xs font-semibold uppercase tracking-wider text-[#758077]">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    {t('admin.reportedProblems.tableReference')}
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    {t('admin.reportedProblems.tableProblem')}
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    {t('admin.reportedProblems.tableCategory')}
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    {t('admin.reportedProblems.tableReporter')}
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    {t('admin.reportedProblems.tableStatus')}
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    {t('admin.reportedProblems.tableDate')}
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    {t('admin.reportedProblems.tableAction')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece8db]">
                {items.map((item) => {
                  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.NEW;
                  return (
                    <tr
                      key={item.referenceId}
                      className="transition hover:bg-[#fafaf7]"
                    >
                      {/* Reference ID */}
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-xs font-semibold text-[#876527]">
                        <span className="rounded-md bg-[#f4efe2] px-2 py-1">
                          {item.referenceId}
                        </span>
                      </td>

                      {/* Title & Description preview */}
                      <td className="max-w-xs px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-semibold text-[#20382a]">
                            {item.title}
                          </p>
                          {item.hasScreenshot && (
                            <span
                              title={t('admin.reportedProblems.hasAttachment')}
                              className="shrink-0 text-[#1d4933]"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-1 mt-0.5 text-xs text-[#758077]">
                          {item.description}
                        </p>
                      </td>

                      {/* Category */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className="inline-flex rounded-lg border border-[#e5e2d5] bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700">
                          {t(`admin.reportedProblems.categories.${item.category}`)}
                        </span>
                      </td>

                      {/* Reporter */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="text-xs font-semibold text-[#20382a]">
                          {item.user?.displayName || '—'}
                        </p>
                        <p className="text-xs text-[#758077]">
                          {item.user?.email || '—'}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                          {t(`admin.reportedProblems.statuses.${item.status}`)}
                        </span>
                      </td>

                      {/* Submitted Date */}
                      <td className="whitespace-nowrap px-5 py-4 text-xs text-[#758077]">
                        {formatDate(item.createdAt, locale)}
                      </td>

                      {/* Action */}
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedReference(item.referenceId)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d4933] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#163b29] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#477454]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t('admin.reportedProblems.viewDetails')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col gap-3 border-t border-[#e5e2d5] bg-[#f7f8f5] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#758077]">
              {t('admin.reportedProblems.pageInfo', {
                from: startIdx,
                to: endIdx,
                total: totalCount
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset((cur) => Math.max(0, cur - PAGE_LIMIT))}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#d9ded5] bg-white px-3 text-xs font-semibold text-[#20382a] transition hover:bg-[#f7f8f5] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                {t('admin.reportedProblems.paginationPrevious')}
              </button>
              <button
                type="button"
                disabled={!hasMore}
                onClick={() => setOffset((cur) => cur + PAGE_LIMIT)}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#d9ded5] bg-white px-3 text-xs font-semibold text-[#20382a] transition hover:bg-[#f7f8f5] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('admin.reportedProblems.paginationNext')}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Problem Details & Management Modal */}
      {selectedReference && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="problem-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-2xl rounded-3xl border border-[#e5e2d5] bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#e5e2d5] bg-[#f7f8f5] px-6 py-4 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-[#f4efe2] px-2.5 py-1 font-mono text-xs font-semibold text-[#876527]">
                  {selectedReference}
                </span>
                <h2
                  id="problem-detail-title"
                  className="text-base font-semibold text-[#20382a]"
                >
                  {t('admin.reportedProblems.detailTitle')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReference(null)}
                aria-label={t('admin.reportedProblems.close')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#758077] hover:bg-[#e5e2d5] hover:text-[#20382a]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">
              {isDetailLoading ? (
                <LoadingState>{t('admin.reportedProblems.loading')}</LoadingState>
              ) : detailError ? (
                <ErrorState>{detailError}</ErrorState>
              ) : detailData ? (
                <>
                  {/* Status Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e5e2d5] bg-[#fafaf7] p-4">
                    <div>
                      <p className="text-xs text-[#758077]">
                        {t('admin.reportedProblems.submittedOn', {
                          date: formatDate(detailData.createdAt, locale)
                        })}
                      </p>
                      {detailData.closedAt && (
                        <p className="mt-0.5 text-xs font-medium text-emerald-800">
                          {t('admin.reportedProblems.closedOn', {
                            date: formatDate(detailData.closedAt, locale)
                          })}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                        STATUS_CONFIG[detailData.status]?.bg ||
                        STATUS_CONFIG.NEW.bg
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          STATUS_CONFIG[detailData.status]?.dot ||
                          STATUS_CONFIG.NEW.dot
                        }`}
                      />
                      {t(`admin.reportedProblems.statuses.${detailData.status}`)}
                    </span>
                  </div>

                  {/* Problem Details */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-[#20382a]">
                        {detailData.title}
                      </h3>
                      <span className="shrink-0 rounded-lg border border-[#e5e2d5] bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700">
                        {t(
                          `admin.reportedProblems.categories.${detailData.category}`
                        )}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#758077]">
                        {t('admin.reportedProblems.description')}
                      </h4>
                      <p className="mt-1.5 whitespace-pre-wrap rounded-xl border border-[#f0eee6] bg-[#fafaf7] p-3.5 text-sm leading-6 text-[#20382a]">
                        {detailData.description}
                      </p>
                    </div>
                  </div>

                  {/* Screenshot Section */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#758077]">
                      {t('admin.reportedProblems.screenshotTitle')}
                    </h4>
                    {detailData.screenshotUrl ? (
                      <div className="rounded-2xl border border-[#e5e2d5] bg-[#fafaf7] p-3">
                        <div className="relative overflow-hidden rounded-xl bg-black/5">
                          <img
                            src={detailData.screenshotUrl}
                            alt={t('admin.reportedProblems.screenshotTitle')}
                            className="max-h-64 w-full object-contain cursor-pointer transition hover:opacity-95"
                            onClick={() => setShowLightbox(true)}
                          />
                        </div>
                        <div className="mt-2.5 flex justify-end">
                          <a
                            href={detailData.screenshotUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1d4933] underline underline-offset-4 hover:text-[#163b29]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t('admin.reportedProblems.viewFullImage')}
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-xl border border-dashed border-[#d9ded5] p-4 text-center text-xs text-[#758077]">
                        {t('admin.reportedProblems.noScreenshot')}
                      </p>
                    )}
                  </div>

                  {/* Reporter Information */}
                  <div className="rounded-2xl border border-[#e5e2d5] bg-[#f7f8f5] p-4 space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#758077]">
                      {t('admin.reportedProblems.reporterInfo')}
                    </h4>
                    <div className="grid gap-2 text-sm sm:grid-cols-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-[#758077]" />
                        <span className="font-semibold text-[#20382a]">
                          {detailData.user?.displayName || '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-[#758077]" />
                        {detailData.user?.email ? (
                          <a
                            href={`mailto:${detailData.user.email}`}
                            className="truncate text-[#1d4933] underline underline-offset-2"
                          >
                            {detailData.user.email}
                          </a>
                        ) : (
                          <span className="text-[#758077]">—</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-[#758077]" />
                        {detailData.user?.phoneNumber ? (
                          <a
                            href={`tel:${detailData.user.phoneNumber}`}
                            className="text-[#1d4933] underline underline-offset-2"
                          >
                            {detailData.user.phoneNumber}
                          </a>
                        ) : (
                          <span className="text-xs text-[#758077]">
                            {t('admin.reportedProblems.noPhone')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status & Internal Notes Update Form */}
                  <form
                    onSubmit={handleStatusSubmit}
                    className="rounded-2xl border border-[#d4ae58]/50 bg-[#fffdf5] p-4 sm:p-5 space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-[#9a7832]" />
                      <h4 className="text-sm font-semibold text-[#20382a]">
                        {t('admin.reportedProblems.updateStatusTitle')}
                      </h4>
                    </div>

                    {/* Status radio / select */}
                    <div>
                      <label
                        htmlFor="problem-status-select"
                        className="mb-1.5 block text-xs font-semibold text-[#34483a]"
                      >
                        {t('admin.reportedProblems.statusLabel')}
                      </label>
                      <select
                        id="problem-status-select"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="h-11 w-full rounded-xl border border-[#d9ded5] bg-white px-3 text-sm font-semibold text-[#20382a] outline-none focus:border-[#477454] focus:ring-4 focus:ring-[#477454]/10"
                      >
                        {STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {t(`admin.reportedProblems.statuses.${st}`)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Admin Notes textarea */}
                    <div>
                      <label
                        htmlFor="problem-admin-notes"
                        className="mb-1.5 block text-xs font-semibold text-[#34483a]"
                      >
                        {t('admin.reportedProblems.adminNotesLabel')}
                      </label>
                      <textarea
                        id="problem-admin-notes"
                        rows={3}
                        maxLength={5000}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder={t('admin.reportedProblems.adminNotesPlaceholder')}
                        className="w-full rounded-xl border border-[#d9ded5] bg-white p-3 text-sm text-[#20382a] placeholder-[#758077] outline-none focus:border-[#477454] focus:ring-4 focus:ring-[#477454]/10"
                      />
                      <p className="mt-1 text-right text-xs text-[#758077]">
                        {editNotes.length}/5000
                      </p>
                    </div>

                    {/* Banners */}
                    {saveSuccess && (
                      <p
                        role="status"
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800"
                      >
                        {saveSuccess}
                      </p>
                    )}
                    {saveError && (
                      <p
                        role="alert"
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-800"
                      >
                        {saveError}
                      </p>
                    )}

                    {/* Save Button */}
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#1d4933] px-5 text-sm font-semibold text-white transition hover:bg-[#163b29] disabled:cursor-wait disabled:opacity-60"
                      >
                        {isSaving
                          ? t('admin.reportedProblems.saving')
                          : t('admin.reportedProblems.saveChanges')}
                      </button>
                    </div>
                  </form>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox for screenshot */}
      {showLightbox && detailData?.screenshotUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowLightbox(false)}
        >
          <div
            className="relative max-h-screen max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowLightbox(false)}
              className="absolute -top-10 right-0 text-white hover:text-stone-300"
              aria-label={t('admin.reportedProblems.close')}
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={detailData.screenshotUrl}
              alt={detailData.title}
              className="max-h-[85vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
