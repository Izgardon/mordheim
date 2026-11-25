// Runs in <head> before the page paints, so a light-mode device never flashes dark. It reads
// the choice src/lib/theme.ts stores (same key, same default, same bar colours: keep them in
// step). A file rather than an inline script, because the content security policy allows scripts
// from 'self' only.
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
  var bar = document.querySelector('meta[name="theme-color"]');
  if (bar) {
    bar.setAttribute("content", theme === "light" ? "#e8dfd0" : "#0f0c09");
  }
  // An iPhone home-screen app: dark draws the page under the status bar with light text; light keeps the
  // bar's own light shade with dark text. Read at launch, so a change shows next time the app opens.
  var iosBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (iosBar) {
    iosBar.setAttribute("content", theme === "light" ? "default" : "black-translucent");
  }
})();
