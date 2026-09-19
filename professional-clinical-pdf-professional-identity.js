// NUBEMO — Cartella PDF professionista: identità professionale completa on demand.
// Completa il contesto minimo della Dashboard prima che il bridge PDF pathway-aware generi la cartella.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  if(!client)return;

  const replay=new WeakSet();
  let loading=null;

  function hasFullIdentity(ctx){
    return !!ctx?.profile?.id && !!ctx?.professional?.id
      && Object.prototype.hasOwnProperty.call(ctx.profile,'first_name')
      && Object.prototype.hasOwnProperty.call(ctx.profile,'last_name')
      && Object.prototype.hasOwnProperty.call(ctx.profile,'email')
      && Object.prototype.hasOwnProperty.call(ctx.professional,'qualification')
      && Object.prototype.hasOwnProperty.call(ctx.professional,'display_name')
      && Object.prototype.hasOwnProperty.call(ctx.professional,'tax_code')
      && Object.prototype.hasOwnProperty.call(ctx.professional,'vat_number')
      && Object.prototype.hasOwnProperty.call(ctx.professional,'phone')
      && Object.prototype.hasOwnProperty.call(ctx.professional,'address')
      && Object.prototype.hasOwnProperty.call(ctx.professional,'zip')
      && Object.prototype.hasOwnProperty.call(ctx.professional,'city')
      && Object.prototype.hasOwnProperty.call(ctx.professional,'province');
  }

  async function ensureProfessionalIdentity(){
    const current=window.nubemoProfessionalContext||{};
    if(hasFullIdentity(current))return current;
    if(loading)return loading;

    const profileId=current.profile?.id;
    const professionalId=current.professional?.id;
    if(!profileId||!professionalId)throw new Error('Contesto professionista incompleto.');

    loading=(async()=>{
      const [profileResult,professionalResult]=await Promise.all([
        client.from('profiles')
          .select('id,auth_user_id,role,status,first_name,last_name,email')
          .eq('id',profileId)
          .single(),
        client.from('professionals')
          .select('id,profile_id,status,qualification,display_name,tax_code,vat_number,phone,address,zip,city,province,logo_storage_path')
          .eq('id',professionalId)
          .single()
      ]);
      if(profileResult.error)throw profileResult.error;
      if(professionalResult.error)throw professionalResult.error;

      const latest=window.nubemoProfessionalContext||current;
      window.nubemoProfessionalContext={
        ...latest,
        profile:{...(latest.profile||{}),...profileResult.data},
        professional:{...(latest.professional||{}),...professionalResult.data}
      };
      return window.nubemoProfessionalContext;
    })().finally(()=>{loading=null;});

    return loading;
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#desktopClinicalPdf,[data-drawer-clinical]');
    if(!button)return;
    if(replay.has(button)){replay.delete(button);return;}

    const ctx=window.nubemoProfessionalContext||{};
    if(hasFullIdentity(ctx))return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const oldDisabled=button.disabled;
    const oldText=button.textContent;
    button.disabled=true;
    button.textContent='Preparazione…';

    void ensureProfessionalIdentity().then(()=>{
      button.disabled=oldDisabled;
      button.textContent=oldText;
      replay.add(button);
      button.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
    }).catch(error=>{
      button.disabled=oldDisabled;
      button.textContent=oldText;
      console.error('NUBEMO Cartella PDF identità professionista:',error);
      alert('Non riesco a caricare i dati del professionista per la Cartella PDF. Riprova.');
    });
  },true);
})();
