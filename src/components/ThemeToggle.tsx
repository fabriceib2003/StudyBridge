import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

interface ThemeToggleProps {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, setTheme }) => {
  return (
    <div
      className="flex items-center gap-1 p-1 rounded-xl border transition-colors"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      role="group"
      aria-label="Theme mode"
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`p-1.5 rounded-lg text-xs transition-all flex items-center justify-center ${
          theme === 'light'
            ? 'bg-blue-600 text-white shadow-sm font-semibold'
            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        title="Light mode (bright)"
        aria-label="Light mode"
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`p-1.5 rounded-lg text-xs transition-all flex items-center justify-center ${
          theme === 'dark'
            ? 'bg-blue-600 text-white shadow-sm font-semibold'
            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        title="Dark mode"
        aria-label="Dark mode"
      >
        <Moon className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => setTheme('system')}
        className={`p-1.5 rounded-lg text-xs transition-all flex items-center justify-center ${
          theme === 'system'
            ? 'bg-blue-600 text-white shadow-sm font-semibold'
            : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        title="System preference"
        aria-label="System preference"
      >
        <Monitor className="w-4 h-4" />
      </button>
    </div>
  );
};
