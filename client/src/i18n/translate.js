function resolveMessage(catalog, key) {
  return key.split('.').reduce((value, part) => value?.[part], catalog);
}

function interpolate(message, values) {
  return message.replace(/\{(\w+)\}/g, (match, name) => (
    Object.hasOwn(values, name) ? String(values[name]) : match
  ));
}

export function translateMessage(localeCatalog, englishCatalog, locale, key, values = {}, onMissing = () => {}) {
  const localized = resolveMessage(localeCatalog, key);
  if (typeof localized === 'string') return interpolate(localized, values);

  onMissing(key, locale);
  const english = resolveMessage(englishCatalog, key);
  if (typeof english === 'string') return interpolate(english, values);

  return locale === 'ta' ? 'மொழிபெயர்ப்பு கிடைக்கவில்லை' : 'Translation unavailable';
}
