import { useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '../../api/errors.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ProfileAvatar from '../../components/citizen/ProfileAvatar.jsx';

const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(date);
}

export default function Profile() {
  const { user, updateProfile, uploadProfileImage, removeProfileImage } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [photoMessage, setPhotoMessage] = useState('');
  const [photoProgress, setPhotoProgress] = useState(0);
  const [isPhotoSaving, setIsPhotoSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

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

  function handlePhotoSelection(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPhotoError('');
    setPhotoMessage('');
    if (!ACCEPTED_PROFILE_IMAGE_TYPES.has(file.type)) {
      setPhotoError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      setPhotoError('Choose an image that is 5 MB or smaller.');
      return;
    }
    setSelectedPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function cancelPhotoSelection() {
    setSelectedPhoto(null);
    setPreviewUrl(null);
    setPhotoError('');
    setPhotoProgress(0);
  }

  async function handlePhotoUpload() {
    if (!selectedPhoto || isPhotoSaving) return;
    setIsPhotoSaving(true);
    setPhotoError('');
    setPhotoMessage('');
    try {
      const signedUrl = await uploadProfileImage(selectedPhoto, (event) => {
        if (event.total) setPhotoProgress(Math.round((event.loaded / event.total) * 100));
      });
      setCurrentPhotoUrl(signedUrl);
      setSelectedPhoto(null);
      setPreviewUrl(null);
      setPhotoProgress(100);
      setPhotoMessage('Your profile photo has been updated.');
    } catch (requestError) {
      setPhotoError(getApiErrorMessage(requestError, 'Your profile photo could not be uploaded. Please try again.'));
    } finally {
      setIsPhotoSaving(false);
    }
  }

  async function handlePhotoRemoval() {
    if (isPhotoSaving) return;
    setIsPhotoSaving(true);
    setPhotoError('');
    setPhotoMessage('');
    try {
      await removeProfileImage();
      setCurrentPhotoUrl(null);
      setSelectedPhoto(null);
      setPreviewUrl(null);
      setPhotoProgress(0);
      setPhotoMessage('Your profile photo has been removed.');
    } catch (requestError) {
      setPhotoError(getApiErrorMessage(requestError, 'Your profile photo could not be removed. Please try again.'));
    } finally {
      setIsPhotoSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">Your account</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#20382a]">My profile</h1>
        <p className="mt-2 text-sm leading-6 text-[#68736a]">Manage the name and email address associated with your citizen account.</p>
      </div>

      <section aria-labelledby="profile-photo-heading" className="flex flex-col gap-5 rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-7">
        <ProfileAvatar user={user} imageUrl={previewUrl || currentPhotoUrl} alt={`${user?.name || 'Your'} profile photo`} className="h-24 w-24 border-2 border-[#e2c77f] bg-[#edf2eb] text-2xl text-[#1d4933]" />
        <div className="min-w-0 flex-1">
          <h2 id="profile-photo-heading" className="text-lg font-semibold text-[#20382a]">Profile photo</h2>
          <p className="mt-1 text-sm text-[#68736a]">Use a JPEG, PNG, or WebP image up to 5 MB.</p>
          <input ref={fileInputRef} id="profile-photo-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoSelection} className="sr-only" aria-label="Choose a profile photo" />
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isPhotoSaving} className="min-h-11 rounded-xl bg-[#1d4933] px-4 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2c77f] disabled:opacity-60">{selectedPhoto || user?.profileImage?.available ? 'Change photo' : 'Upload photo'}</button>
            {user?.profileImage?.available && !selectedPhoto && <button type="button" onClick={handlePhotoRemoval} disabled={isPhotoSaving} className="min-h-11 rounded-xl border border-[#d9ded5] px-4 text-sm font-semibold text-[#8b3c2d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2c77f] disabled:opacity-60">{isPhotoSaving ? 'Removing…' : 'Remove photo'}</button>}
            {selectedPhoto && <>
              <button type="button" onClick={handlePhotoUpload} disabled={isPhotoSaving} className="min-h-11 rounded-xl border border-[#d9ded5] px-4 text-sm font-semibold text-[#1d4933] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2c77f] disabled:opacity-60">{isPhotoSaving ? `Uploading ${photoProgress}%…` : 'Save photo'}</button>
              <button type="button" onClick={cancelPhotoSelection} disabled={isPhotoSaving} className="min-h-11 rounded-xl border border-[#d9ded5] px-4 text-sm font-semibold text-[#526258] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2c77f] disabled:opacity-60">Cancel</button>
            </>}
          </div>
          {isPhotoSaving && selectedPhoto && <div className="mt-3" role="status" aria-live="polite"><progress className="h-2 w-full accent-[#1d4933]" max="100" value={photoProgress} /><span className="sr-only">Uploading profile photo: {photoProgress}%</span></div>}
          {photoError && <p role="alert" className="mt-3 text-sm text-[#8b3c2d]">{photoError}</p>}
          {photoMessage && <p role="status" className="mt-3 text-sm text-[#385743]">{photoMessage}</p>}
        </div>
      </section>

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
