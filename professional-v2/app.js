import {createStore,initialState} from './core/state.js';
import {createRouter} from './core/router.js';
import {renderShell} from './components/shell.js';
import {renderDashboard} from './views/dashboard.js';

const root=document.getElementById('nubemoPro2');
const store=createStore(initialState);
const router=createRouter(store);

function placeholder(title){
  return `<header class="pro2-topbar"><div class="pro2-title"><h1>${title}</h1><p>Sezione pronta per la progettazione NUBEMO 2.0.</p></div></header><section class="panel"><div class="empty-state">La costruiamo insieme, passo dopo passo.</div></section>`;
}

function view(state){
  switch(state.route){
    case 'dashboard': return renderDashboard(state);
    case 'patients': return placeholder('Pazienti');
    case 'agenda': return placeholder('Agenda');
    case 'analytics': return placeholder('Analisi');
    case 'support': return placeholder('Assistenza');
    case 'profile': return placeholder('Profilo');
    default: return renderDashboard(state);
  }
}

function render(){
  const state=store.getState();
  renderShell(root,state,view(state));
  root.querySelectorAll('[data-route]').forEach(btn=>btn.addEventListener('click',()=>router.go(btn.dataset.route)));
}

store.subscribe(render);
render();

// Dati temporanei solo per rendere visibile lo scheletro durante la fase di design.
// Verranno sostituiti dai servizi Supabase dedicati della Pro 2.0.
store.setState({
  professional:{name:'Dott.ssa Rossi',role:'Nutrizionista'},
  dashboard:{
    kpis:{activePatients:18,newPatientsMonth:4,firstVisitsToday:2,controlsToday:6},
    agenda:[
      {time:'09:30',title:'Martina Rossi',subtitle:'Controllo',type:'Controllo'},
      {time:'10:15',title:'Impegno personale',subtitle:'Fuori studio',type:'Personale',personal:true},
      {time:'11:00',title:'Luca Bianchi',subtitle:'Prima visita',type:'Prima visita'}
    ],
    priorities:{unreadLabs:3,noDiary7Days:5,pendingInvites:2,drafts:1}
  }
});