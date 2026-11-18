import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../../api/errors.js';
import { useAuth } from '../../context/AuthContext.jsx';

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(date);
}

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
  }, [user?.name, user?.email]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSaved(false);
    setIsSaving(true);
    try {
      await updateProfile({ name: name.trim(), email: email.trim() });
      setIsSaved(true);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, 'Your profile could not be updated. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">Your account</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#20382a]">My profile</h1>
        <p className="mt-2 text-sm leading-6 text-[#68736a]">Manage the name and email address associated with your citizen account.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm sm:p-8">
        <div>
          <label htmlFor="profile-name" className="mb-2 block text-sm font-semibold text-[#34483a]">Full name</label>
          <input id="profile-name" name="name" autoComplete="name" required minLength={1} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="min-h-12 w-full rounded-xl border border-[#d9ded5] px-4 py-3 text-sm text-[#24362a] outline-none focus:border-[#477454] focus:ring-4 focus:ring-[#477454]/10" />
        </div>
        <div>
          <label htmlFor="profile-email" className="mb-2 block text-sm font-semibold text-[#34483a]">Email address</label>
          <input id="profile-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-12 w-full rounded-xl border border-[#d9ded5] px-4 py-3 text-sm text-[#24362a] outline-none focus:border-[#477454] focus:ring-4 focus:ring-[#477454]/10" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#34483a]">Account created</p>
          <p className="mt-1 text-sm text-[#68736a]">{formatDate(user?.createdAt)}</p>
        </div>
        {error && <p role="alert" className="rounded-xl border border-[#e9c9c2] bg-[#fff5f2] px-4 py-3 text-sm text-[#8b3c2d]">{error}</p>}
        {isSaved && <p role="status" className="rounded-xl border border-[#d4e2d3] bg-[#f2f8f1] px-4 py-3 text-sm text-[#385743]">Your profile has been updated.</p>}
        <button type="submit" disabled={isSaving} className="min-h-11 rounded-xl bg-[#1d4933] px-5 text-sm font-semibold text-white transition hover:bg-[#163b29] focus:outline-none focus:ring-4 focus:ring-[#477454]/25 disabled:cursor-wait disabled:opacity-60">{isSaving ? 'Saving changes...' : 'Save changes'}</button>
      </form>
    </div>
  );
}
