const state={section:'feigua',tasks:[]};
const sectionMeta={};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path,options={}){const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...options.headers}});const data=await response.json();if(!response.ok)throw Error(data.error||'请求失败');window.dispatchEvent(new CustomEvent("market-api-loaded",{detail:{path,data}}));return data;}
let toastTimer;
function showToast(text){const element=document.querySelector('#toast');element.textContent=text;element.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>element.hidden=true,5000);}
function switchSection(section){state.section=section;document.querySelectorAll('main>.section').forEach(el=>el.classList.toggle('active',el.id===section));document.querySelectorAll('.nav-item[data-section]').forEach(el=>el.classList.toggle('active',el.dataset.section===section));document.querySelector('#pageTitle').textContent=({market:'大盘看板',monitor:'竞对监控看板',research:'分析模板',monthly:'品牌月度复盘',feigua:'飞瓜数据',competitors:'竞品追踪',collect:'常态采集',jobs:'任务记录'})[section];const copy={market:['大盘看板','完整类目市场规模、成交渠道与历史趋势。'],monitor:['竞对监控看板','每日品牌异动、渠道变化与直播事件证据。'],monthly:['品牌月度复盘','市场、品牌、人群与店铺的月报生产流程；先核对配置与来源，再按模块补齐。'],research:['分析模板','输入类目或品牌，生成可复用的研究数据包。'],competitors:['竞品追踪','飞瓜电商品牌研究与数据追踪。'],feigua:['飞瓜数据工作台','从类目趋势到品牌竞争，把市场研究沉淀为可复用的采集任务。'],collect:['常态采集','统一管理小店与品牌数据采集，按需补齐飞书数据。'],jobs:['任务记录','追踪采集进度、运行结果与日志，回顾每一次研究任务。']}[section];document.querySelector('#workspaceTitle').textContent=copy[0];document.querySelector('#workspaceDescription').textContent=copy[1];document.querySelectorAll('.nav-item[data-section]').forEach(el=>el.setAttribute('aria-current',el.dataset.section===section?'page':'false'));document.body.dataset.section=section;window.dispatchEvent(new Event('market-section-changed'));if(section==='jobs')refreshJobs();}
document.querySelectorAll('.nav-item[data-section]').forEach(button=>button.onclick=()=>switchSection(button.dataset.section));
function renderTaskCard(task){return `<article class="task research-row"><div class="task-body"><h3>${escapeHtml(task.title)}</h3><p>${task.id.includes('shop')?'小店数据':'品牌数据'}</p></div><div class="research-period"><strong>近一个月</strong><details><summary>自动运行设置</summary><form class="schedule-form" data-schedule="${escapeHtml(task.id)}"><label><input type="checkbox" name="enabled"> 每日自动运行</label><input type="time" name="at" value="09:30" aria-label="${escapeHtml(task.title)}自动运行时间"><button class="button secondary" type="submit">保存定时</button><small class="schedule-hint">尚未启用</small></form></details></div><div class="research-modules"><span>${task.id.endsWith('_upload')?'已有月报上传':'采集并上传'}</span><small>${escapeHtml(task.description)}</small></div><div class="task-downloads"><span class="muted">原配置飞书</span><small>补缺写入与回读核对</small></div><div class="task-actions"><button class="button" data-run="${escapeHtml(task.id)}">运行</button><button class="button ghost" data-collect-log="${escapeHtml(task.id)}">日志</button></div></article>`;}

function renderTasks(){renderFeiguaTasks();}
let selectedTask;
function openRunModal(task){selectedTask=task;document.querySelector('#runTitle').textContent=task.title;document.querySelector('#runDescription').textContent=task.description;document.querySelector('#runStatus').textContent='确认后加入队列，按顺序执行采集或上传。';document.querySelector('#runDialog').showModal();}
async function submitRun(mode){const buttons=[...document.querySelectorAll('#runDialog button')];buttons.forEach(b=>b.disabled=true);try{const job=await api('/api/jobs',{method:'POST',body:JSON.stringify({task_id:selectedTask.id,mode})});window.dispatchEvent(new CustomEvent('pince-job-started',{detail:job}));document.querySelector('#runDialog').close();showToast('任务已加入队列');await refreshJobs();}catch(error){document.querySelector('#runStatus').textContent=error.message;}finally{buttons.forEach(b=>b.disabled=false);}}
document.querySelector('#normalRun').onclick=()=>submitRun('normal');

