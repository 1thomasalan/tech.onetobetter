/* Registers the service worker on tech.onetobetter.com (the Hark preview has none). No push, no alerts. */
(function () {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
  if (window.self !== window.top) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {});
  });
})();
