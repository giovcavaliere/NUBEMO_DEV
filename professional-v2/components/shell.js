const navItems=[
  ['dashboard','Dashboard'],
  ['patients','Pazienti'],
  ['agenda','Agenda'],
  ['analytics','Analisi'],
  ['support','Assistenza'],
  ['profile','Profilo']
];

function navMarkup(route, mobile=false){
  return navItems.map(([key,label])=>`<button type="button" data-route="${key}" class="${route===key?'active':''}">${label}</button>`).join('');
}

export function renderShell(root,state,content){
  root.innerHTML=`
    <div class="pro2-layout">
      <aside class="pro2-sidebar">
        <div class="pro2-brand">
          <img src="assets/nubemo-n-icon-192.png" alt="NUBEMO">
          <div><strong>NUBEMO</strong><span>Professional 2.0</span></div>
        </div>
        <nav class="pro2-nav">${navMarkup(state.route)}</nav>
        <div class="pro2-profile">
          <div class="pro2-avatar">${(state.professional.name||'P').slice(0,1).toUpperCase()}</div>
          <div><strong>${state.professional.name}</strong><small>${state.professional.role}</small></div>
        </div>
      </aside>
      <main class="pro2-main">
        <div class="pro2-content">${content}</div>
      </main>
    </div>
    <nav class="pro2-mobile-nav">${navMarkup(state.route,true)}</nav>
  `;
}