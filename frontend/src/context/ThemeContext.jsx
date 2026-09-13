// Theme state: Light / Dark.
// Persisted in localStorage so the choice survives page changes, reloads
// and browser restarts. Applied via Bootstrap 5.3's built-in color mode
// (`data-bs-theme`), so all Bootstrap components (cards, tables, forms,
// alerts, buttons) adapt with the official dark palette — no color inversion.
// The green navbar/footer identity is preserved in both themes.
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'agriworks_theme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
    document.documentElement.setAttribute('data-bs-theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
