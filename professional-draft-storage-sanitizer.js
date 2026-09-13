// NUBEMO compatibility shim.
// Draft appointments are now handled natively by professional-legacy-supabase-adapter.js.
(() => {
  'use strict';
  window.nubemoDraftStorageSanitizer = Object.freeze({ ready: Promise.resolve() });
})();
