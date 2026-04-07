export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'

export const THEME_STORAGE_KEY = 'katiba-theme'

export const THEME_INIT_SCRIPT = `
  (function () {
    if (window.__katibaThemeInitialized) return;
    window.__katibaThemeInitialized = true;

    var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';

    function applyTheme(theme) {
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    }

    function readStoredTheme() {
      try {
        var stored = window.localStorage.getItem('${THEME_STORAGE_KEY}');
        return stored === 'light' || stored === 'dark' ? stored : null;
      } catch (error) {
        return null;
      }
    }

    function writeStoredTheme(theme) {
      try {
        window.localStorage.setItem('${THEME_STORAGE_KEY}', theme);
      } catch (error) {}
    }

    try {
      var stored = window.localStorage.getItem('${THEME_STORAGE_KEY}');
      var preference =
        stored === 'light' || stored === 'dark' || stored === 'system'
          ? stored
          : 'system';
      var theme = preference === 'system' ? systemTheme : preference;
      applyTheme(theme);
    } catch (error) {
      applyTheme(systemTheme);
    }

    var media = window.matchMedia('(prefers-color-scheme: dark)');
    var handleSystemChange = function (event) {
      if (readStoredTheme()) return;
      applyTheme(event.matches ? 'dark' : 'light');
    };

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleSystemChange);
    } else if (typeof media.addListener === 'function') {
      media.addListener(handleSystemChange);
    }

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!(target instanceof Element)) return;
      var toggle = target.closest('[data-theme-toggle]');
      if (!toggle) return;

      var currentTheme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
      var nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      writeStoredTheme(nextTheme);
    });
  })();
`