document.querySelector('#feiguaTaskGrid').onclick=async event=>{const logButton=event.target.closest('[data-collect-log]');if(logButton){const jobs=await api('/api/jobs');const job=jobs.find(j=>j.task_id===logButton.dataset.collectLog);if(job)await openTaskLog(job.id);else showToast('该任务尚无运行日志');return;}const button=event.target.closest('[data-run]');if(!button)return;const task=state.tasks.find(t=>t.id===button.dataset.run);if(task){openRunModal(task);}};
const labels={queued:'排队中',running:'运行中',cancelling:'取消中',cancelled:'已取消',success:'已完成',succeeded:'已完成',failed:'失败'};
let jobLimit=10;
document.querySelector('#moreJobs').onclick=()=>{jobLimit+=20;refreshJobs();};
async function refreshJobs(){try{const jobs=await api('/api/jobs');document.querySelector('#moreJobs').hidden=jobs.length<=jobLimit;document.querySelector('#jobList').innerHTML=jobs.filter(job=>JSON.stringify([job.title,job.status,labels[job.status],job.started_at]).toLowerCase().includes((document.querySelector('#jobSearch')?.value||'').toLowerCase())).slice(0,jobLimit).map(job=>`<article class="task research-row"><div class="task-body"><h3>${escapeHtml(job.title)}</h3></div><div class="research-period"><small>${escapeHtml((job.started_at||'').replace('T',' ').slice(0,19))}</small></div><div class="research-modules"><span>${job.mode==='preview'?'预览检查':'正式运行'}</span></div><div class="task-downloads">${job.error?`<p title="${escapeHtml(job.error)}">${escapeHtml(job.error)}</p>`:''}<span class="badge" data-status="${escapeHtml(job.status)}">${labels[job.status]||escapeHtml(job.status)}</span></div><div class="task-actions"><button class="button secondary" data-log="${job.id}">日志</button>${['queued','running'].includes(job.status)?`<button class="button ghost" data-cancel="${job.id}">取消任务</button>`:''}</div></article>`).join('')||'<div class="panel">暂无任务记录</div>';}catch(error){showToast(error.message);}}
let currentLog=null;
async function openTaskLog(id){currentLog=id;document.querySelector('#logContent').textContent='正在加载日志…';const dialog=document.querySelector('#logDialog');if(!dialog.open)dialog.showModal();await refreshLog();}
async function refreshLog(){if(!currentLog||!document.querySelector('#logDialog').open)return;try{const result=await api(`/api/jobs/${currentLog}/log`);document.querySelector('#logContent').textContent=result.log+(result.error?'\n'+result.error:'');}catch(error){showToast(error.message);}}
document.querySelector('#jobList').onclick=async event=>{const button=event.target.closest('[data-log],[data-cancel]');if(!button)return;try{if(button.dataset.log){await openTaskLog(button.dataset.log);}else{await api(`/api/jobs/${button.dataset.cancel}/cancel`,{method:'POST',body:'{}'});await refreshJobs();}}catch(error){showToast(error.message);}};
document.querySelector('#refreshJobs').onclick=refreshJobs;
document.documentElement.dataset.theme=localStorage.getItem('market-theme')||'light';
document.querySelector('#themeToggle').onclick=()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;localStorage.setItem('market-theme',theme);};
async function connect(){try{state.tasks=await api('/api/tasks');renderTasks();await loadSchedules();document.querySelector('#connectionStatus').textContent='服务已连接';}catch(error){document.querySelector('#connectionStatus').textContent='连接失败：'+error.message;}}
setInterval(()=>{if(!document.hidden){if(state.section==='jobs')refreshJobs();refreshLog();}},3000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect,{once:true});else connect();

