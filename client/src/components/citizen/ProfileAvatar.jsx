import { useCallback, useEffect, useRef, useState } from 'react';
import { getProfileImageUrl } from '../../api/auth.js';

export function getCitizenInitials(name) {
  const words = typeof name === 'string' ? name.trim().split(/\s+/).filter(Boolean) : [];
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  return words[0]?.slice(0, 2).toUpperCase() || 'C';
}

export default function ProfileAvatar({ user, className = '', imageUrl = null, alt = 'Profile photo' }) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const mountedRef = useRef(false);
  const hasPhoto = Boolean(user?.profileImage?.available || imageUrl);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setSignedUrl(imageUrl);
    if (hasPhoto && !imageUrl) {
      getProfileImageUrl()
        .then((url) => { if (active) setSignedUrl(url); })
        .catch(() => { if (active) setFailed(true); });
    }
    return () => { active = false; };
  }, [hasPhoto, imageUrl, user?.id]);

  const refreshUrl = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const url = await getProfileImageUrl();
      if (mountedRef.current) {
        setSignedUrl(url);
        setFailed(false);
      }
    } catch {
      if (mountedRef.current) setFailed(true);
    }
  }, []);

  const canShowImage = hasPhoto && Boolean(signedUrl) && !failed;
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${className}`}>
      {canShowImage ? <img src={signedUrl} alt={alt} className="h-full w-full object-cover" onError={refreshUrl} /> : (
        <span aria-hidden="true" className="font-semibold tracking-wide">{getCitizenInitials(user?.name)}</span>
      )}
    </span>
  );
}
