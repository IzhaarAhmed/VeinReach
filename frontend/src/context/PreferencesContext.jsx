import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const PreferencesContext = createContext(null);
const STORAGE_KEY = 'vr_high_contrast';

/**
 * User accessibility preferences. Currently a high-contrast toggle (spec:
 * High Contrast Mode). Persists to localStorage and, on first visit, honours
 * the OS `prefers-contrast: more` setting. Applies a `.high-contrast` class to
 * <html> so plain CSS can raise contrast app-wide.
 */
export function PreferencesProvider({ children }) {
  const [highContrast, setHighContrast] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored != null) return stored === '1';
    } catch {
      /* localStorage unavailable — fall through to media query */
    }
    return window.matchMedia?.('(prefers-contrast: more)').matches || false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
    try {
      localStorage.setItem(STORAGE_KEY, highContrast ? '1' : '0');
    } catch {
      /* ignore persistence failures */
    }
  }, [highContrast]);

  const toggleHighContrast = useCallback(() => setHighContrast((v) => !v), []);

  return (
    <PreferencesContext.Provider value={{ highContrast, toggleHighContrast }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
};
