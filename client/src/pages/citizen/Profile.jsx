import { useEffect, useRef, useState } from 'react';
import {  useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import ProfileAvatar from '../../components/citizen/ProfileAvatar.jsx';
import { useTranslation } from '../../i18n/LocaleProvider.jsx';
import { getPreferences, updatePreferences } from '../../api/auth.js';
import { applyGlobalPreferences } from '../../utils/applyPreferences.js';
import { getApiErrorMessage } from '../../api/errors.js';


const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function formatDate(value, locale) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(locale === 'ta' ? 'ta-IN' : 'en-IN', { dateStyle: 'long' }).format(date);
}

export default function Profile() {
  const [appearance, setAppearance] = useState('light');
  const { user, updateProfile, uploadProfileImage, removeProfileImage, logout, deactivateAccount } = useAuth();
  const { t, locale, setLocale } = useTranslation();
  const navigate = useNavigate();
  const translationRef = useRef(t);
  translationRef.current = t;
  const [preferences, setPreferences] = useState({ language: locale, appearance: 'system', notificationPreferences: { inApp: true, email: true, sms: true }, accessibilityPreferences: { fontSize: 'medium', highContrast: false, reducedMotion: false } });
  const preferencesRef = useRef(preferences);
  const lastSavedPreferencesRef = useRef(null);
  const preferenceQueueRef = useRef(Promise.resolve());
  const preferenceRevisionRef = useRef(0);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  const [preferenceLoadAttempt, setPreferenceLoadAttempt] = useState(0);
  const [preferenceSaveState, setPreferenceSaveState] = useState('idle');
  const [preferenceError, setPreferenceError] = useState('');
  const [name, setName] = useState(user?.name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [isEditing, setIsEditing] = useState(false);
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
  const [accountDialog, setAccountDialog] = useState(null);
  const [accountActionBusy, setAccountActionBusy] = useState(false);
  const [accountActionError, setAccountActionError] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const fileInputRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      preferenceRevisionRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    setName(user?.name ?? '');
    setPhoneNumber(user?.phoneNumber ?? '');
    setDateOfBirth(user?.dateOfBirth ?? '');
    setAddress(user?.address ?? '');
  }, [user?.name, user?.phoneNumber, user?.dateOfBirth, user?.address]);

  useEffect(() => {
    let active = true;
    setIsLoadingPreferences(true);
    setPreferencesLoaded(false);
    setPreferenceError('');
    getPreferences().then((saved) => {
      if (!active) return;
      preferencesRef.current = saved;
      lastSavedPreferencesRef.current = saved;
      setPreferences(saved);
      applyGlobalPreferences(saved);
      setLocale(saved.language);
      setPreferencesLoaded(true);
    }).catch(() => {
      if (active) setPreferenceError(translationRef.current('profile.preferencesLoadError'));
    }).finally(() => { if (active) setIsLoadingPreferences(false); });
    return () => { active = false; };
  }, [user?.id, preferenceLoadAttempt, setLocale]);

  async function savePreferences(next) {
    if (!preferencesLoaded) return;
    const revision = ++preferenceRevisionRef.current;
    preferencesRef.current = next;
    setPreferences(next);
    setPreferenceError('');
    setPreferenceSaveState('saving');
    setLocale(next.language);
    const request = preferenceQueueRef.current.then(() => updatePreferences(next));
    preferenceQueueRef.current = request.then(() => undefined, () => undefined);
    try {
      const saved = await request;
      lastSavedPreferencesRef.current = saved;
      if (mountedRef.current && revision === preferenceRevisionRef.current) {
        preferencesRef.current = saved;
        setPreferences(saved);
        applyGlobalPreferences(saved);
        setLocale(saved.language);
        setPreferenceSaveState('saved');
      }
    } catch {
      if (!mountedRef.current || revision !== preferenceRevisionRef.current) return;
      let restored = lastSavedPreferencesRef.current;
      try { restored = await getPreferences(); } catch { /* Restore the last server-confirmed value held in memory. */ }
      if (!mountedRef.current || revision !== preferenceRevisionRef.current) return;
      if (restored) {
        lastSavedPreferencesRef.current = restored;
        preferencesRef.current = restored;
        setPreferences(restored);
        applyGlobalPreferences(restored);
        setLocale(restored.language);
      }
      if (restored && JSON.stringify(restored) === JSON.stringify(next)) {
        setPreferenceSaveState('saved');
        setPreferenceError('');
        return;
      }
      setPreferenceSaveState('error');
      setPreferenceError(translationRef.current('profile.preferencesSaveError'));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSaved(false);
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError(t('profile.nameRequired'));
      return;
    }
    if (normalizedName.length > 100) {
      setError(t('profile.nameTooLong'));
      return;
    }
    const phone = phoneNumber.trim().replace(/[ ()-]/g, '');
    if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) {
      setError(t('profile.phoneInvalid'));
      return;
    }
    if (address.trim().length > 400) { setError(t('profile.addressTooLong')); return; }
    if (dateOfBirth && (Number.isNaN(Date.parse(`${dateOfBirth}T00:00:00Z`)) || new Date(`${dateOfBirth}T00:00:00Z`) >= new Date())) { setError(t('profile.dateOfBirthInvalid')); return; }
    setIsSaving(true);
    try {
      await updateProfile({ name: normalizedName, phoneNumber: phone, dateOfBirth: dateOfBirth || null, address: address.trim() });
      setIsSaved(true);
      setIsEditing(false);
    } catch {
      setError(t('profile.profileSaveError'));
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
      setPhotoError(t('profile.photoTypeError'));
      return;
    }
    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      setPhotoError(t('profile.photoSizeError'));
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
        if (mountedRef.current && event.total) setPhotoProgress(Math.round((event.loaded / event.total) * 100));
      });
      if (!mountedRef.current) return;
      setCurrentPhotoUrl(signedUrl);
      setSelectedPhoto(null);
      setPreviewUrl(null);
      setPhotoProgress(100);
      setPhotoMessage(t('profile.photoUpdated'));
    } catch {
      if (mountedRef.current) setPhotoError(t('profile.photoUploadError'));
    } finally {
      if (mountedRef.current) setIsPhotoSaving(false);
    }
  }

  async function handlePhotoRemoval() {
    if (isPhotoSaving) return;
    setIsPhotoSaving(true);
    setPhotoError('');
    setPhotoMessage('');
    try {
      await removeProfileImage();
      if (!mountedRef.current) return;
      setCurrentPhotoUrl(null);
      setSelectedPhoto(null);
      setPreviewUrl(null);
      setPhotoProgress(0);
      setPhotoMessage(t('profile.photoRemoved'));
    } catch {
      if (mountedRef.current) setPhotoError(t('profile.photoRemoveError'));
    } finally {
      if (mountedRef.current) setIsPhotoSaving(false);
    }
  }

  function openAccountDialog(action) {
    setAccountActionError('');
    setDeletePassword('');
    setDeleteConfirmation('');
    setAccountDialog(action);
  }

  function closeAccountDialog() {
    if (accountActionBusy) return;
    setAccountDialog(null);
    setAccountActionError('');
    setDeletePassword('');
    setDeleteConfirmation('');
  }

  async function handleConfirmSignOut() {
    setAccountActionBusy(true);
    try {
      await logout();
    } catch {
      // Local authentication state is cleared even when the logout request fails.
    } finally {
      setAccountDialog(null);
      setAccountActionBusy(false);
      navigate('/login', { replace: true });
    }
  }

  async function handleConfirmDeactivation(event) {
    event.preventDefault();
    if (deleteConfirmation !== 'DELETE') return;
    setAccountActionError('');
    setAccountActionBusy(true);
    try {
      await deactivateAccount({ password: deletePassword, confirmation: 'DELETE' });
      setAccountDialog(null);
      navigate('/login', { replace: true });
    } catch (requestError) {
      setAccountActionError(getApiErrorMessage(requestError, t('profile.deactivationError')));
    } finally {
      setAccountActionBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-2xl font-semibold uppercase tracking-[0.16em] text-[#9a7832]">{t('profile.eyebrow')}</p>
        <p className="mt-2 text-sm leading-6 text-[#68736a]">{t('profile.intro')}</p>
      </header>
      <section aria-label={t('profile.summaryLabel')} className="overflow-hidden rounded-2xl border border-[#e5e2d5] bg-white shadow-sm">
        <div className="flex flex-col items-center border-b border-[#edf0e9] bg-[#fafbf8] px-5 py-8 text-center">
          <div className="relative h-24 w-24">
            <ProfileAvatar user={user} imageUrl={previewUrl || currentPhotoUrl} alt="" className="h-24 w-24 border-2 border-[#e2c77f] bg-[#edf2eb] text-2xl text-[#1d4933]" />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isPhotoSaving} aria-label={t('profile.changePhoto')} title={t('profile.changePhoto')} className="absolute -bottom-1 -right-1 grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-[#1d4933] text-white shadow-md transition hover:bg-[#163b29] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e2c77f] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
              <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h-4L8 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2-3Z"/><circle cx="12" cy="13" r="3"/></svg>
            </button>
          </div>
          <input ref={fileInputRef} id="profile-photo-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoSelection} className="sr-only" aria-label={t('profile.changePhoto')} />
          <h2 className="mt-4 text-xl font-semibold text-[#20382a]">{user?.name || t('profile.nameUnavailable')}</h2>
          <p className="mt-1 text-sm text-[#68736a]">{t(`profile.citizenTypes.${['MINOR', 'CITIZEN', 'SENIOR_CITIZEN'].includes(user?.ageBasedCitizenCategory) ? user.ageBasedCitizenCategory : 'NOT_SET'}`)}</p>
          {Number.isInteger(user?.age)}

          <p className="mt-1 text-xs text-[#68736a]">{t('profile.memberSince')}: {user?.createdAt ? new Intl.DateTimeFormat(locale === 'ta' ? 'ta-IN' : 'en-IN', { year: 'numeric' }).format(new Date(user.createdAt)) : t('profile.notProvided')}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {user?.profileImage?.available && !selectedPhoto && <button type="button" onClick={handlePhotoRemoval} disabled={isPhotoSaving} className="min-h-11 rounded-xl border border-[#d9ded5] px-4 text-sm font-semibold text-[#8b3c2d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e2c77f] disabled:opacity-60">{isPhotoSaving ? t('profile.removingPhoto') : t('profile.remove')}</button>}
            {selectedPhoto && <><button type="button" onClick={handlePhotoUpload} disabled={isPhotoSaving} className="min-h-11 rounded-xl bg-[#1d4933] px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e2c77f] disabled:opacity-60">{isPhotoSaving ? t('profile.uploadingPhoto', { progress: photoProgress }) : t('profile.savePhoto')}</button><button type="button" onClick={cancelPhotoSelection} disabled={isPhotoSaving} className="min-h-11 rounded-xl border border-[#d9ded5] px-4 text-sm font-semibold text-[#526258] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e2c77f]">{t('profile.cancel')}</button></>}
          </div>
          {isPhotoSaving && selectedPhoto && <progress aria-label={t('profile.uploadingPhoto', { progress: photoProgress })} className="mt-3 h-2 w-full max-w-xs accent-[#1d4933]" max="100" value={photoProgress} />}
          {photoError && <p role="alert" className="mt-2 text-sm text-[#8b3c2d]">{photoError}</p>}{photoMessage && <p role="status" className="mt-2 text-sm text-[#385743]">{photoMessage}</p>}
        </div>
        <dl className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2 sm:p-7">
          <SummaryItem label={t('profile.fullName')} value={user?.name || t('profile.nameUnavailable')} />
          <SummaryItem label={t('profile.email')} value={user?.email || t('profile.emailUnavailable')} />
          <SummaryItem label={t('profile.phone')} value={user?.phoneNumber || t('profile.notProvided')} />
          <SummaryItem label={t('profile.address')} value={user?.address || t('profile.notProvided')} />
        </dl>
      </section>
      {isSaved && <p role="status" className="rounded-xl border border-[#d4e2d3] bg-[#f2f8f1] px-4 py-3 text-sm text-[#385743]">{t('profile.profileSaved')}</p>}
      {!isEditing ? <button type="button" onClick={() => { setError(''); setIsSaved(false); setIsEditing(true); }} className="min-h-11 rounded-xl bg-[#1d4933] px-5 text-sm font-semibold text-white hover:bg-[#163b29] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e2c77f]">{t('profile.editProfile')}</button> : <form noValidate onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm sm:p-8">
        <div><h2 className="text-xl font-semibold text-[#20382a]">{t('profile.editProfile')}</h2><p className="mt-1 text-sm text-[#68736a]">{t('profile.editProfileIntro')}</p></div>
        <Field id="profile-name" label={t('profile.fullName')}><input id="profile-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required className={inputClass} /></Field>
        <Field id="profile-email" label={t('profile.email')}><input id="profile-email" value={user?.email || ''} readOnly aria-describedby="profile-email-note" className={`${inputClass} bg-[#f4f5f1]`} /><span id="profile-email-note" className="mt-1 block text-xs text-[#68736a]">{t('profile.emailReadOnly')}</span></Field>
        <Field id="profile-phone" label={t('profile.phone')}><input id="profile-phone" type="tel" autoComplete="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} maxLength={30} className={inputClass} /><span className="mt-1 block text-xs text-[#68736a]">{t('profile.mobileFormat')}</span></Field>
        <Field id="profile-dob" label={t('profile.dateOfBirth')}><input id="profile-dob" type="date" autoComplete="bday" value={dateOfBirth || ''} onChange={(event) => setDateOfBirth(event.target.value)} max={new Date().toISOString().slice(0, 10)} className={inputClass} /><span className="mt-1 block text-xs text-[#68736a]">{t('profile.dobNotVerified')}</span></Field>
        <Field id="profile-address" label={t('profile.address')}><textarea id="profile-address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={400} rows={3} className={inputClass} /></Field>
        {error && <p role="alert" className="rounded-xl border border-[#e9c9c2] bg-[#fff5f2] px-4 py-3 text-sm text-[#8b3c2d]">{error}</p>}
        <div className="flex flex-wrap gap-3"><button type="submit" disabled={isSaving} className="min-h-11 rounded-xl bg-[#1d4933] px-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e2c77f] disabled:opacity-60">{isSaving ? t('profile.saving') : t('profile.save')}</button><button type="button" disabled={isSaving} onClick={() => { setName(user?.name ?? ''); setPhoneNumber(user?.phoneNumber ?? ''); setDateOfBirth(user?.dateOfBirth ?? ''); setAddress(user?.address ?? ''); setError(''); setIsEditing(false); }} className="min-h-11 rounded-xl border border-[#d9ded5] px-5 text-sm font-semibold text-[#34483a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e2c77f]">{t('profile.cancel')}</button></div>
      </form>}


        <section className="space-y-5 rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm sm:p-7">
          <div>
            <h2 className="text-xl font-semibold text-[#20382a]">
              {t('profile.preferences')}
            </h2>

          </div>

          {isLoadingPreferences && (
            <p role="status" className="text-sm text-[#68736a]">
              {t('profile.preferencesLoading')}
            </p>
          )}

          {!isLoadingPreferences && !preferencesLoaded && (
            <div className="flex flex-wrap items-center gap-3">
              <p role="alert" className="text-sm text-[#8b3c2d]">
                {preferenceError}
              </p>
              <button
                type="button"
                onClick={() => setPreferenceLoadAttempt((attempt) => attempt + 1)}
                className="min-h-10 rounded-lg border border-[#cfd8ce] px-3 text-sm font-semibold text-[#1d4933]"
              >
                {t('profile.preferencesRetry')}
              </button>
            </div>
          )}

          {preferencesLoaded && (
            <div className="flex flex-col gap-5">

              {/* Language */}
              <div>
                <label className="text-sm font-semibold text-[#34483a]">
                  {t('profile.language')}
                </label>
                <select
                  disabled={preferenceSaveState === 'saving'}
                  value={preferences.language}
                  onChange={(event) =>
                    savePreferences({
                      ...preferencesRef.current,
                      language: event.target.value
                    })
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#d9ded5] bg-white px-3"
                >
                  <option value="en">English</option>
                  <option value="ta">தமிழ் (Tamil)</option>
                </select>
              </div>

              {/* Font Size */}
              <div>
                <label className="text-sm font-semibold text-[#34483a]">
                  {t('profile.fontSize')}
                </label>
                <select
                  disabled={preferenceSaveState === 'saving'}
                  value={preferences.accessibilityPreferences.fontSize}
                  onChange={(event) =>
                    savePreferences({
                      ...preferencesRef.current,
                      accessibilityPreferences: {
                        ...preferencesRef.current.accessibilityPreferences,
                        fontSize: event.target.value
                      }
                    })
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#d9ded5] bg-white px-3"
                >
                  <option value="small">{t('profile.small')}</option>
                  <option value="medium">{t('profile.medium')}</option>
                  <option value="large">{t('profile.large')}</option>
                </select>
              </div>

              {/* Appearance */}
              <div>
                <label className="text-sm font-semibold text-[#34483a]">
                  {t('profile.appearance')}
                </label>
                <select
                  value={appearance}
                  onChange={(event) => {
                    const theme = event.target.value;
                    setAppearance(theme);
                    document.documentElement.classList.toggle(
                      'dark',
                      theme === 'dark'
                    );
                  }}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#d9ded5] bg-white px-3"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

            </div>
          )}

          {preferenceSaveState === 'saving' && (
            <p role="status" className="text-sm text-[#68736a]">
              {t('profile.preferencesSaving')}
            </p>
          )}

          {preferenceSaveState === 'saved' && (
            <p role="status" className="text-sm text-[#385743]">
              {t('profile.preferencesSaved')}
            </p>
          )}

          {preferenceSaveState === 'error' && (
            <p role="alert" className="text-sm text-[#8b3c2d]">
              {preferenceError || t('profile.preferencesSaveError')}
            </p>
          )}
        </section>


      <section aria-labelledby="profile-sign-out-title" className="space-y-3 rounded-2xl border border-[#d9ded5] bg-white p-5 shadow-sm sm:p-7">
        <div><h2 id="profile-sign-out-title" className="text-lg font-semibold text-[#20382a]">{t('profile.signOutTitle')}</h2><p className="mt-1 text-sm leading-6 text-[#68736a]">{t('profile.signOutDescription')}</p></div>
        <button type="button" onClick={() => openAccountDialog('signout')} className="min-h-11 rounded-xl border border-[#cfd8ce] px-5 text-sm font-semibold text-[#1d4933] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#477454]">{t('profile.signOut')}</button>
      </section>
      <section aria-labelledby="profile-delete-account-title" className="space-y-3 rounded-2xl border border-[#e9c9c2] bg-white p-5 shadow-sm sm:p-7">
        <div><h2 id="profile-delete-account-title" className="text-lg font-semibold text-[#8b3c2d]">{t('profile.deleteAccount')}</h2><p className="mt-1 text-sm leading-6 text-[#68736a]">{t('profile.deactivationNotice')}</p></div>
        <button type="button" onClick={() => openAccountDialog('deactivate')} className="min-h-11 rounded-xl border border-[#b95342] bg-[#fff5f2] px-5 text-sm font-semibold text-[#8b3c2d] hover:bg-[#fce9e5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b95342]">{t('profile.deleteAccount')}</button>
      </section>
      {accountDialog === 'signout' && <ConfirmationDialog title={t('profile.signOutConfirmTitle')} onCancel={closeAccountDialog}>
        <p className="text-sm leading-6 text-[#68736a]">{t('profile.signOutConfirmDetails')}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={closeAccountDialog} disabled={accountActionBusy} className="min-h-11 rounded-xl border border-[#d9ded5] px-4 text-sm font-semibold text-[#34483a] disabled:opacity-60">{t('profile.cancel')}</button>
          <button type="button" onClick={handleConfirmSignOut} disabled={accountActionBusy} className="min-h-11 rounded-xl bg-[#1d4933] px-4 text-sm font-semibold text-white disabled:opacity-60">{accountActionBusy ? t('profile.signingOut') : t('profile.confirmSignOut')}</button>
        </div>
      </ConfirmationDialog>}
      {accountDialog === 'deactivate' && <ConfirmationDialog title={t('profile.deleteConfirmTitle')} onCancel={closeAccountDialog}>
        <p className="text-sm leading-6 text-[#68736a]">{t('profile.deleteConfirmDetails')}</p>
        <form onSubmit={handleConfirmDeactivation} className="mt-4 space-y-4">
          <Field id="delete-account-password" label={t('profile.currentPassword')}><input id="delete-account-password" type="password" autoComplete="current-password" required value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} className={inputClass} /></Field>
          <Field id="delete-account-confirmation" label={t('profile.confirmationPhraseLabel')}><input id="delete-account-confirmation" required value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoCapitalize="characters" className={inputClass} /><span className="mt-1 block text-xs text-[#68736a]">{t('profile.confirmationPhrase')}</span></Field>
          {accountActionError && <p role="alert" className="rounded-xl border border-[#e9c9c2] bg-[#fff5f2] px-4 py-3 text-sm text-[#8b3c2d]">{accountActionError}</p>}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={closeAccountDialog} disabled={accountActionBusy} className="min-h-11 rounded-xl border border-[#d9ded5] px-4 text-sm font-semibold text-[#34483a] disabled:opacity-60">{t('profile.cancel')}</button>
            <button type="submit" disabled={accountActionBusy || !deletePassword || deleteConfirmation !== 'DELETE'} className="min-h-11 rounded-xl bg-[#8b3c2d] px-4 text-sm font-semibold text-white disabled:opacity-60">{accountActionBusy ? t('profile.deactivating') : t('profile.confirmDeactivation')}</button>
          </div>
        </form>
      </ConfirmationDialog>}
    </div>
  );
}

const inputClass = 'min-h-12 w-full rounded-xl border border-[#d9ded5] px-4 py-3 text-sm text-[#24362a] outline-none focus:border-[#477454] focus:ring-4 focus:ring-[#477454]/10';
function Field({ id, label, children }) { return <div><label htmlFor={id} className="mb-2 block text-sm font-semibold text-[#34483a]">{label}</label>{children}</div>; }
function SettingNotice({ title, text }) { return <article className="rounded-xl border border-[#edf0e9] bg-[#fafbf8] p-4"><h3 className="text-sm font-semibold text-[#34483a]">{title}</h3><p className="mt-2 text-sm leading-5 text-[#68736a]">{text}</p></article>; }
function ConfirmationDialog({ title, onCancel, children }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.querySelector('input, button')?.focus();
    return undefined;
  }, []);

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#13251b]/60 p-4" onMouseDown={(event) => event.stopPropagation()}>
    <section ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="profile-action-dialog-title" tabIndex="-1" onKeyDown={handleKeyDown} className="w-full max-w-lg rounded-2xl border border-[#e5e2d5] bg-white p-6 shadow-2xl focus:outline-none">
      <h2 id="profile-action-dialog-title" className="text-xl font-semibold text-[#20382a]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  </div>;
}
function PreferenceNote({ title, text }) { return <div className="mt-2 rounded-lg bg-[#f6f7f4] p-3"><p className="text-sm font-medium text-[#34483a]">{title}</p><p className="mt-1 text-xs leading-5 text-[#68736a]">{text}</p></div>; }
function ToggleSetting({ label, checked, onChange }) { return <label className="flex min-h-10 items-center gap-3 text-sm text-[#526258]"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>; }
function SummaryItem({ label, value }) { return <div className="min-w-0"><dt className="text-xs font-medium text-[#68736a]">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-[#20382a]">{value}</dd></div>; }
