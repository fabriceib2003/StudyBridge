import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { ThemeMode, useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  theme?: ThemeMode;
  setTheme?: (theme: ThemeMode) => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme: propTheme, setTheme: propSetTheme }) => {
  const ctx = useTheme();
  const activeTheme = propTheme ?? ctx.theme;
  const handleSetTheme = propSetTheme ?? ctx.setTheme;

  return (
    <div
      className="flex items-center gap-1 p-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-colors"
      role="group"
      aria-label="Theme mode"
    >
      <button
        type="button"
        onClick={() => handleSetTheme('light')}
        className={`p-1.5 rounded-lg text-xs transition-all flex items-center justify-center cursor-pointer ${
          activeTheme === 'light'
            ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow-sm font-semibold'
            : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)]'
        }`}
        title="Light mode (bright)"
        aria-label="Light mode"
        aria-pressed={activeTheme === 'light'}
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => handleSetTheme('dark')}
        className={`p-1.5 rounded-lg text-xs transition-all flex items-center justify-center cursor-pointer ${
          activeTheme === 'dark'
            ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow-sm font-semibold'
            : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)]'
        }`}
        title="Dark mode"
        aria-label="Dark mode"
        aria-pressed={activeTheme === 'dark'}
      >
        <Moon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => handleSetTheme('system')}
        className={`p-1.5 rounded-lg text-xs transition-all flex items-center justify-center cursor-pointer ${
          activeTheme === 'system'
            ? 'bg-[var(--primary)] text-[var(--primary-text)] shadow-sm font-semibold'
            : 'text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hover)]'
        }`}
        title="System preference"
        aria-label="System preference"
        aria-pressed={activeTheme === 'system'}
      >
        <Monitor className="w-4 h-4" />
      </button>
    </div>
  );
};
