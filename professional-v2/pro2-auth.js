// NUBEMO Professional 2.0 — session/role/privacy guard + logout.
(() => {
  'use strict';

  const client=window.nubemoSupabase;
  const redirect=url=>{
    window.location.replace(url);
    return new Promise(()=>{});
  };

  async function loadOwnProfile(userId){
    const {data,error}=await client
      .from('profiles')
      .select('id,auth_user_id,first_name,last_name,email,role,status')
      .eq('auth_user_id',userId)
      .single();
    if(error||!data) throw new Error('Profilo NUBEMO non disponibile.');
    return data;
  }

  async function requiresPrivacyGate(profileId){
    const {data:documentRow,error:documentError}=await client
      .from('privacy_documents')
      .select('id')
      .eq('document_type','nubemo')
      .eq('active',true)
      .order('published_at',{ascending:false,nullsFirst:false})
      .order('created_at',{ascending:false})
      .limit(1)
      .maybeSingle();
    if(documentError) throw documentError;
    if(!documentRow?.id) return false;

    const {data:acceptance,error:acceptanceError}=await client
      .from('privacy_acceptances')
      .select('status')
      .eq('profile_id',profileId)
      .eq('privacy_document_id',documentRow.id)
      .maybeSingle();
    if(acceptanceError) throw acceptanceError;
    return acceptance?.status!=='accepted';
  }

  async function verifyProfessionalAccess(){
    if(!client) return redirect('index.html');

    const {data:{user},error:userError}=await client.auth.getUser();
    if(userError||!user) return redirect('index.html');

    const profile=await loadOwnProfile(user.id);
    if(profile.status!=='active'){
      await client.auth.signOut().catch(()=>{});
      return redirect('index.html');
    }

    if(profile.role==='admin') return redirect('admin.html');
    if(profile.role==='patient') return redirect('patient.html');
    if(profile.role!=='professional'){
      await client.auth.signOut().catch(()=>{});
      return redirect('index.html');
    }

    if(await requiresPrivacyGate(profile.id)) return redirect('privacy.html');

    window.NUBEMO_PRO2_PROFILE=profile;
    document.body.classList.remove('pro2-auth-pending');
    return profile;
  }

  async function logout(button){
    if(button) button.disabled=true;
    try{
      await client?.auth?.signOut?.();
    }finally{
      window.location.replace('index.html');
    }
  }

  document.querySelectorAll('.exit,.compact-exit').forEach(button=>{
    button.addEventListener('click',()=>void logout(button));
  });

  window.NUBEMO_PRO2_AUTH_READY=verifyProfessionalAccess().catch(async error=>{
    console.error('NUBEMO Professional 2.0 auth guard:',error);
    await client?.auth?.signOut?.().catch(()=>{});
    return redirect('index.html');
  });
})();