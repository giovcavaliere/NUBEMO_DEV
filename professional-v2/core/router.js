const VALID_ROUTES=new Set(['dashboard','patients','agenda','analytics','support','profile']);

export function createRouter(store){
  function routeFromHash(){
    const value=(location.hash||'#dashboard').slice(1);
    return VALID_ROUTES.has(value)?value:'dashboard';
  }
  function sync(){store.setState({route:routeFromHash()});}
  window.addEventListener('hashchange',sync);
  sync();
  return {
    go(route){location.hash=VALID_ROUTES.has(route)?route:'dashboard';},
    destroy(){window.removeEventListener('hashchange',sync);}
  };
}