// Read-only workspace counts use responses already fetched by the page.
const overviewSources=new Map();
window.addEventListener('market-api-loaded',({detail:{path,data}})=>{
  const number=(id,value)=>{document.getElementById(id).textContent=Number(value).toLocaleString('zh-CN');};
  if(['/api/feigua/pince','/api/competitors'].includes(path)&&Array.isArray(data.tasks)){
    overviewSources.set(path,data.tasks);const all=[...overviewSources.values()].flat();
    number('statTasks',all.length);
    const runs=new Map();all.forEach(t=>(t.runs||[]).forEach(r=>runs.set(r.id,r.count||0)));
    number('statFiles',[...runs.values()].reduce((sum,n)=>sum+n,0));
  }
  if(path==='/api/feigua/pince/categories')number('statCategories',data.paths.length);
  if(path==='/api/jobs'&&Array.isArray(data)){
    const running=data.filter(j=>['running','cancelling'].includes(j.status)).length;
    const queued=data.filter(j=>j.status==='queued').length;
    number('statRunning',running+queued);
    document.getElementById('statRunningHint').textContent=running+queued?`${running} 个运行中 · ${queued} 个排队中`:'当前无运行或排队任务';
  }
});
document.querySelector('#sidebarToggle').onclick=()=>{
  const collapsed=document.body.classList.toggle('nav-collapsed');
  const button=document.querySelector('#sidebarToggle');
  button.setAttribute('aria-expanded',String(!collapsed));button.setAttribute('aria-label',collapsed?'展开导航':'收起导航');
};
setTimeout(refreshJobs,0);
setInterval(()=>{if(!document.hidden&&state.section!=='jobs')refreshJobs();},15000);

async function loadSchedules(){
 const rows=await api('/api/schedules');
 for(const row of rows){const form=document.querySelector(`[data-schedule="${row.task_id}"]`);if(!form)continue;form.elements.enabled.checked=!!row.enabled;form.elements.at.value=row.at;form.querySelector('.schedule-hint').textContent=row.enabled?`每天 ${row.at}（本机时间）`:'未启用自动运行';}
}
document.querySelector('#feiguaTaskGrid').addEventListener('submit',async event=>{
 const form=event.target.closest('[data-schedule]');if(!form)return;event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
 try{await api('/api/schedules',{method:'POST',body:JSON.stringify({task_id:form.dataset.schedule,enabled:form.elements.enabled.checked,at:form.elements.at.value})});await loadSchedules();showToast('定时设置已保存');}catch(error){showToast(error.message);}finally{button.disabled=false;}
});

if(new URLSearchParams(location.search).get('embed')==='1')document.body.classList.add('embedded-market');

// Every task area uses the same table header and search / refresh toolbar.
document.addEventListener('DOMContentLoaded',()=>{
 for(const [sectionId,listId,searchId,placeholder,refresh] of [
  ['collect','feiguaTaskGrid','collectSearch','搜索任务或采集内容',async()=>{await connect();}],
  ['jobs','jobList','jobSearch','搜索任务、状态或日期',refreshJobs]]){
  const section=document.getElementById(sectionId),list=document.getElementById(listId),head=section.querySelector('.page-header');
  const search=document.createElement('input');search.id=searchId;search.placeholder=placeholder;search.setAttribute('aria-label',placeholder);head.append(search);
  if(sectionId==='collect'){const button=document.createElement('button');button.className='button ghost';button.textContent='刷新任务与结果';button.onclick=refresh;head.append(button);}
  const table=document.createElement('div');table.className='research-table-head';table.setAttribute('aria-hidden','true');table.innerHTML='<span>研究任务 / 类目</span><span>时间范围</span><span>采集内容</span><span>导出结果</span><span>操作</span>';list.before(table);
  search.oninput=()=>{if(sectionId==='jobs')refreshJobs();else list.querySelectorAll('article').forEach(row=>row.hidden=!row.textContent.toLowerCase().includes(search.value.trim().toLowerCase()));};
 }
});

