// NUBEMO — configurazione ambiente frontend.
// Contiene solo dati pubblici necessari al client. Non inserire mai service_role o segreti server-side.
(() => {
  'use strict';

  window.NUBEMO_CONFIG = Object.freeze({
    environment: 'DEV',
    supabaseUrl: 'https://bggvwwjwzfskabgkynwp.supabase.co',
    supabasePublishableKey: 'sb_publishable_7FTdy-tahqbSSHv0Xoa6EQ_bb-GAKoK'
  });
})();
