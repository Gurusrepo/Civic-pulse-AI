export function normalizeIndianMobile(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return '';
}

export function isValidIndianMobile(value) {
  return /^\+91[6-9]\d{9}$/.test(normalizeIndianMobile(value));
}
