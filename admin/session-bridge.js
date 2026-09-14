// KK Phone Rental — Admin signed-session bridge
(function(){
  'use strict';

  const SENTINEL='__SESSION__';
  const AUTH_URL='/api/kk-admin-auth';
  const nativeFetch=window.fetch.bind(window);

  // Never keep the real Admin PIN in browser storage. The legacy Admin UI only
  // needs a non-empty marker so it can run its existing post-load initialization.
  try{ sessionStorage.setItem('kk_admin_pin',SENTINEL); }catch(_){ }

  function clearBrowserMarker(){
    try{ sessionStorage.removeItem('kk_admin_pin'); }catch(_){ }
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
    location.replace('/admin');
  }

  // Handle the existing legacy logout button before admin.js receives the click.
  document.addEventListener('click',function(ev){
    const target=ev.target && ev.target.closest ? ev.target.closest('#logoutBtn') : null;
    if(!target) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    logout();
  },true);

  // If the signed cookie expires while the Admin page is open, fail closed back
  // to the minimal gate instead of revealing the legacy inline login workspace.
  window.fetch=async function(input,init){
    const response=await nativeFetch(input,init);
    try{
      const raw=typeof input==='string' ? input : (input && input.url)||'';
      const url=new URL(raw,location.origin);
      const protectedApi=url.origin===location.origin &&
        (url.pathname==='/api/kk-admin' || url.pathname==='/api/kk-rental-dashboard');
      if(protectedApi && (response.status===401 || response.status===403)){
        clearBrowserMarker();
        location.replace('/admin');
      }
    }catch(_){ }
    return response;
  };
})();
