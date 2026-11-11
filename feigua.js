function pinceExportEstimate(config){
 const limited=['标题卖点增长榜','标题卖点飙升榜','标题卖点趋势榜'];
 const now=new Date();
 const count=(config.periods||[]).reduce((n,value)=>n+(config.modules||[]).reduce((sum,module)=>{
  if(!limited.includes(module))return sum+1;
  if(config.period_type==='half')return sum+2;
  if(config.period_type==='year'&&!/-YT[DM]$/.test(value))return sum+4;
  const cumulative=['ytd','ytm'].includes(config.period_type)||/-YT[DM]$/.test(value);
  if(cumulative){const months=now.getMonth();return sum+Math.floor(months/3)+months%3;}
  return sum+1;
 },0),0);
 return (config.categories||[]).length*count;
}
function renderCategoryDownloads(run,base='/api/feigua/pince/download/'){
 const categories=run.categories||[];if(categories.length<2)return '';
 return `<details class="category-downloads"><summary>按类目下载（${categories.length}）</summary>${categories.map(c=>`<a data-pince-merged href="${base}${run.id}?merged=1&category=${encodeURIComponent(c)}" download title="${escapeHtml(c)}">⇩ ${escapeHtml(c)}</a>`).join('')}</details>`;
}
function renderSkippedExports(run){
 return run?.skipped?.length?`<details class="download-history"><summary>${run.skipped.length} 项未导出（查看原因）</summary>${run.skipped.map(x=>`<small class="download-date export-skip-item">${escapeHtml(x.category+' / '+(x.period?.value||'')+' / '+x.module+'：'+x.reason)}</small>`).join('')}</details>`:'';
}
function renderDownloads(runs,base='/api/feigua/pince/download/'){
 const available=runs.filter(r=>r.count).sort((a,b)=>b.updated-a.updated);
 if(!available.length){const receipt=[...runs].sort((a,b)=>b.updated-a.updated)[0];return renderSkippedExports(receipt)||'<span class="muted">运行后可下载</span>';}
 const latest=available[0];
 const link=(r,label)=>base.includes('/competitors/')?`<a data-pince-merged href="${base}${r.id}?merged=1&group=brand" download>${label} · 按品牌</a><a data-pince-merged href="${base}${r.id}?merged=1&group=module" download>${label} · 按采集内容</a>`:`<a data-pince-merged href="${base}${r.id}?merged=1" download>${label}</a>`;
 return renderCategoryDownloads(latest,base)+renderSkippedExports(latest)+link(latest,latest.status==='succeeded'?(latest.count>1?'⇩ 下载合并数据':'⇩ 下载最新数据'):'⇩ 下载已完成部分')+`<small class="download-date">${new Date(latest.updated*1000).toLocaleString('zh-CN')} · ${latest.count} 份</small>`+(latest.count>1?`<a class="original-download" href="${base}${latest.id}?original=1" download>原始文件</a>`:'')+(available.length>1?`<details class="download-history"><summary>历史结果（${available.length-1}）</summary>${available.filter(r=>r!==latest).map(r=>link(r,new Date(r.updated*1000).toLocaleString('zh-CN')+(r.status==='succeeded'?'':' · 部分完成'))).join('')}</details>`:'');
}
sectionMeta.feigua = ["飞瓜数据", "小店与品牌手动采集 · 原配置飞书补缺 · 不加入每日任务"];
function renderFeiguaTasks() {
  if (!document.querySelector("#feiguaTaskGrid")) return;
  const definitions = [
    ["feigua_shop_collect", "飞瓜小店采集并上传", "collect"],
    ["feigua_brand_collect", "飞瓜品牌采集并上传", "collect"],
    ["feigua_shop_upload", "飞瓜小店仅上传", "upload"],
    ["feigua_brand_upload", "飞瓜品牌仅上传", "upload"],
  ];
  const available = definitions.filter(([id]) => state.tasks.some(task => task.id === id)).length;
  document.querySelector("#feiguaTaskStatus").textContent = available === 4
    ? "支持立即运行，或设置每日自动采集时间。"
    : "接入代码已准备，当前后端尚未加载全部飞瓜任务。为保留正在运行的任务，本次没有重启控制台；后端下次正常启动后可运行。";
  document.querySelector("#feiguaTaskGrid").innerHTML = definitions.map(([id, title, kind]) => {
    const task = state.tasks.find(item => item.id === id);
    if (task) return renderTaskCard(task)
      .replace(/已就绪 \d+\/\d+/, '原配置飞书 · 补缺写入')
      .replace('从平台获取最新数据', '近一个月采集、自动补缺上传及回读');
    return `<article class="task"><div class="task-body"><div class="task-top"><h3>${title}</h3><span class="badge ${kind}">${kind === 'collect' ? '采集' : '上传'}</span></div><p>${kind === 'collect' ? '近一个月采集、自动补缺上传及回读' : '使用已有月报补传，不重新导出'}</p><span class="badge">等待后端加载</span></div><div class="task-actions"><button type="button" class="button" disabled>暂未启用</button></div></article>`;
  }).join("");
}
// Custom tasks stay in this workspace; the shared queue retains execution history.
(() => {
  const form=document.querySelector('#pinceForm');if(!form)return;
  const status=document.querySelector('#pinceStatus'), list=document.querySelector('#pinceTasks');
  const names={day:'自然日',week:'完整周',rolling:'近N天',custom:'自定义',campaign:'大促',month:'自然月',year:'年度',quarter:'完整季度',half:'完整半年',ytd:'当年 YTD',ytm:'当年 YTM'};
  const split=v=>[...new Set(v.split(/[\n,，]+/).map(x=>x.trim()).filter(Boolean))];
  const last=new Date();last.setDate(1);last.setMonth(last.getMonth()-1);
  const month=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  form.elements.periods.value=month(last);
  let loaded=false,loading=false,saved=[],jobs=[];
  const taskSearch=document.createElement('input');taskSearch.className='pince-task-search';taskSearch.placeholder='搜索任务、类目或年份';taskSearch.setAttribute('aria-label','搜索采集任务');document.querySelector('.pince-saved-head').append(taskSearch);taskSearch.addEventListener('input',applyScope);
  const scopes={market:{title:'基础类目',group:'市场机会',modules:['趋势分析','销售趋势','品类分布','品类趋势','市场竞争详情']},rank:{title:'品牌榜',group:'市场榜单',modules:['品牌销售榜']},sell:{title:'卖点榜',group:'市场榜单',modules:['标题卖点销售榜','标题卖点增长榜','标题卖点飙升榜','标题卖点趋势榜']},goods:{title:'商品分析',group:'品类洞察',modules:['商品趋势','价格带趋势变化','价格列表','标题卖点列表','属性列表','商品列表']}};
  let pinceScope=scopes[new URLSearchParams(location.search).get('scope')]?new URLSearchParams(location.search).get('scope'):'market';const drafts={};
  const panel=form.closest('.pince-panel'),workspace=document.createElement('div');workspace.className='pince-workspace';panel.before(workspace);
  workspace.innerHTML='<nav class="pince-business-nav" aria-label="飞瓜业务板块"><div>市场机会</div><button type="button" data-pince-scope="market">基础类目</button><div>市场榜单</div><button type="button" data-pince-scope="rank">品牌榜</button><button type="button" data-pince-scope="sell">卖点榜</button><div>品类洞察</div><button type="button" data-pince-scope="goods">商品分析</button></nav>';
  workspace.append(panel);
  const businessNav=workspace.querySelector(".pince-business-nav");
  document.querySelector(".nav-item[data-section=feigua]").after(businessNav);
  const scopeOf=modules=>{const keys=[...new Set(modules.map(m=>m==='潜力类目'?'market':Object.keys(scopes).find(k=>scopes[k].modules.includes(m))))];return keys.length===1?keys[0]:'mixed';};
  const allowed=(module,scope=pinceScope)=>scopes[scope]?.modules.includes(module)||false;
  function captureDraft(){const d={};for(const key of ['title','categories','period_type','periods'])d[key]=form.elements[key].value;for(const key of ['modules','fields'])d[key]=[...form.querySelectorAll(`[name=${key}]:checked`)].map(e=>e.value);try{d.price_bands=window.priceBands?.get();}catch{d.price_bands={mode:"default"};}return d;}
  function applyScope(){
    businessNav.querySelectorAll('[data-pince-scope]').forEach(b=>{const active=b.dataset.pinceScope===pinceScope&&state.section==='feigua';b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');});
    form.hidden=pinceScope==='mixed';
    document.body.dataset.pinceScope=pinceScope;window.priceBands?.show(pinceScope==='goods');
    const view=scopes[pinceScope]||{title:'跨板块历史任务',group:'历史配置'};
    if(state.section==='feigua')document.querySelector('#pageTitle').textContent=view.title;
    panel.querySelector('.pince-heading h3').textContent=view.group+' · '+view.title;
    panel.querySelector('.pince-heading p').textContent='按类目与时间依次导出所选模块，完成后可合并下载。';
    panel.querySelector('.pince-saved-head h3').textContent=view.title+'任务';
    form.querySelectorAll('[name=modules]').forEach(input=>{const visible=allowed(input.value);input.closest('label').hidden=!visible;input.disabled=!visible;if(!visible)input.checked=false;});
    form.querySelector('[type=submit]').textContent='保存'+view.title+'任务';
    // Cross-module archives remain accessible in execution records.
    list.querySelectorAll('[data-pince-task-scope]').forEach(card=>card.hidden=card.dataset.pinceTaskScope!==pinceScope||!card.textContent.toLowerCase().includes(taskSearch.value.trim().toLowerCase()));
    let empty=list.querySelector('.pince-scope-empty');if(!empty){empty=document.createElement('div');empty.className='asset-empty pince-scope-empty';list.append(empty);}empty.textContent=taskSearch.value.trim()?'没有匹配的任务，请更换关键词。':pinceScope==='mixed'?'暂无跨板块历史任务':'当前板块暂无任务，填写上方配置后保存。';empty.hidden=[...list.querySelectorAll('[data-pince-task-scope]')].some(c=>!c.hidden);
    update();
  }
  function switchScope(scope){if(scope===pinceScope){applyScope();return;}if(pinceScope!=='mixed')drafts[pinceScope]=captureDraft();pinceScope=scope;
    if(scope!=='mixed'){const d=drafts[scope];window.priceBands?.set(d?.price_bands);for(const key of ['title','categories','periods','period_type'])if(d)form.elements[key].value=d[key];else if(key==='title'||key==='categories')form.elements[key].value='';
      form.querySelectorAll('[name=modules]').forEach(e=>e.checked=d?d.modules.includes(e.value):e.value===(scopes[scope]?.modules[0]||'趋势分析'));
      if(d)form.querySelectorAll('[name=fields]').forEach(e=>e.checked=d.fields.includes(e.value));
    }const chosenPeriods=form.elements.periods.value;form.elements.period_type.dispatchEvent(new Event('change',{bubbles:true}));form.elements.periods.value=chosenPeriods;applyScope();refreshPresets();
  }
  businessNav.addEventListener('click',event=>{const button=event.target.closest('[data-pince-scope]');if(button){switchSection('feigua');switchScope(button.dataset.pinceScope);}});

  function taskRunButtons(id){const j=jobs.find(x=>x.task_id===id),active=j&&['queued','running','cancelling'].includes(j.status);return `<button class="button" data-pince-run="${id}" ${active?'disabled':''}>${active?({'queued':'排队中','running':'采集中','cancelling':'取消中'})[j.status]:'运行'}</button>${j?`<button class="button ghost" data-pince-log="${j.id}">${j.status==='failed'?'失败原因':'日志'}</button>`:''}`;}
  function update(){
    const modules=[...form.querySelectorAll('[name=modules]:checked')].map(x=>x.value);
    const fieldCount=form.querySelectorAll('[name=fields]:checked').length;
    const units=1;
    const count=pinceExportEstimate({categories:split(form.elements.categories.value),periods:split(form.elements.periods.value),period_type:form.elements.period_type.value,modules});
    document.querySelector('#pinceEstimate').textContent=count?`预计导出 ${count} 份${count>180?' · 请缩减至 180 份以内':''}${modules.some(m=>['标题卖点增长榜','标题卖点飙升榜','标题卖点趋势榜'].includes(m))&&['year','half','ytm','ytd'].includes(form.elements.period_type.value)?' · 增长/飙升/趋势榜按季度拆分，尾部完整月按月':''}`:'选择类目、时间与采集内容';
    document.querySelector('#pinceFieldPanel').hidden=true;
    const fields=[...form.querySelectorAll('[name=fields]')];
    const selected=fields.filter(x=>x.checked).length;
    fields.forEach(x=>x.disabled=false);
  }
  async function load(){
    if(loading||list.querySelector('[data-busy]'))return;loading=true;
    try{
      const [data,jobData]=await Promise.all([api('/api/feigua/pince'),api('/api/jobs')]);saved=data.tasks;jobs=jobData;
      if(!loaded){
        document.querySelector('#pinceModules').innerHTML=data.modules.map((v,i)=>`<label><input type="checkbox" name="modules" value="${escapeHtml(v)}" ${v===(scopes[pinceScope]?.modules[0]||'趋势分析')?'checked':''}>${escapeHtml(v==='品牌销售榜'?'品牌榜':v)}</label>`).join('');
        document.querySelector('#pinceFields').innerHTML=data.fields.map(v=>`<label><input type="checkbox" name="fields" value="${escapeHtml(v)}" ${['销售额','销量','浏览量','转化率','销售均价','视频销售额'].includes(v)?'checked':''}>${escapeHtml(v==='品牌销售榜'?'品牌榜':v)}</label>`).join('');
        loaded=true;status.textContent='';
      }
      const openedDetails=new Set([...list.querySelectorAll('details[open]')].map(d=>d.closest('[data-pince-task-id]')?.dataset.pinceTaskId+'|'+d.className+'|'+d.querySelector('summary')?.textContent));
      list.innerHTML=saved.length?saved.map(({id,config:c,runs=[]})=>`<article class="task research-row" data-pince-task-id="${id}" data-pince-task-scope="${scopeOf(c.modules)}"><div class="task-body"><h3>${escapeHtml(c.title)}</h3><p title="${escapeHtml(c.categories.join('、'))}">${escapeHtml(c.categories.join('、'))}</p></div><div class="research-period"><strong>${names[c.period_type]||''}</strong><span>${escapeHtml(c.periods.join('、'))}</span></div><div class="research-modules">${c.modules.map(m=>`<span>${escapeHtml(m==='品牌销售榜'?'品牌榜':m)}</span>`).join('')}<small>预计 ${pinceExportEstimate(c)} 份 / 次</small>${c.modules.includes('潜力类目')?'<small>潜力类目已停用，请复用后重新选择内容</small>':''}${c.price_bands&&c.price_bands.mode!=='default'?`<small>${escapeHtml(window.priceBands.summary(c.price_bands))}</small>`:''}</div><div class="task-downloads">${renderDownloads(runs)}</div><div class="task-actions">${taskRunButtons(id)}${scopeOf(c.modules)==='mixed'?`<button class="button secondary" data-pince-copy="${id}" data-copy-scope="market">复用类目</button><button class="button secondary" data-pince-copy="${id}" data-copy-scope="rank">复用品牌榜</button>`:`<button class="button secondary" data-pince-copy="${id}">复用</button>`}<button class="button ghost" data-pince-delete="${id}">删除</button></div></article>`).join(''):'<div class="asset-empty">暂无自定义任务。填写上方配置后保存即可。</div>';
      list.querySelectorAll('details').forEach(d=>{d.open=openedDetails.has(d.closest('[data-pince-task-id]')?.dataset.pinceTaskId+'|'+d.className+'|'+d.querySelector('summary')?.textContent);});
      if(!form.querySelector('[name=modules]:checked'))form.querySelector(`[name=modules][value="${scopes[pinceScope]?.modules[0]||'趋势分析'}"]`).checked=true;
      list.querySelector('.asset-empty:not(.pince-scope-empty)')?.remove();applyScope();
    }catch(e){status.textContent=e.message;}finally{loading=false;}
  }
  form.addEventListener('change',update);form.addEventListener('input',update);
  const quick=document.createElement('div');quick.className='pince-calendar-presets';
  quick.innerHTML=`<span>按年度快速选取</span><input id="pinceQuickYear" type="number" min="2023" max="${new Date().getFullYear()}" value="${new Date().getFullYear()}" aria-label="季度和半年所属年份"><div>${['H1','H2','Q1','Q2','Q3','Q4'].map(v=>`<button type="button" class="chip" data-pince-part="${v}">${({H1:'上半年',H2:'下半年'})[v]||v}</button>`).join('')}</div><small id="pincePeriodHint"></small>`;
  form.querySelector('.pince-form-grid').after(quick);
  function periodValues(kind,count){
    const now=new Date(),year=now.getFullYear();
    if(['ytd','ytm'].includes(kind))return [String(year)];
    if(kind==='day'||kind==='week'){const end=new Date(year,now.getMonth(),now.getDate());const step=kind==='week'?7:1;if(kind==='week')end.setDate(end.getDate()-((end.getDay()+6)%7)-7);else end.setDate(end.getDate()-1);return Array.from({length:count},(_,i)=>{const d=new Date(end);d.setDate(d.getDate()-i*step);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;});}
    if(kind==='rolling')return ['30'];
    if(kind==='campaign'||kind==='custom')return [];
    const size=kind==='year'?12:kind==='half'?6:kind==='quarter'?3:1;
    const latest=Math.floor((year*12+now.getMonth())/size)-1;
    return Array.from({length:count},(_,i)=>{const m=(latest-i)*size,y=Math.floor(m/12),part=Math.floor((m%12)/size)+1;return y<2023?null:kind==='year'?String(y):kind==='quarter'?`${y}-Q${part}`:kind==='half'?`${y}-H${part}`:`${y}-${String(part).padStart(2,'0')}`;}).filter(Boolean);
  }
  function refreshPresets(){
    const kind=form.elements.period_type.value,cumulative=['ytd','ytm'].includes(kind);
    form.querySelectorAll('[data-pince-period]').forEach(b=>{b.disabled=cumulative&&b.dataset.pincePeriod!=='last';b.title=cumulative?'当年累计仅包含一个周期':'';});
    const y=Number(document.querySelector('#pinceQuickYear').value),today=new Date();
    quick.querySelectorAll('[data-pince-part]').forEach(b=>{const v=b.dataset.pincePart,size=v[0]==='H'?6:3,end=new Date(y,Number(v[1])*size,1);b.disabled=y<2023||y>today.getFullYear()||end>today;b.title=b.disabled?'该周期尚未结束或超出支持范围':'';});
    document.querySelector('#pincePeriodHint').textContent=cumulative?'当年累计只支持当前年度；如需近三年，请选择完整年度。':`当前口径：${names[kind]}；近三个周期 = ${periodValues(kind,3).join('、')}。季度与半年按钮会切换到对应口径。`;
  }
  form.elements.period_type.addEventListener('change',()=>{form.elements.periods.value=periodValues(form.elements.period_type.value,1).join('\n');refreshPresets();update();});
  quick.querySelector('input').addEventListener('input',refreshPresets);
  form.addEventListener('click',e=>{const b=e.target.closest('[data-pince-period],[data-pince-part]');if(!b)return;
    if(b.dataset.pincePart){const part=b.dataset.pincePart;form.elements.period_type.value=part[0]==='H'?'half':'quarter';form.elements.period_type.dispatchEvent(new Event('change',{bubbles:true}));form.elements.periods.value=quick.querySelector('input').value+'-'+part;}
    else form.elements.periods.value=periodValues(form.elements.period_type.value,b.dataset.pincePeriod==='three'?3:b.dataset.pincePeriod==='six'?6:1).join('\n');
    refreshPresets();update();
  });
  const advanced=document.createElement('details');advanced.className='pince-advanced-period';quick.before(advanced);advanced.innerHTML='<summary>高级选择 · 指定年份的季度或半年</summary>';advanced.append(quick);
  const smart=document.createElement('div');smart.className='pince-smart-periods';form.querySelector('.pince-form-grid').before(smart);
  smart.innerHTML='<span>一键选时间</span><div>'+[['last','上一完整周期'],['three','近三个周期'],['lastyear','去年全年'],['lastquarters','去年四个季度'],['thisquarters','今年已完成季度'],['lastmonths','去年十二个月'],['thishalf','最近完整半年']].map(([id,label])=>`<button type="button" class="chip" data-pince-smart="${id}">${label}</button>`).join('')+'</div><small id="pinceSmartPreview"></small>';
  function smartPreview(){const type=form.elements.period_type.value,values=split(form.elements.periods.value);document.querySelector('#pinceSmartPreview').textContent=`已选：${names[type]} · ${values.join('、')||'未选择'}${['quarter','half'].includes(type)?'；使用品策原生完整周期导出。':''}`;smart.querySelector('[data-pince-smart=three]').disabled=['ytd','ytm'].includes(type);}
  smart.addEventListener('click',event=>{const button=event.target.closest('[data-pince-smart]');if(!button)return;const key=button.dataset.pinceSmart,year=new Date().getFullYear();let type=form.elements.period_type.value,values;
    if(key==='last'||key==='three')values=periodValues(type,key==='three'?3:1);
    if(key==='lastyear'){type='year';values=[String(year-1)];}
    if(key==='lastquarters'){type='quarter';values=[1,2,3,4].map(q=>`${year-1}-Q${q}`);}
    if(key==='thisquarters'){type='quarter';values=Array.from({length:Math.floor(new Date().getMonth()/3)},(_,i)=>`${year}-Q${i+1}`);if(!values.length){status.textContent='今年尚无完整季度，可选择上一完整周期。';return;}}
    if(key==='lastmonths'){type='month';values=Array.from({length:12},(_,i)=>`${year-1}-${String(i+1).padStart(2,'0')}`);}
    if(key==='thishalf'){type='half';values=periodValues(type,1);}
    form.elements.period_type.value=type;form.elements.period_type.dispatchEvent(new Event('change',{bubbles:true}));form.elements.periods.value=values.join('\n');refreshPresets();update();smartPreview();
  });
  form.addEventListener('input',smartPreview);form.addEventListener('change',smartPreview);form.addEventListener('click',()=>queueMicrotask(smartPreview));
  refreshPresets();smartPreview();
  document.querySelector('#pinceRefreshResults').addEventListener('click',load);
  window.addEventListener('pince-job-started',load);
  setInterval(()=>{if(state.section==='feigua'&&!document.hidden)load();},15000);
  form.addEventListener('submit',async e=>{
    e.preventDefault();const b=form.querySelector('[type=submit]'),d=new FormData(form),p=Object.fromEntries(d);
    if(pinceScope==='goods'){try{p.price_bands=window.priceBands.get();}catch(error){status.textContent=error.message;return;}}
    p.modules=d.getAll('modules').filter(m=>allowed(m));p.fields=d.getAll('fields');
    if(!split(p.periods).length){status.textContent='请选择至少一个日期周期。';return;}if(!split(p.categories).length){status.textContent='请从下拉目录中选择类目。';return;}if(!p.modules.length){status.textContent='请至少选择一个导出模块。';return;}delete p.fields;
    p.title=p.title.trim()||`${split(p.categories)[0]||'品策'} · ${names[p.period_type]} · ${split(p.periods)[0]||''}`;
    b.disabled=true;
    try{const r=await api('/api/feigua/pince',{method:'POST',body:JSON.stringify(p)});if(!state.tasks.some(t=>t.id===r.task.id))state.tasks.push(r.task);await load();status.textContent=`已保存 ${r.config.title}，可在下方点击运行。`;list.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(e){status.textContent=e.message;}finally{b.disabled=false;}
  });
  list.addEventListener('click',async e=>{
    const download=e.target.closest('[data-pince-merged]');
    if(download){e.preventDefault();if(download.dataset.busy)return;download.dataset.busy='1';const original=download.textContent;download.textContent='正在合并…';try{const response=await fetch(download.href+'&check=1');const data=await response.json();if(!response.ok||!data.ready)throw Error(data.error||'合并未完成，请使用原始文件');const link=document.createElement('a');link.href=download.href;link.download=data.filename;document.body.append(link);link.click();link.remove();}catch(error){showToast(error.message);}finally{delete download.dataset.busy;download.textContent=original;}return;}

    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.pinceLog){await openTaskLog(b.dataset.pinceLog);return;}
    const id=b.dataset.pinceRun||b.dataset.pinceCopy||b.dataset.pinceDelete,item=saved.find(x=>x.id===id);if(!item)return;
    b.disabled=true;
    try{
      if(b.dataset.pinceDelete){await api('/api/feigua/pince',{method:'POST',body:JSON.stringify({action:'delete',task_id:id})});state.tasks=state.tasks.filter(t=>t.id!==id);await load();renderTasks();status.textContent='已删除自定义任务，历史运行记录保留。';}
      else if(b.dataset.pinceCopy){const c=item.config;switchScope(b.dataset.copyScope||scopeOf(c.modules));window.priceBands?.set(c.price_bands);for(const key of ['title','period_type'])form.elements[key].value=c[key];form.elements.period_type.dispatchEvent(new Event('change',{bubbles:true}));for(const key of ['categories','periods'])form.elements[key].value=c[key].join('\n');for(const key of ['modules','fields'])form.querySelectorAll(`[name=${key}]`).forEach(x=>x.checked=c[key].includes(x.value));applyScope();form.scrollIntoView({behavior:'smooth'});status.textContent='已填入当前板块配置，修改后保存为独立任务。';}
      else{state.tasks=await api('/api/tasks');const task=state.tasks.find(t=>t.id===id);if(!task)throw new Error('任务已不存在，请刷新');openRunModal(task);}
    }catch(e){status.textContent=e.message;}finally{b.disabled=false;}
  });
  document.querySelector('[data-section="feigua"]')?.addEventListener('click',load);load();
})();


window.mountPinceCategories=function(form,{raw=form.elements.categories,single=false,allowAll=false}={}){
 if(!form)return;
 raw.required=false;raw.closest('label').hidden=true;
 const widget=document.createElement('div');widget.className='pince-category-select';raw.closest('label').before(widget);
 widget.innerHTML=`<label id="pinceCategoryLabel">类目</label><button type="button" class="pince-category-trigger" aria-haspopup="dialog" aria-expanded="false" aria-controls="pinceCategoryOptions" aria-labelledby="pinceCategoryLabel pinceCategoryChosen"><span id="pinceCategoryChosen"></span><span>⌄</span></button>
 <div id="pinceCategoryOptions" class="pince-cascader" role="dialog" aria-label="选择类目" hidden>
 <div class="pince-cascader-search"><input id="pinceCategorySearch" aria-label="搜索类目" placeholder="输入类目关键词搜索" autocomplete="off"><button type="button" id="pinceCatalogRefresh">刷新目录</button></div>
 <div class="pince-cascader-common"><span>常用类目</span><div data-category-common></div></div>
 <div class="pince-cascader-trail" aria-label="当前类目路径"></div>
 <div class="pince-cascader-content"></div><small id="pinceCatalogStatus" role="status"></small>
 <div class="pince-cascader-footer"><button type="button" data-category-clear>清空选中</button><button type="button" data-category-favorite>存为常用</button><span data-category-count></span><button type="button" data-category-cancel>取消</button><button type="button" class="button" data-category-confirm>确定</button></div></div>`;
 widget.innerHTML=widget.innerHTML.replace(/id="(pince\w+)"/g,(_,id)=>`id="${form.id}-${id}"`).replace(/aria-controls="pinceCategoryOptions"/g,`aria-controls="${form.id}-pinceCategoryOptions"`).replace(/aria-labelledby="pinceCategoryLabel pinceCategoryChosen"/g,`aria-labelledby="${form.id}-pinceCategoryLabel ${form.id}-pinceCategoryChosen"`);
 const q=selector=>widget.querySelector(selector.replace(/#(pince\w+)/g,`#${form.id}-$1`));
 if(raw.name==='category')q('label').textContent='商品类目';
 const trigger=q('.pince-category-trigger'),pop=q('.pince-cascader'),search=q('input'),content=q('.pince-cascader-content'),hint=q('#pinceCatalogStatus');
 const values=()=>raw.value.split(/\n|,|，/).map(x=>x.trim()).filter(Boolean);
 let paths=[],tree=new Map(),draft=new Set(),trail=[];
 const esc=escapeHtml;
 function favorites(){try{return JSON.parse(localStorage.getItem('pince-category-favorites')||'[]').filter(p=>paths.includes(p));}catch{return [];}}
 function common(){q('[data-category-common]').innerHTML=favorites().slice(0,6).map(p=>`<button type="button" data-category-common-path="${esc(p)}" title="${esc(p)}">${esc(p.split('>').at(-1))}</button>`).join('')||'<span>暂无</span>';}
 function selected(){const all=values();q('#pinceCategoryChosen').innerHTML=all.length?all.slice(0,2).map(p=>`<span class="pince-selected-tag" title="${esc(p)}">${esc(p.split('>').at(-1))}</span>`).join('')+(all.length>2?`<span class="pince-selected-more">+${all.length-2}</span>`:''):'<span class="muted">请选择类目</span>';trigger.title=all.join('\n');}
 function updateCount(){q('[data-category-count]').textContent=`已选 ${draft.size} 项`;q('[data-category-confirm]').textContent=`确定 (${draft.size})`;}
 function build(){tree=new Map();for(const path of paths){let level=tree,parts=path.split('>');parts.forEach((name,i)=>{if(!level.has(name))level.set(name,{name,path:parts.slice(0,i+1).join('>'),children:new Map()});level=level.get(name).children;});}}
 function row(node,depth){const leaf=paths.includes(node.path),branch=node.children.size>0;return `<div class="pince-cascader-row ${trail[depth]===node.name?'active':''}">${leaf?`<input type="checkbox" aria-label="${esc(node.path)}" data-category-path="${esc(node.path)}" ${draft.has(node.path)?'checked':''}>`:'<span class="pince-cascader-check-space"></span>'}<button type="button" ${branch?`data-category-branch="${esc(node.name)}" data-depth="${depth}" aria-expanded="${trail[depth]===node.name}"`:`data-category-leaf="${esc(node.path)}"`} title="${esc(node.path)}"><span>${esc(node.name)}</span>${branch?'<span aria-hidden="true">›</span>':''}</button></div>`;}
 function place(){if(pop.hidden)return;const rect=trigger.getBoundingClientRect(),margin=12;
 const columns=content.querySelectorAll('.pince-cascader-column').length;
 const width=Math.min(Math.max(420,columns*208+2),window.innerWidth-margin*2);
 const left=Math.max(margin,Math.min(rect.left,window.innerWidth-width-margin));
 const below=window.innerHeight-rect.bottom-margin-6,above=rect.top-margin-6;
 const up=below<280&&above>below,available=window.innerWidth<760?window.innerHeight-margin*2:(up?above:below);
 pop.style.setProperty('--cascade-width',width+'px');pop.style.setProperty('--cascade-left',left+'px');
 pop.style.setProperty('--cascade-height',Math.max(100,Math.min(300,available-170))+'px');
 const height=pop.getBoundingClientRect().height;
 pop.style.setProperty('--cascade-top',Math.max(margin,up?rect.top-height-6:Math.min(rect.bottom+6,window.innerHeight-height-margin))+'px');
 if(!search.value.trim())content.scrollLeft=Math.max(0,content.scrollWidth-content.clientWidth);}
 function render(){const q=search.value.trim().toLowerCase();if(q){const terms=q.split(/\s+/);const matches=paths.filter(p=>terms.every(t=>p.toLowerCase().includes(t))).sort((a,b)=>(a.split('>').at(-1)===q?-1:0)-(b.split('>').at(-1)===q?-1:0)).slice(0,100);content.innerHTML='<div class="pince-cascader-results">'+(matches.map(p=>`<label><input type="checkbox" aria-label="${esc(p)}" data-category-path="${esc(p)}" ${draft.has(p)?'checked':''}><span><strong>${esc(p.split('>').at(-1))}</strong><small>${esc(p.replaceAll('>',' › '))}</small></span></label>`).join('')||'<p>没有匹配类目</p>')+'</div>';}else{let level=tree,columns=[],depth=0;while(level.size){columns.push(`<div class="pince-cascader-column" aria-label="第 ${depth+1} 级类目"><div class="pince-cascader-column-title">第 ${depth+1} 级类目</div>${[...level.values()].map(n=>row(n,depth)).join('')}</div>`);const node=level.get(trail[depth]);if(!node)break;level=node.children;depth++;}content.innerHTML=columns.join('')||'<p>目录尚未同步，请刷新目录。</p>';}
 qTrail();
 content.querySelectorAll('.pince-cascader-column').forEach(col=>{const active=col.querySelector('.active');if(active)col.scrollTop=Math.max(0,active.offsetTop-col.offsetTop-col.clientHeight/2+18);});
 updateCount();place();}
 function qTrail(){widget.querySelector('.pince-cascader-trail').innerHTML='<button type="button" data-category-up="0">全部类目</button>'+trail.map((name,i)=>`<span>›</span><button type="button" data-category-up="${i+1}">${esc(name)}</button>`).join('');}
 widget.querySelector('.pince-cascader-trail').onclick=e=>{const button=e.target.closest('[data-category-up]');if(button){trail=trail.slice(0,Number(button.dataset.categoryUp));search.value='';render();}};
 function close(){pop.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.focus();}
 function open(){draft=new Set(values());search.value='';trail=values()[0]?.split('>').slice(0,-1)||[];hint.textContent='';common();render();pop.hidden=false;trigger.setAttribute('aria-expanded','true');place();search.focus();}
 window.addEventListener('resize',place);window.addEventListener('scroll',e=>{if(!pop.contains(e.target))place();},true);
 function toggle(path){if(draft.has(path))draft.delete(path);else if(single||allowAll&&path==='全部'){draft.clear();draft.add(path);}else if(draft.size<30){if(allowAll)draft.delete('全部');draft.add(path);}else hint.textContent='单任务最多选择 30 个类目';render();}
 trigger.onclick=()=>pop.hidden?open():close();search.oninput=render;
 content.onchange=e=>{if(e.target.dataset.categoryPath)toggle(e.target.dataset.categoryPath);};
 content.onclick=e=>{const branch=e.target.closest('[data-category-branch]'),leaf=e.target.closest('[data-category-leaf]');if(branch){trail=trail.slice(0,Number(branch.dataset.depth));trail.push(branch.dataset.categoryBranch);render();}else if(leaf)toggle(leaf.dataset.categoryLeaf);};
 q('[data-category-common]').onclick=e=>{const b=e.target.closest('[data-category-common-path]');if(b)toggle(b.dataset.categoryCommonPath);};
 q('[data-category-clear]').onclick=()=>{draft.clear();render();};
 q('[data-category-cancel]').onclick=close;
 q('[data-category-confirm]').onclick=()=>{raw.value=[...draft].join('\n')||(allowAll?'全部':'');raw.dispatchEvent(new Event('input',{bubbles:true}));selected();close();};
 q('[data-category-favorite]').onclick=()=>{try{localStorage.setItem('pince-category-favorites',JSON.stringify([...draft]));common();hint.textContent='已保存常用类目';}catch{hint.textContent='浏览器未能保存常用类目';}};
 document.addEventListener('click',e=>{if(!widget.contains(e.target)&&!pop.hidden){pop.hidden=true;trigger.setAttribute('aria-expanded','false');}});
 window.addEventListener('market-section-changed',()=>{pop.hidden=true;trigger.setAttribute('aria-expanded','false');});
 pop.addEventListener('click',e=>e.stopPropagation());
 pop.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const controls=[...pop.querySelectorAll('button,input')].filter(el=>!el.disabled);if(e.shiftKey&&document.activeElement===controls[0]){e.preventDefault();controls.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===controls.at(-1)){e.preventDefault();controls[0]?.focus();}}});
 async function load(){try{const data=await api('/api/feigua/pince/categories');paths=allowAll?['全部',...(data.paths||[])]:data.paths||[];build();if(data.refresh_job)hint.textContent='目录刷新中…';selected();if(!pop.hidden){common();render();}}catch(e){hint.textContent=e.message;}}
 q('#pinceCatalogRefresh').onclick=async e=>{e.target.disabled=true;try{await api('/api/feigua/pince',{method:'POST',body:JSON.stringify({action:'refresh_categories'})});hint.textContent='目录刷新中…';}catch(error){hint.textContent=error.message;}finally{e.target.disabled=false;}};
 form.addEventListener('input',selected);form.addEventListener('change',selected);
 document.querySelector('#pinceTasks')?.addEventListener('click',()=>setTimeout(selected,100));
 setInterval(load,15000);load();selected();return {sync:selected};
};
window.mountPinceCategories(document.querySelector('#pinceForm'));



window.mountPinceCalendar = function(form,{monthOnly=false,allowedKinds=null,completeMonths=false}={}){
 if(!form)return;
 const type=form.elements.period_type,raw=form.elements.periods;
 for(const [value,label] of [['rolling','近N天'],['day','自然日'],['week','完整周'],['campaign','大促'],['custom','自定义']])if(![...type.options].some(o=>o.value===value))type.add(new Option(label,value));
 type.closest('label').hidden=true;raw.closest('label').hidden=true;raw.required=false;
 const picker=document.createElement('div');picker.className='pince-native-picker';form.querySelector('.pince-smart-periods').after(picker);
 picker.innerHTML='<div class="pince-native-toolbar"><div role="tablist" aria-label="时间口径">'+[['rolling','近N天'],['day','日'],['week','周'],['month','月'],['quarter','季'],['half','半年'],['year','年'],['campaign','大促'],['custom','自定义']].map(([k,v])=>`<button type="button" role="tab" data-native-kind="${k}">${v}</button>`).join('')+'</div><button type="button" class="pince-native-range" aria-expanded="false">▦ <span></span>⌄</button></div><div class="pince-native-popover" hidden></div><div class="pince-period-chips"></div><label class="pince-multi-period"><input type="checkbox" data-period-multi> 批量多选周期</label><small class="muted">快捷按钮与日历保持同步。</small>';
 picker.querySelector('.pince-native-toolbar').append(picker.querySelector('.pince-multi-period'));
 const shortcuts=form.querySelector('.pince-shortcuts');if(shortcuts)picker.append(shortcuts);
 const pop=picker.querySelector('.pince-native-popover'),rangeButton=picker.querySelector('.pince-native-range'),chips=picker.querySelector('.pince-period-chips');
 pop.id=form.id+'-calendar';pop.setAttribute('role','dialog');pop.setAttribute('aria-label',monthOnly?'选择截至月份':'选择采集时间');rangeButton.setAttribute('aria-controls',pop.id);rangeButton.setAttribute('aria-haspopup','dialog');
 if(monthOnly){picker.classList.add('month-only');picker.querySelector('[role=tablist]').hidden=true;picker.querySelector('.pince-multi-period').hidden=true;picker.querySelector('small').hidden=true;chips.hidden=true;}
 if(allowedKinds){picker.querySelectorAll('[data-native-kind]').forEach(b=>b.hidden=!allowedKinds.includes(b.dataset.nativeKind));picker.querySelector('[data-period-multi]').checked=true;}
 function closeCalendar(){pop.hidden=true;rangeButton.setAttribute('aria-expanded','false');}
 picker.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pop.hidden){e.preventDefault();closeCalendar();rangeButton.focus();}});
 window.addEventListener('market-section-changed',closeCalendar);
 new MutationObserver(()=>{if(pop.hidden||pop.querySelector('[data-period-done]')||monthOnly)return;const footer=document.createElement('div');footer.className='pince-period-done';footer.innerHTML='<button type="button" class="button" data-period-done>完成选择</button>';footer.onclick=()=>{closeCalendar();rangeButton.focus();};pop.append(footer);}).observe(pop,{childList:true,attributes:true,attributeFilter:['hidden']});
 let year=new Date().getFullYear(),month=new Date().getMonth(),customStart=null,customEnd=null,campaigns=[];
 const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const today=()=>new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate());
 const values=()=>raw.value.split(/\n|,|，/).map(x=>x.trim()).filter(Boolean);
 const labels={rolling:'近N天',day:'日',week:'周',month:'月',quarter:'季',half:'半年',year:'年',ytd:'年',ytm:'年',campaign:'大促',custom:'自定义'};
 function showValue(v){if(type.value==='rolling')return `近${v}天`;if(type.value==='ytd'||type.value==='ytm')return `${v}年-${type.value.toUpperCase()}`;return v;}
 function sync(){picker.querySelectorAll('[data-native-kind]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.nativeKind===type.value||b.dataset.nativeKind==='year'&&['ytd','ytm'].includes(type.value))));rangeButton.querySelector('span').textContent=(values().length>2?`已选 ${values().length} 个周期`:values().map(showValue).join('、'))||'请选择日期';chips.innerHTML=values().map((v,i)=>`<span>${escapeHtml(showValue(v))}<button type="button" data-period-remove="${i}" aria-label="移除周期 ${escapeHtml(v)}">×</button></span>`).join('');}
 function commit(v,kind=type.value){if(['year','ytd','ytm'].includes(kind)&&['year','ytd','ytm'].includes(type.value)){const prior=values().map(x=>type.value==='year'?x:x+'-'+type.value.toUpperCase());if(kind!=='year')v+='-'+kind.toUpperCase();kind='year';type.value='year';raw.value=prior.join('\n');}if(kind!==type.value){type.value=kind;type.dispatchEvent(new Event('change',{bubbles:true}));raw.value='';}const all=values();raw.value=(picker.querySelector('[data-period-multi]').checked?(all.includes(v)?all.filter(x=>x!==v):[...all,v]):[v]).join('\n');raw.dispatchEvent(new Event('input',{bubbles:true}));sync();render();if(!picker.querySelector('[data-period-multi]').checked){pop.hidden=true;rangeButton.setAttribute('aria-expanded','false');}}
 function option(value,text,disabled=false,kind=type.value){disabled=disabled||(completeMonths&&kind==='ytd');return `<button type="button" data-period-value="${escapeHtml(value)}" data-period-kind="${kind}" class="${(values().includes(kind==='year'?value:value+'-'+kind.toUpperCase())&&type.value==='year'||values().includes(value)&&kind===type.value)?'selected':''}" ${disabled?'disabled':''}>${escapeHtml(text)}</button>`;}
 function dayGrid(y,m){const first=new Date(y,m,1),offset=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate();let html='<div class="pince-day-grid">'+['一','二','三','四','五','六','日'].map(x=>`<small>${x}</small>`).join('');for(let i=0;i<offset;i++)html+='<i></i>';for(let day=1;day<=days;day++){const date=new Date(y,m,day),value=iso(date),disabled=date>=today()||y<2023;html+=`<button type="button" data-day="${value}" ${disabled?'disabled':''} class="${value===customStart||value===customEnd||values().includes(value)?'selected':''}">${day}</button>`;}return html+'</div>';}
 function render(){pop.style.top=(picker.querySelector('.pince-native-toolbar').offsetTop+picker.querySelector('.pince-native-toolbar').offsetHeight+8)+'px';const kind=type.value;pop.dataset.kind=kind;if(['year','ytd','ytm'].includes(kind)){const now=today(),end=new Date(now);end.setDate(end.getDate()-1);pop.innerHTML='<div class="pince-year-options">'+option(String(now.getFullYear()),`${now.getFullYear()}年-YTD (${now.getFullYear()}/01/01-${iso(end).replaceAll('-','/')})`,false,'ytd')+option(String(now.getFullYear()),`${now.getFullYear()}年-YTM`,now.getMonth()===0,'ytm')+Array.from({length:now.getFullYear()-2023},(_,i)=>now.getFullYear()-1-i).map(y=>option(String(y),`${y}年 (${y}/01/01-${y}/12/31)`,false,'year')).join('')+'</div>';return;}
 if(kind==='rolling'){pop.innerHTML='<div class="pince-year-options">'+[7,15,30,90,180].map(n=>option(String(n),`近${n}天`)).join('')+'</div>';return;}
 if(kind==='campaign'){pop.innerHTML='<div class="pince-year-options">'+(campaigns.length?campaigns.map(v=>option(v,v)).join(''):'<p>请刷新类目目录，同步品策大促周期。</p>')+'</div>';return;}
 pop.innerHTML=`<div class="pince-native-head"><button type="button" data-calendar-shift="-1" aria-label="上一${['day','week','custom'].includes(kind)?'月':'年'}">«</button><strong>${year} 年${['day','week','custom'].includes(kind)?' '+(month+1)+' 月':''}</strong><button type="button" data-calendar-shift="1" aria-label="下一${['day','week','custom'].includes(kind)?'月':'年'}">»</button></div>`;
 if(kind==='month')pop.innerHTML+='<div class="pince-unit-grid">'+Array.from({length:12},(_,i)=>option(`${year}-${String(i+1).padStart(2,'0')}`,['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'][i],new Date(year,i+1,1)>today()||year<2023)).join('')+'</div>';
 else if(kind==='quarter'||kind==='half'){const size=kind==='quarter'?3:6;pop.innerHTML+='<div class="pince-unit-grid">'+Array.from({length:12/size},(_,i)=>option(`${year}-${kind==='quarter'?'Q':'H'}${i+1}`,kind==='quarter'?['一季度','二季度','三季度','四季度'][i]:['上半年','下半年'][i],new Date(year,(i+1)*size,1)>today()||year<2023)).join('')+'</div>';}
 else if(kind==='custom'){const next=new Date(year,month+1,1);pop.innerHTML+=`<div class="pince-double-calendar"><div>${dayGrid(year,month)}</div><div><div class="pince-next-month">${next.getFullYear()} 年 ${next.getMonth()+1} 月</div>${dayGrid(next.getFullYear(),next.getMonth())}</div></div><div class="pince-custom-footer"><small>${customStart||'开始日期'} ~ ${customEnd||'结束日期'} · 最多185天</small><button type="button" class="button" data-custom-apply ${!customStart||!customEnd?'disabled':''}>确定</button></div>`;}
 else pop.innerHTML+=dayGrid(year,month);
 }
 rangeButton.onclick=()=>{pop.hidden=!pop.hidden;rangeButton.setAttribute('aria-expanded',String(!pop.hidden));render();};
 picker.querySelector('[role=tablist]').onclick=e=>{const b=e.target.closest('[data-native-kind]');if(!b)return;const k=b.dataset.nativeKind;if(k!==type.value){type.value=k;type.dispatchEvent(new Event('change',{bubbles:true}));}pop.hidden=false;rangeButton.setAttribute('aria-expanded','true');customStart=customEnd=null;sync();render();};
 pop.onclick=e=>{e.stopPropagation();const shift=e.target.closest('[data-calendar-shift]');if(shift){if(['day','week','custom'].includes(type.value)){const d=new Date(year,month+Number(shift.dataset.calendarShift),1);year=d.getFullYear();month=d.getMonth();}else year+=Number(shift.dataset.calendarShift);year=Math.max(2023,Math.min(today().getFullYear(),year));render();return;}const b=e.target.closest('[data-period-value]');if(b){commit(b.dataset.periodValue,b.dataset.periodKind);return;}const d=e.target.closest('[data-day]');if(d){let value=d.dataset.day;if(type.value==='custom'){if(!customStart||customEnd){customStart=value;customEnd=null;}else{customEnd=value;if(customEnd<customStart)[customStart,customEnd]=[customEnd,customStart];if((new Date(customEnd)-new Date(customStart))/86400000>=185){customEnd=null;showToast('自定义范围最多185天');}}render();}else{if(type.value==='week'){const start=new Date(value+'T00:00:00');start.setDate(start.getDate()-((start.getDay()+6)%7));const end=new Date(start);end.setDate(end.getDate()+6);if(end>=today()){showToast('请选择已结束的完整周');return;}value=iso(start);}commit(value);}return;}if(e.target.closest('[data-custom-apply]')&&customStart&&customEnd){commit(customStart+'~'+customEnd);pop.hidden=true;}};
 chips.onclick=e=>{const b=e.target.closest('[data-period-remove]');if(b){raw.value=values().filter((_,i)=>i!==Number(b.dataset.periodRemove)).join('\n');raw.dispatchEvent(new Event('input',{bubbles:true}));sync();render();}};
 document.addEventListener('click',e=>{if(!picker.contains(e.target)){pop.hidden=true;rangeButton.setAttribute('aria-expanded','false');}});
 form.addEventListener('input',sync);form.addEventListener('change',()=>{sync();render();});form.addEventListener('click',()=>queueMicrotask(sync));document.querySelector('#pinceTasks')?.addEventListener('click',()=>setTimeout(sync,100));
 async function load(){try{campaigns=(await api('/api/feigua/pince/categories')).campaigns||[];if(type.value==='campaign'&&!pop.hidden)render();}catch{}}
 if(!monthOnly&&(!allowedKinds||allowedKinds.includes('campaign'))){load();setInterval(load,15000);}sync();return {sync};
};
window.mountPinceCalendar(document.querySelector('#pinceForm'));

// Compact native-period collection form; preserve canonical fields and events.
(() => {
 const form=document.querySelector('#pinceForm');if(!form)return;
 const panel=form.closest('.pince-panel');panel.classList.add('pince-compact');
 const filters=document.createElement('div');filters.className='pince-filter-area';form.prepend(filters);
 filters.append(form.querySelector('.pince-category-select'),form.querySelector('.pince-native-picker'));
 const picker=filters.querySelector('.pince-native-picker');
 picker.querySelector('[data-period-multi]').checked=true;
 for(const el of form.querySelectorAll('.pince-smart-periods,.pince-advanced-period,.pince-shortcuts'))el.hidden=true;
 for(const el of picker.querySelectorAll(':scope > small'))el.hidden=true;
 const fieldset=form.querySelector('fieldset');fieldset.querySelector('legend').textContent='采集内容';fieldset.querySelector('small').hidden=true;
 const title=form.elements.title.closest('label');title.classList.add('pince-task-name');form.querySelector('.pince-submit').prepend(title);form.elements.title.placeholder='可选，留空自动命名';
 const saved=panel.querySelector('.pince-saved-head');saved.append(panel.querySelector('#pinceRefreshResults'));saved.querySelector('.muted').hidden=true;

})();

// Keep business navigation in the same rail on every workspace page.
window.addEventListener('market-section-changed',()=>{
  document.querySelectorAll('[data-pince-scope]').forEach(button=>{
    const active=state.section==='feigua'&&button.dataset.pinceScope===(document.body.dataset.pinceScope||'market');
    button.classList.toggle('active',active);button.setAttribute('aria-current',active?'page':'false');
  });
});
const researchHead=document.createElement('div');researchHead.className='research-table-head';researchHead.setAttribute('aria-hidden','true');
researchHead.innerHTML='<span>研究任务 / 类目</span><span>时间范围</span><span>采集内容</span><span>导出结果</span><span>操作</span>';
document.querySelector('#pinceTasks').before(researchHead);
