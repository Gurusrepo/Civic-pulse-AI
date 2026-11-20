import { useEffect, useState } from 'react';
import { Edit3, RefreshCw, UsersRound, X } from 'lucide-react';
import {
  addTeamMember,
  createTeam,
  getTeam,
  listOfficers,
  listTeamMembers,
  listTeams,
  listWards,
  removeTeamMember,
  updateTeam
} from '../../api/admin.js';
import { getApiErrorMessage } from '../../api/errors.js';
import { EmptyState, ErrorState, LoadingState } from '../../components/AsyncState.jsx';

const DEPARTMENTS = ['Roads & Infrastructure', 'Water Supply', 'Drainage', 'Sanitation', 'Electricity', 'Public Health', 'Public Works', 'General Administration'];

function TeamDetails({ teamId, onClose, onRefresh }) {
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [officerId, setOfficerId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    Promise.all([
      getTeam(teamId),
      listTeamMembers(teamId, { includeHistory: true }),
      listOfficers({ limit: 50, offset: 0, status: 'ACTIVE' })
    ])
      .then(([teamResult, memberResult, officerResult]) => {
        if (!active) return;
        setTeam(teamResult.team);
        setMembers(memberResult.items ?? []);
        setOfficers(officerResult.items ?? []);
      })
      .catch((error) => { if (active) setLoadError(getApiErrorMessage(error, 'Team details could not be loaded.')); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [teamId, retry]);

  const activeOfficerIds = new Set(members.filter((member) => member.active).map((member) => member.officer.id));
  const availableOfficers = officers.filter((officer) => !activeOfficerIds.has(officer.id));

  async function addMember(event) {
    event.preventDefault();
    if (!officerId) {
      setActionError('Choose an active officer.');
      return;
    }
    setIsSaving(true);
    setActionError('');
    setActionMessage('');
    try {
      await addTeamMember(teamId, { officerId: Number(officerId) });
      setOfficerId('');
      setActionMessage('Officer added to the team.');
      setRetry((value) => value + 1);
      onRefresh();
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Officer could not be added to the team.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function removeMember(member) {
    setIsSaving(true);
    setActionError('');
    setActionMessage('');
    try {
      await removeTeamMember(teamId, member.officer.id);
      setActionMessage('Officer removed. Membership history was retained.');
      setRetry((value) => value + 1);
      onRefresh();
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Officer could not be removed from the team.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="team-details-title">
      <section className="my-auto w-full max-w-3xl rounded-2xl bg-[#f7f6ef] shadow-2xl">
        <header className="flex items-start justify-between gap-4 rounded-t-2xl bg-[#173d2b] px-5 py-4 text-white">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#e2c77f]">{team?.ward?.code ?? 'Ward team'}</p>
            <h2 id="team-details-title" className="mt-1 text-xl font-semibold">{team?.name ?? 'Team members'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close team details" className="rounded-lg p-2 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"><X className="h-5 w-5" aria-hidden="true" /></button>
        </header>
        <div className="space-y-4 p-4 sm:p-6">
          {isLoading ? <LoadingState>Loading team members…</LoadingState> : loadError ? <ErrorState onRetry={() => setRetry((value) => value + 1)}>{loadError}</ErrorState> : (
            <>
              <section className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#e5e2d5] bg-white p-3"><p className="text-xs text-[#68736a]">Ward</p><p className="mt-1 text-sm font-semibold text-[#20382a]">{team.ward.name}</p></div>
                <div className="rounded-xl border border-[#e5e2d5] bg-white p-3"><p className="text-xs text-[#68736a]">Department</p><p className="mt-1 text-sm font-semibold text-[#20382a]">{team.department}</p></div>
                <div className="rounded-xl border border-[#e5e2d5] bg-white p-3"><p className="text-xs text-[#68736a]">Active officers</p><p className="mt-1 text-sm font-semibold text-[#20382a]">{team.activeMemberCount}</p></div>
              </section>
              <form onSubmit={addMember} className="flex flex-col gap-2 rounded-xl border border-[#e5e2d5] bg-white p-4 sm:flex-row">
                <select aria-label="Select officer" value={officerId} onChange={(event) => setOfficerId(event.target.value)} disabled={!team.active || isSaving} className="min-h-11 flex-1 rounded-xl border border-[#d9ded5] px-3 text-sm">
                  <option value="">Add an active officer</option>{availableOfficers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name} · {officer.employeeId || 'No employee ID'} · {officer.email}</option>)}
                </select>
                <button type="submit" disabled={!team.active || isSaving || !officerId} className="min-h-11 rounded-xl bg-[#1d4933] px-4 text-sm font-semibold text-white disabled:opacity-50">Add member</button>
              </form>
              {!team.active && <p className="text-sm text-[#68736a]">Activate the team before changing membership.</p>}
              <section className="rounded-xl border border-[#e5e2d5] bg-white p-4">
                <h3 className="font-semibold text-[#20382a]">Membership history</h3>
                {members.length === 0 ? <EmptyState>No officers have been added to this team.</EmptyState> : (
                  <ul className="mt-2 divide-y divide-[#ebe9df]">
                    {members.map((member) => (
                      <li key={member.membershipId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#34483a]">{member.officer.name} · {member.officer.email}</p>
                          <p className="mt-1 text-xs text-[#68736a]">{member.officer.status} · Added by {member.addedBy.name}{member.removedAt ? ` · Removed by ${member.removedBy.name}` : ''}</p>
                        </div>
                        {member.active && <button type="button" disabled={isSaving || !team.active} onClick={() => removeMember(member)} className="min-h-9 self-start rounded-lg border border-[#d9ded5] px-3 text-xs font-semibold text-[#34483a] disabled:opacity-50">Remove member</button>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {actionError && <p role="alert" className="rounded-lg bg-[#fff5f2] px-3 py-2 text-sm text-[#8b3c2d]">{actionError}</p>}
              {actionMessage && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{actionMessage}</p>}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function Teams() {
  const [items, setItems] = useState([]);
  const [wards, setWards] = useState([]);
  const [wardsError, setWardsError] = useState('');
  const [wardsRetry, setWardsRetry] = useState(0);
  const [wardId, setWardId] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [createForm, setCreateForm] = useState({ wardId: '', name: '', department: DEPARTMENTS[0] });
  const [editForm, setEditForm] = useState({ wardId: '', name: '', department: DEPARTMENTS[0] });
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const activeWards = wards.filter((ward) => ward.active);

  useEffect(() => {
    let active = true;
    setWardsError('');
    listWards({ includeInactive: true })
      .then((result) => { if (active) setWards(result.items ?? []); })
      .catch((error) => { if (active) setWardsError(getApiErrorMessage(error, 'Wards could not be loaded.')); });
    return () => { active = false; };
  }, [wardsRetry]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError('');
    const params = { includeInactive };
    if (wardId) params.wardId = Number(wardId);
    listTeams(params)
      .then((result) => { if (active) setItems(result.items ?? []); })
      .catch((error) => { if (active) setLoadError(getApiErrorMessage(error, 'Ward teams could not be loaded.')); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [wardId, includeInactive, retry]);

  async function submitCreate(event) {
    event.preventDefault();
    setIsSaving(true);
    setActionError('');
    setActionMessage('');
    try {
      await createTeam({ ...createForm, wardId: Number(createForm.wardId) });
      setCreateForm({ wardId: '', name: '', department: DEPARTMENTS[0] });
      setActionMessage('Ward team created.');
      setRetry((value) => value + 1);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Ward team could not be created.'));
    } finally {
      setIsSaving(false);
    }
  }

  function beginEdit(team) {
    setEditId(team.id);
    setEditForm({ wardId: String(team.ward.id), name: team.name, department: team.department });
    setActionError('');
    setActionMessage('');
  }

  async function submitEdit(event) {
    event.preventDefault();
    setIsSaving(true);
    setActionError('');
    setActionMessage('');
    try {
      await updateTeam(editId, { wardId: Number(editForm.wardId), name: editForm.name.trim(), department: editForm.department });
      setEditId(null);
      setActionMessage('Ward team updated.');
      setRetry((value) => value + 1);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Ward team could not be updated.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function setActive(team, active) {
    setIsSaving(true);
    setActionError('');
    setActionMessage('');
    try {
      await updateTeam(team.id, { active });
      setActionMessage(active ? 'Ward team activated.' : 'Ward team deactivated.');
      setRetry((value) => value + 1);
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Ward team status could not be updated.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">Staff operations</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#20382a]">Ward teams</h1>
        <p className="mt-2 text-sm leading-6 text-[#68736a]">Manage team departments, ward assignments, and officer membership history.</p>
      </header>

      <form onSubmit={submitCreate} className="grid gap-3 rounded-2xl border border-[#e5e2d5] bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1.2fr_1.4fr_auto] lg:items-end">
        <label className="text-sm font-medium text-[#34483a]">Ward
          <select required value={createForm.wardId} onChange={(event) => setCreateForm((current) => ({ ...current, wardId: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ded5] px-3">
            <option value="">Select a ward</option>{activeWards.map((ward) => <option key={ward.id} value={ward.id}>{ward.code} · {ward.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-[#34483a]">Team name
          <input required maxLength={100} value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ded5] px-3" />
        </label>
        <label className="text-sm font-medium text-[#34483a]">Department
          <select value={createForm.department} onChange={(event) => setCreateForm((current) => ({ ...current, department: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ded5] px-3">
            {DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}
          </select>
        </label>
        <button type="submit" disabled={isSaving || Boolean(wardsError) || activeWards.length === 0} className="min-h-11 rounded-xl bg-[#1d4933] px-5 text-sm font-semibold text-white disabled:opacity-50">{isSaving ? 'Saving…' : 'Create team'}</button>
      </form>

      {wardsError && <ErrorState onRetry={() => setWardsRetry((value) => value + 1)}>{wardsError}</ErrorState>}
      {actionError && <p role="alert" className="rounded-xl border border-[#e9c9c2] bg-[#fff5f2] px-4 py-3 text-sm text-[#8b3c2d]">{actionError}</p>}
      {actionMessage && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{actionMessage}</p>}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 className="text-xl font-semibold text-[#20382a]">Teams</h2><p className="mt-1 text-sm text-[#68736a]">Teams with assigned issues or active members cannot be deactivated or moved.</p></div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-[#34483a]">Ward
              <select value={wardId} onChange={(event) => setWardId(event.target.value)} className="ml-2 min-h-10 rounded-lg border border-[#d9ded5] px-2">
                <option value="">All wards</option>{wards.map((ward) => <option key={ward.id} value={ward.id}>{ward.code}</option>)}
              </select>
            </label>
            <label className="inline-flex min-h-10 items-center gap-2 text-sm text-[#34483a]"><input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} /> Include inactive</label>
            <button type="button" onClick={() => setRetry((value) => value + 1)} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#1d4933] hover:bg-white"><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</button>
          </div>
        </div>

        {isLoading ? <LoadingState>Loading ward teams…</LoadingState> : loadError ? <ErrorState onRetry={() => setRetry((value) => value + 1)}>{loadError}</ErrorState> : items.length === 0 ? <EmptyState>No ward teams are available for this filter.</EmptyState> : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((team) => (
              <article key={team.id} className="rounded-2xl border border-[#e5e2d5] bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[#20382a]">{team.name}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${team.active ? 'bg-emerald-50 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}>{team.active ? 'Active' : 'Inactive'}</span></div>
                    <p className="mt-1 text-sm text-[#68736a]">{team.ward.code} · {team.ward.name}</p>
                    <p className="mt-1 text-sm text-[#34483a]">{team.department}</p>
                    <p className="mt-2 text-xs text-[#68736a]">{team.activeMemberCount} active officers</p>
                  </div>
                  <button type="button" onClick={() => beginEdit(team)} aria-label={`Edit ${team.name}`} className="rounded-lg p-2 text-[#1d4933] hover:bg-[#f7f6ef]"><Edit3 className="h-4 w-4" aria-hidden="true" /></button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSelectedId(team.id)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#d9ded5] px-3 text-xs font-semibold text-[#34483a]"><UsersRound className="h-4 w-4" aria-hidden="true" /> Members</button>
                  {team.active
                    ? <button type="button" disabled={isSaving} onClick={() => setActive(team, false)} className="min-h-9 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-800 disabled:opacity-50">Deactivate</button>
                    : <button type="button" disabled={isSaving} onClick={() => setActive(team, true)} className="min-h-9 rounded-lg border border-[#d9ded5] px-3 text-xs font-semibold text-[#34483a] disabled:opacity-50">Activate</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedId && <TeamDetails teamId={selectedId} onClose={() => setSelectedId(null)} onRefresh={() => setRetry((value) => value + 1)} />}

      {editId !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-team-title">
          <form onSubmit={submitEdit} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-[#9a7832]">Team settings</p><h2 id="edit-team-title" className="mt-1 text-xl font-semibold text-[#20382a]">Update ward team</h2></div>
              <button type="button" aria-label="Close edit team" onClick={() => setEditId(null)} className="rounded-lg p-2 hover:bg-[#f7f6ef]"><X className="h-5 w-5" aria-hidden="true" /></button>
            </div>
            <label className="block text-sm font-medium text-[#34483a]">Ward
              <select required value={editForm.wardId} onChange={(event) => setEditForm((current) => ({ ...current, wardId: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ded5] px-3">
                {wards.map((ward) => <option key={ward.id} value={ward.id}>{ward.code} · {ward.name}{ward.active ? '' : ' (Inactive)'}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-[#34483a]">Team name<input required maxLength={100} value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ded5] px-3" /></label>
            <label className="block text-sm font-medium text-[#34483a]">Department
              <select value={editForm.department} onChange={(event) => setEditForm((current) => ({ ...current, department: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-[#d9ded5] px-3">
                {DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}
              </select>
            </label>
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
