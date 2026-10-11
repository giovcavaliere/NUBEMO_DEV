(() => {
  'use strict';
  const valid=['dashboard','professionisti','privacy','impostazioni'];
  function route(name){
    const selected=valid.includes(name)?name:'dashboard';
    document.querySelectorAll('[data-admin-view]').forEach(el=>{el.hidden=el.dataset.adminView!==selected;});
    document.querySelectorAll('[data-admin-route]').forEach(link=>{
      const active=link.dataset.adminRoute===selected;
      link.classList.toggle('active',active);
      if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    });
  }
  document.addEventListener('click',event=>{
    const go=event.target.closest('[data-admin-goto]');
    if(go){location.hash=go.dataset.adminGoto;route(go.dataset.adminGoto);}
  });
  window.addEventListener('hashchange',()=>route(location.hash.slice(1)));
  route(location.hash.slice(1));
})();