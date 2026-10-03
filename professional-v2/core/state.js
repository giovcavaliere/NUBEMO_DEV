export function createStore(initialState={}){
  let state={...initialState};
  const listeners=new Set();
  return {
    getState:()=>state,
    setState(patch){
      state={...state,...(typeof patch==='function'?patch(state):patch)};
      listeners.forEach(fn=>fn(state));
    },
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
  };
}

export const initialState={
  route:'dashboard',
  professional:{name:'Professionista',role:'Nutrizionista'},
  dashboard:{
    kpis:{activePatients:0,newPatientsMonth:0,firstVisitsToday:0,controlsToday:0},
    agenda:[],
    priorities:{unreadLabs:0,noDiary7Days:0,pendingInvites:0,drafts:0}
  }
};