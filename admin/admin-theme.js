/* Shared Admin-only theme; no network requests or business data. */
(function(){
  "use strict";
  const key="kk_admin_theme",root=document.documentElement;
  const media=window.matchMedia("(prefers-color-scheme: dark)");
  const valid=value=>["light","dark","system"].includes(value);
  let preference="system";
  try{const stored=localStorage.getItem(key);if(valid(stored)) preference=stored;}catch(_){}
  function apply(){
    const effective=preference==="system"?(media.matches?"dark":"light"):preference;
    root.dataset.adminTheme=effective;
    root.style.colorScheme=effective;
    const control=document.getElementById("adminThemePreference");
    if(control) control.value=preference;
  }
  apply();
  function bind(){
    const control=document.getElementById("adminThemePreference");
    if(!control)return;
    apply();
    control.addEventListener("change",()=>{
      if(!valid(control.value))return;
      preference=control.value;
      try{localStorage.setItem(key,preference);}catch(_){}
      apply();
    });
  }
  if(media.addEventListener) media.addEventListener("change",apply);
  else if(media.addListener) media.addListener(apply);
  window.addEventListener("storage",event=>{
    if(event.key!==key && event.key!==null)return;
    preference=valid(event.newValue)?event.newValue:"system";
    apply();
  });
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});
  else bind();
})();
