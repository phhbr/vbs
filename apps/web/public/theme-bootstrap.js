// Applies the stored theme/locale before first paint, so a returning
// visitor never sees a flash of the wrong one. Reads the exact two storage
// keys React itself writes later (useTheme's "vbs-theme",
// i18next-browser-languagedetector's "i18nextLng") — one storage contract,
// not two. With nothing stored, this does nothing and tokens.css's
// prefers-color-scheme fallback applies instead, which is equally
// flash-free.
//
// Lives as a separate same-origin file rather than inline in index.html so
// it satisfies `script-src 'self'` without an 'unsafe-inline' exception —
// it's loaded as a plain, synchronous, non-module <script> (not deferred
// like the type="module" entry point), so it still runs and blocks
// rendering before first paint exactly as an inline script would.
(function () {
  try {
    var theme = localStorage.getItem("vbs-theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    }
    var locale = localStorage.getItem("i18nextLng");
    if (locale) {
      document.documentElement.lang = locale.slice(0, 2) === "en" ? "en" : "de";
    }
  } catch (e) {
    // Storage unavailable (e.g. private mode) — theme/locale still apply
    // once React mounts, just not before first paint.
  }
})();
