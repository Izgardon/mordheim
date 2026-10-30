// Runs in <head> before the page paints, so a light-mode device never flashes dark. It reads
// the choice src/lib/theme.ts stores (same key, same default: keep them in step). A file rather
// than an inline script, because the content security policy allows scripts from 'self' only.
(function () {
  var theme = "dark";
  try {
    if (window.localStorage.getItem("mordheim_theme") === "light") {
      theme = "light";
    }
  } catch (error) {
    // Storage blocked (private mode): stay dark.
  }
  document.documentElement.setAttribute("data-theme", theme);
})();
