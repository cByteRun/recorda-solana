import { useEffect, useState } from 'react';

// Keep the authenticated provider and loaded portfolio when changing product tabs.
export function useAppLocation() {
  const [url,setUrl]=useState(()=>location.pathname+location.search);
  useEffect(()=>{
    const changed=()=>setUrl(location.pathname+location.search);
    const navigate=(event:MouseEvent)=>{
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const link=(event.target as Element).closest?.('a');
      if(!link||link.target||link.hasAttribute('download'))return;
      const target=new URL(link.href,location.href);
      if(target.origin!==location.origin||target.hash||['/','/workspaces','/reference'].includes(target.pathname))return;
      event.preventDefault();
      history.pushState(null,'',target.pathname+target.search);
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.scrollTo(0,0);
    };
    document.addEventListener('click',navigate);window.addEventListener('popstate',changed);
    return()=>{document.removeEventListener('click',navigate);window.removeEventListener('popstate',changed);};
  },[]);
  return url;
}
