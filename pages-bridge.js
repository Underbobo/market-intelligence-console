/* GitHub Pages UI -> authenticated collector API. No credentials in URLs. */
(()=>{
  'use strict';
  const nativeFetch=window.fetch.bind(window),base=new URL('./',document.currentScript.src);
  const loginPage=location.pathname===base.pathname+'login.html';
  const key='market-session:'+base.pathname;
  let apiOrigin;
  function saved(){try{return JSON.parse(sessionStorage.getItem(key)||localStorage.getItem(key)||'null');}catch{return null;}}
  function clear(){sessionStorage.removeItem(key);localStorage.removeItem(key);}
  function loginURL(){return new URL('login.html?next='+encodeURIComponent(location.pathname+location.search+location.hash),base).href;}
  function notice(message){let node=document.querySelector('#pagesConnectionNotice');if(!node){node=document.createElement('div');node.id='pagesConnectionNotice';node.style.cssText='padding:24px;margin:24px auto;max-width:600px;border:1px solid #e6def7;border-radius:12px;font:14px/1.8 system-ui;color:#605373;background:white';document.body.prepend(node);}node.textContent=message;}
  const endpoint=(async()=>{
    let meta=document.querySelector('meta[name="market-api"]');
    if(!meta){const response=await nativeFetch(new URL('?config='+Date.now(),base),{cache:'no-store'});if(!response.ok)throw Error('入口配置暂不可用，请刷新重试');const doc=new DOMParser().parseFromString(await response.text(),'text/html');meta=doc.querySelector('meta[name="market-api"]');}
    const value=meta?.content||'';
    if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(value))throw Error('后台连接配置无效，请联系管理员');
    apiOrigin=value;return value;
  })();
  function authHeaders(){const headers=new Headers({'X-Market-Client':'pages'}),s=saved();if(s?.token)headers.set('Authorization','Bearer '+s.token);return headers;}
  const sessionReady=loginPage?Promise.resolve():endpoint.then(async origin=>{
    const s=saved();if(!s?.token||s.expires_at*1000<=Date.now()){clear();location.replace(loginURL());throw Error('请先登录');}
    const response=await nativeFetch(origin+'/auth/session',{headers:authHeaders(),credentials:'omit',cache:'no-store'});
    if(!response.ok)throw Error('后台暂时无法连接，请稍后刷新');
    if(!(await response.json()).authenticated){clear();location.replace(loginURL());throw Error('登录已过期');}
    document.documentElement.classList.remove('pages-loading');
  });
  sessionReady.catch(error=>{if(saved())notice(error.message);});
  endpoint.catch(error=>{if(loginPage){const errorNode=document.querySelector('#error');if(errorNode)errorNode.textContent=error.message;}else notice(error.message);});
  function routed(url){return url.origin===location.origin&&(/^\/(api|auth)\//.test(url.pathname)||url.pathname.startsWith(base.pathname+'api/')||url.pathname.startsWith(base.pathname+'auth/'));}
  function routePath(url){return url.pathname.startsWith(base.pathname)?'/'+url.pathname.slice(base.pathname.length):url.pathname;}
  async function apiFetch(input,options={}){
    const url=new URL(typeof input==='string'||input instanceof URL?input:input.url,location.href);
    if(!routed(url)&&(!apiOrigin||url.origin!==apiOrigin))return nativeFetch(input,options);
    const origin=await endpoint,path=routed(url)?routePath(url):url.pathname;
    if(path.startsWith('/api/'))await sessionReady;
    const headers=new Headers(input instanceof Request?input.headers:undefined);
    new Headers(options.headers).forEach((value,name)=>headers.set(name,value));
    authHeaders().forEach((value,name)=>headers.set(name,value));
    const response=await nativeFetch(origin+path+url.search,{...options,headers,credentials:'omit'});
    if(path==='/auth/login'&&response.ok){const data=await response.clone().json();if(!data.token)throw Error('登录响应无效，请稍后重试');const remember=new URLSearchParams(options.body).get('remember')==='1';clear();(remember?localStorage:sessionStorage).setItem(key,JSON.stringify({token:data.token,expires_at:data.expires_at}));}
    if(path==='/auth/logout'&&response.ok)clear();
    if(response.status===401&&path!=='/auth/login'){clear();location.replace(loginURL());throw Error('登录已过期，请重新登录');}
    return response;
  }
  window.fetch=apiFetch;
  window.MarketPages={
    destination(){const raw=new URLSearchParams(location.search).get('next');try{const url=new URL(raw||base.href,location.origin);if(url.origin===base.origin&&url.pathname.startsWith(base.pathname)&&!url.pathname.endsWith('/login.html'))return url.href;}catch{}return base.href;}
  };
  document.addEventListener('DOMContentLoaded',async()=>{
    if(loginPage)return;
    try{await sessionReady;}catch{return;}
    const actions=document.querySelector('.topbar-actions');
    if(actions){const button=document.createElement('button');button.type='button';button.className='button secondary';button.textContent='退出登录';button.style.cssText='font-size:12px;padding:6px 10px;min-height:30px';button.onclick=async()=>{button.disabled=true;try{const r=await apiFetch('/auth/logout',{method:'POST'});if(!r.ok)throw Error();location.replace(new URL('login.html',base));}catch{button.disabled=false;button.textContent='退出失败，重试';}};actions.append(button);}
  });
  document.addEventListener('click',async event=>{
    const link=event.target.closest?.('a[href]');if(!link)return;
    const url=new URL(link.href);if(!routed(url)||!routePath(url).startsWith('/api/'))return;
    event.preventDefault();event.stopImmediatePropagation();if(link.dataset.pagesBusy)return;
    link.dataset.pagesBusy='1';const original=link.textContent;link.textContent='正在准备文件…';
    const popup=link.target==='_blank'?window.open('about:blank','_blank'):null;
    try{
      const response=await apiFetch(link.href);if(!response.ok){let data={};try{data=await response.json();}catch{}throw Error(data.error||'文件暂不可用，请稍后重试');}
      const blob=await response.blob(),objectURL=URL.createObjectURL(blob),disposition=response.headers.get('Content-Disposition')||'';
      if(popup&&!link.hasAttribute('download')&&!/attachment/i.test(disposition)){popup.location.replace(objectURL);}else{
        popup?.close();let filename=link.download||'市场情报数据';const encoded=disposition.match(/filename\*=UTF-8''([^;]+)/i),plain=disposition.match(/filename="([^"]+)"/i);if(encoded){try{filename=decodeURIComponent(encoded[1]);}catch{}}else if(plain)filename=plain[1];
        const download=document.createElement('a');download.href=objectURL;download.download=filename;document.body.append(download);download.click();download.remove();
      }
      setTimeout(()=>URL.revokeObjectURL(objectURL),120000);
    }catch(error){popup?.close();if(typeof window.showToast==='function')window.showToast(error.message);else notice(error.message);}finally{delete link.dataset.pagesBusy;link.textContent=original;}
  },true);
})();
