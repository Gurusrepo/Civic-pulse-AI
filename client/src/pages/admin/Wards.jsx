import { useEffect, useState } from 'react';
import { Edit3, RefreshCw, X } from 'lucide-react';
import { createWard, listWards, updateWard } from '../../api/admin.js';
import { getApiErrorMessage } from '../../api/errors.js';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState.jsx';

export default function Wards() {
  const [items, setItems] = useState([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [createForm, setCreateForm] = useState({ code: '', name: '' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ code: '', name: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    listWards({ includeInactive })
      .then((result) => { if (active) setItems(result.items ?? []); })
      .catch((error) => { if (active) setLoadError(getApiErrorMessage(error, 'Wards could not be loaded.')); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [includeInactive, retry]);

  async function submitCreate(event) {
    event.preventDefault();
    setIsSaving(true);
    setActionError('');
    setActionMessage('');
    try {
      await createWard({ code: createForm.code.trim(), name: createForm.name.trim() });
      setCreateForm({ code: '', name: '' });
      setActionMessage('Ward created.');
      setRetry((value) => value + 1);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Ward could not be created.'));
    } finally {
      setIsSaving(false);
    }
  }

  function beginEdit(ward) {
    setEditId(ward.id);
    setEditForm({ code: ward.code, name: ward.name });
    setActionError('');
    setActionMessage('');
  }

  async function submitEdit(event) {
    event.preventDefault();
    setIsSaving(true);
    setActionError('');
    setActionMessage('');
    try {
      await updateWard(editId, { code: editForm.code.trim(), name: editForm.name.trim() });
      setEditId(null);
      setActionMessage('Ward details updated.');
      setRetry((value) => value + 1);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Ward details could not be updated.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function setActive(ward, active) {
    setIsSaving(true);
    setActionError('');
    setActionMessage('');
    try {
      await updateWard(ward.id, { active });
      setActionMessage(active ? 'Ward activated.' : 'Ward deactivated.');
      setRetry((value) => value + 1);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Ward status could not be updated.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">Service areas</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#20382a]">Ward management</h1>
        <p className="mt-2 text-sm leading-6 text-[#68736a]">Create and update wards. Deactivation is soft and preserves teams, assignments, and membership history.</p>
      </header>

      <form onSubmit={submitCreate} className="grid gap-3 rounded-2xl border border-[#e5e2d5] bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
        <label className="text-sm font-medium text-[#34483a]">Ward code
          <input required maxLength={32} pattern="[A-Za-z0-9_\-]+" value={createForm.code} onChange={(event) => setCreateForm((current) => ({ ...current, code: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ded5] px-3" />
        </label>
        <label className="text-sm font-medium text-[#34483a]">Ward name
          <input required maxLength={100} value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ded5] px-3" />
        </label>
        <button type="submit" disabled={isSaving} className="min-h-11 rounded-xl bg-[#1d4933] px-5 text-sm font-semibold text-white disabled:opacity-50">{isSaving ? 'Saving…' : 'Create ward'}</button>
      </form>

      {actionError && <p role="alert" className="rounded-xl border border-[#e9c9c2] bg-[#fff5f2] px-4 py-3 text-sm text-[#8b3c2d]">{actionError}</p>}
      {actionMessage && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{actionMessage}</p>}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#20382a]">Wards</h2>
            <p className="mt-1 text-sm text-[#68736a]">Ward deactivation is blocked while active teams or assigned issues remain.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex min-h-10 items-center gap-2 text-sm text-[#34483a]"><input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} /> Include inactive</label>
            <button type="button" onClick={() => setRetry((value) => value + 1)} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#1d4933] hover:bg-white"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</button>
          </div>
        </div>

        {isLoading ? <LoadingState>Loading wards…</LoadingState> : loadError ? <ErrorState onRetry={() => setRetry((value) => value + 1)}>{loadError}</ErrorState> : items.length === 0 ? <EmptyState>No wards are available.</EmptyState> : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((ward) => (
              <article key={ward.id} className="rounded-2xl border border-[#e5e2d5] bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[#20382a]">{ward.code}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ward.active ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}>{ward.active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <p className="mt-1 text-sm text-[#68736a]">{ward.name}</p>
                    <p className="mt-2 text-xs text-[#68736a]">{ward.activeTeamCount} active teams · {ward.teamCount} total teams</p>
                  </div>
                  <button type="button" onClick={() => beginEdit(ward)} aria-label={`Edit ${ward.name}`} className="rounded-lg p-2 text-[#1d4933] hover:bg-[#f7f6ef]"><Edit3 className="h-4 w-4" aria-hidden="true" /></button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {ward.active
                    ? <button type="button" disabled={isSaving} onClick={() => setActive(ward, false)} className="min-h-9 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-800 disabled:opacity-50">Deactivate</button>
                    : <button type="button" disabled={isSaving} onClick={() => setActive(ward, true)} className="min-h-9 rounded-lg border border-[#d9ded5] px-3 text-xs font-semibold text-[#34483a] disabled:opacity-50">Activate</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editId !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-ward-title">
          <form onSubmit={submitEdit} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-[#9a7832]">Ward settings</p><h2 id="edit-ward-title" className="mt-1 text-xl font-semibold text-[#20382a]">Update ward</h2></div>
              <button type="button" aria-label="Close edit ward" onClick={() => setEditId(null)} className="rounded-lg p-2 hover:bg-[#f7f6ef]"><X className="h-5 w-5" aria-hidden="true" /></button>
            </div>
            <label className="block text-sm font-medium text-[#34483a]">Ward code<input required maxLength={32} pattern="[A-Za-z0-9_\-]+" value={editForm.code} onChange={(event) => setEditForm((current) => ({ ...current, code: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ded5] px-3" /></label>
            <label className="block text-sm font-medium text-[#34483a]">Ward name<input required maxLength={100} value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ded5] px-3" /></label>
            {actionError && <p role="alert" className="text-sm text-[#8b3c2d]">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditId(null)} className="min-h-10 rounded-lg border border-[#d9ded5] px-4 text-sm">Cancel</button>
              <button type="submit" disabled={isSaving} className="min-h-10 rounded-lg bg-[#1d4933] px-4 text-sm font-semibold text-white disabled:opacity-50">{isSaving ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
