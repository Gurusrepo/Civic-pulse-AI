export function applyGlobalPreferences(preferences) {
  if (typeof document === 'undefined' || !preferences?.accessibilityPreferences) return;
  const root = document.documentElement;
  root.dataset.fontSize = preferences.accessibilityPreferences.fontSize;
  root.dataset.reducedMotion = String(Boolean(preferences.accessibilityPreferences.reducedMotion));
}
