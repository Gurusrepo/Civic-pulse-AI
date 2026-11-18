import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createComplaint } from '../../api/complaints.js';
import { getApiErrorMessage } from '../../api/errors.js';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function validatePhoto(file) {
  if (!file) return 'Choose a photo of the issue.';
  if (!allowedTypes.has(file.type)) return 'Photo must be a JPEG, PNG, or WebP image.';
  if (file.size > MAX_PHOTO_BYTES) return 'The photo must be 5 MB or smaller.';
  return '';
}

export default function ReportComplaint() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [accuracy, setAccuracy] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [locationMessage, setLocationMessage] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!photo) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function handlePhotoChange(event) {
    const selected = event.target.files?.[0] ?? null;
    const validationError = selected ? validatePhoto(selected) : '';
    setPhotoError(validationError);
    setPhoto(validationError ? null : selected);
  }

  function useCurrentLocation() {
    setLocationMessage('');
    if (!navigator.geolocation) {
      setLocationMessage('This browser does not provide location services. Enter the coordinates manually.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLatitude(String(coords.latitude));
        setLongitude(String(coords.longitude));
        setAccuracy(Number.isFinite(coords.accuracy) && coords.accuracy > 0 && coords.accuracy <= 100000 ? String(coords.accuracy) : '');
        setLocationMessage('Current location added. Check the coordinates before submitting.');
        setIsLocating(false);
      },
      (error) => {
        const messages = {
          1: 'Location permission was denied. Enter the coordinates manually.',
          2: 'Your location could not be determined. Enter the coordinates manually.',
          3: 'Location request timed out. Try again or enter coordinates manually.'
        };
        setLocationMessage(messages[error.code] ?? 'Location could not be determined. Enter the coordinates manually.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    const numericLatitude = Number(latitude);
    const numericLongitude = Number(longitude);
    if (title.trim().length < 3 || title.trim().length > 160) {
      setErrorMessage('Enter a title between 3 and 160 characters.');
      return;
    }
    if (description.trim().length < 10 || description.trim().length > 5000) {
      setErrorMessage('Enter a description between 10 and 5000 characters.');
      return;
    }
    if (!Number.isFinite(numericLatitude) || numericLatitude < -90 || numericLatitude > 90) {
      setErrorMessage('Enter a valid latitude between -90 and 90.');
      return;
    }
    if (!Number.isFinite(numericLongitude) || numericLongitude < -180 || numericLongitude > 180) {
      setErrorMessage('Enter a valid longitude between -180 and 180.');
      return;
    }
    const validationError = validatePhoto(photo);
    if (validationError) {
      setPhotoError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createComplaint({
        title: title.trim(),
        description: description.trim(),
        latitude: numericLatitude,
        longitude: numericLongitude,
        location_accuracy_meters: accuracy || undefined,
        photo
      });
      navigate(`/citizen/complaints/${result.complaint.id}`, { replace: true });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'We could not submit your complaint. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7832]">Make your neighbourhood better</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#20382a]">Report a complaint</h1>
        <p className="mt-2 text-sm leading-6 text-[#68736a]">Add clear details, where the issue is, and a photo. Your report will be linked to your account.</p>
      </div>

      {errorMessage && <p role="alert" className="rounded-xl border border-[#e9c9c2] bg-[#fff5f2] px-4 py-3 text-sm text-[#8b3c2d]">{errorMessage}</p>}
      <form onSubmit={handleSubmit} aria-busy={isSubmitting} className="space-y-6 rounded-2xl border border-[#e5e2d5] bg-white p-5 shadow-sm sm:p-8">
        <div>
          <label htmlFor="complaint-title" className="mb-2 block text-sm font-semibold text-[#34483a]">Complaint title</label>
          <input id="complaint-title" name="title" required minLength={3} maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="For example, damaged road near the bus stop" className="min-h-12 w-full rounded-xl border border-[#d9ded5] bg-white px-4 py-3 text-sm text-[#24362a] outline-none placeholder:text-[#9aa39b] focus:border-[#477454] focus:ring-4 focus:ring-[#477454]/10" />
          <p className="mt-1 text-right text-xs text-[#758077]">{title.length}/160</p>
        </div>
        <div>
          <label htmlFor="complaint-description" className="mb-2 block text-sm font-semibold text-[#34483a]">Detailed description</label>
          <textarea id="complaint-description" name="description" required minLength={10} maxLength={5000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what happened, how long it has been present, and who may be affected." className="w-full resize-y rounded-xl border border-[#d9ded5] bg-white px-4 py-3 text-sm leading-6 text-[#24362a] outline-none placeholder:text-[#9aa39b] focus:border-[#477454] focus:ring-4 focus:ring-[#477454]/10" />
          <p className="mt-1 text-right text-xs text-[#758077]">{description.length}/5000</p>
        </div>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-[#34483a]">Issue location</legend>
          <button type="button" onClick={useCurrentLocation} disabled={isLocating} className="min-h-11 rounded-xl border border-[#cfd8ce] bg-[#f7faf5] px-4 text-sm font-semibold text-[#1d4933] transition hover:bg-[#edf2eb] focus:outline-none focus:ring-4 focus:ring-[#477454]/20 disabled:cursor-wait disabled:opacity-60">{isLocating ? 'Finding your location...' : 'Use my current location'}</button>
          {locationMessage && <p role="status" className="text-sm text-[#526a58]">{locationMessage}</p>}
          <p className="text-xs leading-5 text-[#758077]">You can also enter coordinates manually. Coordinates are used to locate the report on the civic map.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="complaint-latitude" className="mb-2 block text-sm font-medium text-[#34483a]">Latitude</label>
              <input id="complaint-latitude" name="latitude" type="number" inputMode="decimal" step="any" min="-90" max="90" required value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="e.g. 11.2189" className="min-h-12 w-full rounded-xl border border-[#d9ded5] px-4 py-3 text-sm outline-none focus:border-[#477454] focus:ring-4 focus:ring-[#477454]/10" />
            </div>
            <div>
              <label htmlFor="complaint-longitude" className="mb-2 block text-sm font-medium text-[#34483a]">Longitude</label>
              <input id="complaint-longitude" name="longitude" type="number" inputMode="decimal" step="any" min="-180" max="180" required value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="e.g. 78.1650" className="min-h-12 w-full rounded-xl border border-[#d9ded5] px-4 py-3 text-sm outline-none focus:border-[#477454] focus:ring-4 focus:ring-[#477454]/10" />
            </div>
          </div>
          {accuracy && <p className="text-xs text-[#68736a]">Location accuracy: approximately {Math.round(Number(accuracy))} metres.</p>}
        </fieldset>

        <div>
          <label htmlFor="complaint-photo" className="mb-2 block text-sm font-semibold text-[#34483a]">Photo of the issue</label>
          <input id="complaint-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required onChange={handlePhotoChange} aria-describedby="photo-hint photo-error" className="block min-h-12 w-full rounded-xl border border-[#d9ded5] bg-white text-sm text-[#34483a] file:mr-4 file:min-h-12 file:border-0 file:bg-[#edf2eb] file:px-4 file:font-semibold file:text-[#1d4933] focus:outline-none focus:ring-4 focus:ring-[#477454]/10" />
          <p id="photo-hint" className="mt-2 text-xs text-[#758077]">JPEG, PNG, or WebP. Maximum file size 5 MB.</p>
          {photoError && <p id="photo-error" role="alert" className="mt-2 text-sm text-[#8b3c2d]">{photoError}</p>}
          {previewUrl && <figure className="mt-4 overflow-hidden rounded-xl border border-[#e5e2d5] bg-[#f7f6ef] p-2"><img src={previewUrl} alt="Preview of the selected complaint photo" className="max-h-80 w-full rounded-lg object-contain" /><figcaption className="px-2 py-2 text-xs text-[#68736a]">{photo?.name}</figcaption></figure>}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[#edf0e9] pt-5 sm:flex-row sm:justify-end">
          <Link to="/citizen" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#cfd8ce] px-5 text-sm font-semibold text-[#425348] hover:bg-[#f7f8f5] focus:outline-none focus:ring-4 focus:ring-[#477454]/20">Cancel</Link>
          <button type="submit" disabled={isSubmitting || Boolean(photoError)} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#1d4933] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163b29] focus:outline-none focus:ring-4 focus:ring-[#477454]/25 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? 'Submitting complaint...' : 'Submit complaint'}</button>
        </div>
      </form>
    </div>
  );
}
