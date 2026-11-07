(() => {
  'use strict';
  const storageKey = 'ulus-atlas-theme';
  const root = document.documentElement;

  function applyTheme(value, remember = false) {
    const theme = value === 'light' ? 'light' : 'dark';
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#1b201c' : '#f7f5ef';
    const button = document.getElementById('themeToggle');
    if (button) {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.title = theme === 'dark' ? 'Aydınlık moda geç' : 'Karanlık moda geç';
    }
    if (remember) {
      try { localStorage.setItem(storageKey, theme); } catch { /* The switch still works when storage is blocked. */ }
    }
  }

  // Run before styles and body content so a saved light theme never flashes dark.
  let saved;
  try { saved = localStorage.getItem(storageKey); } catch { /* First visit or unavailable browser storage uses dark. */ }
  applyTheme(saved);

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(root.dataset.theme);
    document.getElementById('themeToggle').addEventListener('click', () => {
      applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
    });
  }, { once: true });

  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) applyTheme(event.key === null ? null : event.newValue);
  });
})();
