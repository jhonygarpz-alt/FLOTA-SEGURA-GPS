import { useEffect, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0B1215' : '#0B4F59');
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => {
    try {
      return (localStorage.getItem('fs-theme') as ThemePref) || 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    apply(pref);
    try {
      if (pref === 'system') localStorage.removeItem('fs-theme');
      else localStorage.setItem('fs-theme', pref);
    } catch {
      /* almacenamiento no disponible */
    }
  }, [pref]);
  return [pref, setPref] as const;
}

export function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
