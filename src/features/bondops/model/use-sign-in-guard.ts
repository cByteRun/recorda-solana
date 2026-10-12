import { useEffect } from 'react';
import { useBondOps } from './bondops-context';

// Gate the whole workspace before individual pages mount or read wallet data.
export function useSignInGuard() {
  const ops=useBondOps();
  const path=location.pathname+location.search;
  const requiresSignIn=ops.source==='live'&&!ops.session?.member;
  const blocked=requiresSignIn&&location.pathname!=='/login';
  const loginHref=(destination:string)=>requiresSignIn?`/login?next=${encodeURIComponent(destination)}`:destination;
  useEffect(()=>{
    if(!blocked||!ops.session)return;
    history.replaceState(null,'',`/login?next=${encodeURIComponent(path)}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  },[blocked,ops.session,path]);
  return {blocked,loginHref};
}
