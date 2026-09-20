/**
 * Runs synchronously in <head> before paint so the installed app never flashes
 * route titles or page URLs in the native window chrome.
 */
export const PWA_STANDALONE_BOOT_SCRIPT = `(function(){try{var standalone=window.navigator.standalone===true||window.matchMedia("(display-mode: standalone)").matches||window.matchMedia("(display-mode: fullscreen)").matches;if(!standalone)return;document.documentElement.classList.add("ironstack-pwa");document.title="IronStack";function lockTitle(){if(document.title!=="IronStack")document.title="IronStack"}lockTitle();var titleEl=document.querySelector("title");if(titleEl){new MutationObserver(lockTitle).observe(titleEl,{childList:true,characterData:true,subtree:true})}function markBody(){if(document.body)document.body.classList.add("ironstack-pwa")}if(document.body)markBody();else document.addEventListener("DOMContentLoaded",markBody,{once:true})}catch(e){}})();`

export const PWA_APP_TITLE = 'IronStack'
