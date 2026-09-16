// KK Phone Rental — Admin signed-session bridge
(function(){
  'use strict';

  const SENTINEL='__SESSION__';
  const AUTH_URL='/api/kk-admin-auth';
  const nativeFetch=window.fetch.bind(window);
  let sessionCheck=null;
  let redirecting=false;

  // Never keep the real Admin PIN in browser storage. The legacy Admin UI only
  // needs a non-empty marker so it can run its existing post-load initialization.
  try{ sessionStorage.setItem('kk_admin_pin',SENTINEL); }catch(_){ }

  function clearBrowserMarker(){
    try{ sessionStorage.removeItem('kk_admin_pin'); }catch(_){ }
  }

  function redirectToGate(){
    if(redirecting) return;
    redirecting=true;
    clearBrowserMarker();
    location.replace('/admin');
  }

  function protectedApiUrl(input){
    try{
      const raw=typeof input==='string' ? input : (input && input.url)||'';
      const url=new URL(raw,location.origin);
      if(url.origin!==location.origin) return null;
      if(url.pathname==='/api/kk-admin' || url.pathname==='/api/kk-rental-dashboard') return url;
    }catch(_){ }
    return null;
  }

  async function sessionStillValid(){
    if(sessionCheck) return sessionCheck;
    sessionCheck=(async()=>{
      try{
        const res=await nativeFetch(AUTH_URL,{
          method:'GET',
          credentials:'same-origin',
          cache:'no-store'
        });
        const data=await res.json().catch(()=>({}));
        return !!(res.ok && data.authenticated===true);
      }catch(_){
        // Authentication state is uncertain. Fail closed rather than leaving a
        // potentially expired Admin workspace active.
        return false;
      }finally{
        sessionCheck=null;
      }
    })();
    return sessionCheck;
  }

  async function logout(){
    clearBrowserMarker();
    try{
      await nativeFetch(AUTH_URL,{
        method:'POST',
        credentials:'same-origin',
        cache:'no-store',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'logout'})
      });
    }catch(_){ }
    redirectToGate();
  }

  // Handle the existing legacy logout button before admin.js receives the click.
  document.addEventListener('click',function(ev){
    const target=ev.target && ev.target.closest ? ev.target.closest('#logoutBtn') : null;
    if(!target) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    logout();
  },true);

  // Signed-session Admin requests must always carry same-origin credentials.
  // A protected API can legitimately return 401/403 for a downstream reason;
  // only redirect to the PIN gate after the auth endpoint confirms that the
  // signed session itself is no longer valid. This prevents /admin <-> /admin/app
  // refresh loops while preserving fail-closed session expiry behavior.
  window.fetch=async function(input,init){
    const protectedUrl=protectedApiUrl(input);
    const requestInit=protectedUrl
      ? Object.assign({},init||{}, {credentials:'same-origin'})
      : init;
    const response=await nativeFetch(input,requestInit);

    if(protectedUrl && (response.status===401 || response.status===403)){
      const valid=await sessionStillValid();
      if(!valid) redirectToGate();
    }
    return response;
  };
})();