// Compact navigation keeps group labels horizontal and moves children into a flyout.
document.addEventListener('DOMContentLoaded',()=>{
 const sidebar=document.querySelector('#primarySidebar'),original=sidebar.querySelector('.nav');
 const rail=document.createElement('nav');rail.className='compact-nav';rail.setAttribute('aria-label','收起模式导航');sidebar.append(rail);
 const groups=[['监控看板','◉',[['竞对监控看板','[data-section="monitor"]'],['大盘看板','[data-section="market"]']]],['分析模板','▧',[['Skill 分析模板','[data-section="research"]']]],['市场机会','◈',[['基础类目','[data-pince-scope="market"]']]],['市场榜单','▥',[['品牌榜','[data-pince-scope="rank"]'],['卖点榜','[data-pince-scope="sell"]']]],['品类洞察','◕',[['商品分析','[data-pince-scope="goods"]']]],['竞品研究','◎',[['竞品追踪','[data-section="competitors"]']]],['运行管理','▤',[['常态采集','[data-section="collect"]'],['任务记录','[data-section="jobs"]']]]];
 let opened=null,timer;
 const close=()=>{clearTimeout(timer);if(opened){opened.panel.hidden=true;opened.button.setAttribute('aria-expanded','false');opened=null;}};
 const entries=groups.map(([label,icon,children],index)=>{
  const row=document.createElement('div');row.className='compact-nav-group';
  const button=document.createElement('button');button.type='button';button.className='compact-nav-trigger';button.innerHTML=`<span aria-hidden="true">${icon}</span><span>${label}</span>`;button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','compact-menu-'+index);
  const panel=document.createElement('div');panel.className='compact-nav-flyout';panel.id='compact-menu-'+index;panel.hidden=true;panel.setAttribute('aria-label',label+'子页面');
  const heading=document.createElement('strong');heading.textContent=label;panel.append(heading);
  const grid=document.createElement('div');grid.className='compact-nav-links';panel.append(grid);
  const links=children.map(([name,selector])=>{const target=original.querySelector(selector),link=document.createElement('button');link.type='button';link.textContent=name;link.onclick=()=>{target.click();close();button.focus();};grid.append(link);return {target,link};});
  row.append(button,panel);rail.append(row);
  const entry={button,panel,row,links};
  const show=()=>{if(!document.body.classList.contains('nav-collapsed'))return;close();opened=entry;panel.hidden=false;button.setAttribute('aria-expanded','true');const rect=button.getBoundingClientRect();panel.style.top=Math.max(8,Math.min(rect.top,window.innerHeight-panel.offsetHeight-12))+'px';};
  button.onclick=show;row.onpointerenter=show;row.onpointerleave=()=>{timer=setTimeout(close,160);};panel.onpointerenter=()=>clearTimeout(timer);button.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();show();links[0].link.focus();}};
  row.addEventListener('focusout',e=>{if(!row.contains(e.relatedTarget))close();});
  return entry;
 });
 const sync=()=>entries.forEach(({row,button,links})=>{row.hidden=links.every(({target})=>target.hidden);button.classList.toggle('active',links.some(({target})=>target.classList.contains('active')));links.forEach(({target,link})=>{link.hidden=target.hidden;link.classList.toggle('active',target.classList.contains('active'));link.setAttribute('aria-current',target.classList.contains('active')?'page':'false');});});
 new MutationObserver(sync).observe(original,{subtree:true,attributes:true,attributeFilter:['class','hidden']});sync();
 document.addEventListener('pointerdown',e=>{if(!rail.contains(e.target))close();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){const trigger=opened.button;close();trigger.focus();}});
 window.addEventListener('resize',close);sidebar.addEventListener('scroll',close);document.querySelector('#sidebarToggle').addEventListener('click',close);
});
// Public gateway sessions; LAN access continues to use the existing direct route.
(async function(){
  if(window.MarketPages)return;
  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,options){
    const response=await originalFetch(input,options);
    const url=new URL(typeof input==='string'?input:input.url,location.href);
    if(response.status===401&&url.origin===location.origin&&url.pathname.startsWith('/api/')){
      location.replace('/login?next='+encodeURIComponent(location.pathname+location.search+location.hash));
    }
    return response;
  };
  try{
    const response=await originalFetch('/auth/session');
    if(!response.ok)return;
    const session=await response.json();
    if(!session.authenticated)return;
    const actions=document.querySelector('.topbar-actions');if(!actions)return;
    const button=document.createElement('button');button.type='button';button.className='button secondary';button.textContent='退出登录';button.style.cssText='font-size:12px;padding:6px 10px;min-height:30px';button.title='退出当前网站账号';
    button.addEventListener('click',async()=>{button.disabled=true;try{const result=await originalFetch('/auth/logout',{method:'POST'});if(!result.ok)throw new Error('logout');location.replace('/login');}catch{button.disabled=false;button.textContent='退出失败，重试';}});
    actions.append(button);
  }catch{}
})();
