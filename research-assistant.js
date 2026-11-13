(()=>{
const host=document.getElementById('research');if(!host)return;
host.classList.add('research-focused');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tools=new Set(['competitor_research','brand_drilldown','shop_drilldown','product_drilldown']);
const card=document.createElement('section');card.className='panel instruction-workspace';
card.innerHTML=`<div class="instruction-heading"><div><h3>Skill 分析</h3><p>描述研究对象和时间，自动匹配 Skill 或已导入模板，完成采集与生成。</p></div><button type="button" class="button secondary" data-template-manager>模板管理</button></div><form data-instruction-form><label class="sr-only" for="skillCommand">分析需求</label><textarea id="skillCommand" name="command" rows="3" maxlength="1500" placeholder="例如：分析成人牙膏2026年10月的市场趋势、品牌与卖点，生成PPT" required></textarea><div class="instruction-actions"><select name="adapter_id" aria-label="指令分析模板"><option value="">自动匹配 Skill</option></select><button type="submit" class="button">开始生成</button><details class="skill-form-more"><summary>更多</summary><button type="button" class="button ghost" data-instruction-plan>先看采集方案</button></details></div><details data-instruction-choices hidden open><summary>补充必要条件</summary><div class="pince-form-grid"><label>完整类目<textarea name="categories" rows="2"></textarea></label><label>品牌<input name="brands" placeholder="多个品牌用顿号分隔"></label><label>月份<input type="month" name="month"></label></div></details><p data-instruction-status role="status" aria-live="polite"></p><div data-instruction-summary></div></form></section>`;
const records=document.createElement('section');records.className='panel skill-records';records.innerHTML='<div class="instruction-heading"><h3>生成记录 <small data-record-count></small></h3><button type="button" class="button ghost" data-record-refresh>刷新</button></div><div data-instruction-runs><p class="muted">正在读取生成记录…</p></div><button type="button" class="button ghost" data-record-more hidden>查看更早记录</button>';
host.prepend(card,records);
const manager=document.createElement('dialog');manager.className='skill-manager-dialog';manager.innerHTML='<div class="instruction-heading"><div><h3>模板管理</h3><p>已导入模板参与自动匹配，也可以指定使用。</p></div><form method="dialog"><button class="button ghost" aria-label="关闭模板管理">关闭</button></form></div><div data-template-library></div><div class="skill-manager-footer"><label class="button secondary">导入模板<input type="file" accept=".json,application/json" hidden data-template-file></label><small>支持已适配的模板 JSON。新的 Skill 压缩包、PDF 或 PPT 需先完成数据源与版式适配。</small></div><p data-template-status role="status"></p><div data-history-trash></div>';
host.append(manager);
const form=card.querySelector('form'),f=n=>form.elements.namedItem(n),status=card.querySelector('[data-instruction-status]'),choices=card.querySelector('[data-instruction-choices]');
let busy=false,picker,loading=false,data={adapters:[],runs:[],warnings:[]},legacy=window.researchTemplateRecords||{},limit=5,recordsSignature='',adaptersSignature='',lastLoaded=0;
try{picker=window.mountPinceCategories(form);}catch{}
function payload(action){const c={};const categories=f('categories').value.split('\n').map(v=>v.trim()).filter(Boolean);if(categories.length)c.categories=categories;const brands=f('brands').value.split(/[,，、;；\n]/).map(v=>v.trim()).filter(Boolean);if(brands.length)c.brands=brands;if(f('month').value)c.months=[f('month').value];return {action,command:f('command').value,adapter_id:f('adapter_id').value||undefined,choices:c};}
function showPlan(d){
 card.querySelector('[data-instruction-summary]').innerHTML=`<div class="instruction-plan"><strong>${esc(d.summary)}</strong>${d.expected_exports?`<p>预计 ${Number(d.expected_exports)} 份 · 输出 ${esc((d.output||[]).join(' / '))}</p>`:''}${(d.needs||[]).length?'<ul>'+d.needs.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>':''}${d.plan?.children?.length?'<details><summary>查看采集内容</summary><ul>'+d.plan.children.map(c=>'<li>'+esc(c.label)+' · '+esc((c.config.modules||[]).join('、'))+'</li>').join('')+'</ul></details>':''}</div>`;
 choices.hidden=d.ready!==false;
}
async function execute(action){
 if(busy||!form.reportValidity())return;busy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='正在匹配模板与研究条件…';
 try{const d=await api('/api/research-assistant',{method:'POST',body:JSON.stringify(payload(action))});if('ready' in d){showPlan(d);status.textContent=d.ready?'方案已匹配，点击“开始生成”即可执行。':'请补充以上必要条件。';}else{card.querySelector('[data-instruction-summary]').replaceChildren();choices.hidden=true;status.textContent='已开始，完成后会出现在生成记录中。';await load();}}
 catch(error){status.textContent=error.message;}finally{busy=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
form.onsubmit=e=>{e.preventDefault();execute('execute');};card.querySelector('[data-instruction-plan]').onclick=()=>{card.querySelector('.skill-form-more').open=false;execute('plan');};
f('command').addEventListener('input',()=>{f('categories').value=f('brands').value=f('month').value='';picker?.sync();choices.hidden=true;status.textContent='';card.querySelector('[data-instruction-summary]').replaceChildren();});
f('adapter_id').addEventListener('change',()=>{status.textContent='';card.querySelector('[data-instruction-summary]').replaceChildren();});
function updateLibrary(){
 const library=data.adapters.filter(a=>!tools.has(a.id)),signature=JSON.stringify(library);if(signature===adaptersSignature)return;adaptersSignature=signature;
 const old=f('adapter_id').value;f('adapter_id').innerHTML='<option value="">自动匹配 Skill</option>'+(library.length?'<optgroup label="已导入模板">'+library.map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')+'</optgroup>':'');f('adapter_id').value=library.some(a=>a.id===old)?old:'';
 manager.querySelector('[data-template-library]').innerHTML=library.map(a=>`<article class="skill-library-item"><div><strong>${esc(a.name)}</strong><p>${esc(a.description||'已适配模板，可自动匹配使用')}</p></div><button type="button" class="button ghost" data-use-template="${esc(a.id)}">使用</button></article>`).join('')||'<p class="muted">还没有导入模板。</p>';
 manager.querySelector('[data-template-status]').textContent=(data.warnings||[]).join('；');
 if(new URLSearchParams(location.search).get('template')==='brand_monthly')f('adapter_id').value='brand_monthly';
}
const labels={dispatching:'正在安排',queued:'排队中',collecting:'采集中',generating:'生成中',complete:'已完成',failed:'需要补齐'};
function rows(){
 const current=data.runs.map(r=>({...r,origin:'instruction'}));
 const old=(legacy.runs||[]).filter(r=>r.origin!=='instruction').map(r=>({id:r.id,origin:'legacy',summary:r.plan?.title||'历史报告',status:r.busy?'collecting':r.status==='完成'?'complete':'failed',progress:{complete:r.completed_count,total:r.total_count,files:r.file_count},artifacts:r.file_count?{xlsx:true,pptx:true}:null,children:r.children}));
 return [...current,...old];
}
function renderRecords(){
 const all=rows(),signature=JSON.stringify([all,limit]);if(signature===recordsSignature)return;recordsSignature=signature;
 records.querySelector('[data-record-count]').textContent=all.length?'('+all.length+')':'';records.querySelector('[data-record-more]').hidden=all.length<=limit;
 records.querySelector('[data-instruction-runs]').innerHTML=all.slice(0,limit).map(r=>{
  const prefix=r.origin==='instruction'?'/api/research-assistant/'+r.id:'/api/research-templates/';
  const ppt=r.origin==='instruction'?prefix+'/pptx':prefix+'report/'+r.id+'?format=pptx',xlsx=r.origin==='instruction'?prefix+'/xlsx':prefix+'download/'+r.id;
  const finished=r.status==='complete',hasFiles=!!r.artifacts?.xlsx;
  const primary=finished&&hasFiles?`<a class="button secondary" href="${r.artifacts.pptx?ppt:xlsx}" download>${r.artifacts.pptx?'下载 PPT':'下载 Excel'}</a>`:r.status==='failed'&&r.origin==='instruction'?`<button type="button" class="button secondary" data-instruction-retry="${esc(r.id)}">补齐重试</button>`:r.status==='failed'&&r.origin==='legacy'?`<button type="button" class="button secondary" data-rebuild-record="${esc(r.id)}">补齐重试</button>`:'';
  const more=[hasFiles&&r.artifacts.pptx?`<a href="${xlsx}" download>下载 Excel</a>`:'',!finished&&hasFiles?`<a href="${xlsx}" download>下载已有数据</a>`:'',r.error||r.gaps?.length||r.children?.length?`<button type="button" data-record-detail="${r.origin}:${esc(r.id)}">采集详情</button>`:'',finished&&r.origin==='legacy'?`<button type="button" data-rebuild-record="${esc(r.id)}">重制补齐</button>`:''].filter(Boolean).join('');
  return `<article class="instruction-record"><div class="skill-record-main"><strong title="${esc(r.summary)}">${esc(r.summary)}</strong><small><span class="badge skill-state-${esc(r.status)}">${labels[r.status]||esc(r.status)}</span>${r.progress?`${Number(r.progress.files||0)} 份数据 · ${Number(r.progress.complete||0)}/${Number(r.progress.total||0)} 项`:''}</small></div><div class="task-actions">${primary}${more?`<details class="skill-record-more"><summary class="button ghost">更多</summary><div>${more}</div></details>`:''}</div></article>`;
 }).join('')||'<div class="skill-empty">还没有生成记录。写下研究需求，即可开始。</div>';
}
async function load(){if(loading)return;loading=true;try{data=await api('/api/research-assistant');lastLoaded=Date.now();updateLibrary();renderRecords();}catch(error){if(!busy)status.textContent=error.message;}finally{loading=false;}}
card.querySelector('[data-template-manager]').onclick=()=>{const trash=host.querySelector('[data-record-trash]');if(trash)manager.querySelector('[data-history-trash]').append(trash);manager.showModal();};
manager.addEventListener('click',e=>{const b=e.target.closest('[data-use-template]');if(b){f('adapter_id').value=b.dataset.useTemplate;manager.close();f('command').focus();}});
manager.querySelector('[data-template-file]').onchange=async e=>{const input=e.target,s=manager.querySelector('[data-template-status]');try{const file=input.files[0];if(!file)return;if(file.size>8192)throw Error('已适配模板最多8KB');const descriptor=JSON.parse(await file.text());await api('/api/research-assistant',{method:'POST',body:JSON.stringify({action:'register_adapter',descriptor})});adaptersSignature='';await load();f('adapter_id').value='';s.textContent='模板已导入，将参与自动匹配。';}catch(error){s.textContent=error.message;}finally{input.value='';}};
records.querySelector('[data-record-refresh]').onclick=async()=>{await window.refreshResearchTemplates?.();await load();};records.querySelector('[data-record-more]').onclick=()=>{limit+=10;renderRecords();};
records.addEventListener('click',async e=>{
 const retry=e.target.closest('[data-instruction-retry]');if(retry){retry.disabled=true;try{await api('/api/research-assistant',{method:'POST',body:JSON.stringify({action:'retry',id:retry.dataset.instructionRetry})});await load();}catch(error){status.textContent=error.message;}finally{retry.disabled=false;}}
 const button=e.target.closest('[data-record-detail]');if(button){const [origin,id]=button.dataset.recordDetail.split(':'),r=rows().find(r=>r.id===id&&r.origin===origin);if(!r)return;const d=document.createElement('dialog');d.className='skill-manager-dialog';d.innerHTML=`<div class="instruction-heading"><h3>采集详情</h3><form method="dialog"><button class="button ghost">关闭</button></form></div><h4>${esc(r.summary)}</h4>${r.error?`<p>${esc(r.error)}</p>`:''}${r.gaps?.length?'<ul>'+r.gaps.map(g=>'<li>'+esc(g)+'</li>').join('')+'</ul>':''}${(r.children||[]).map(c=>`<article class="skill-library-item"><div><strong>${esc(c.label)}</strong><p>${esc(c.error||c.status||'')} · ${Number(c.file_count||0)}/${Number(c.expected||0)} 份</p></div>${c.job_id?`<button type="button" class="button ghost" data-skill-log="${esc(c.job_id)}">日志</button>`:''}</article>`).join('')}`;host.append(d);d.addEventListener('close',()=>d.remove());d.onclick=event=>{const b=event.target.closest('[data-skill-log]');if(b)openTaskLog(b.dataset.skillLog);};d.showModal();}
});
window.addEventListener('research-records-loaded',e=>{legacy=e.detail;renderRecords();});
const actions=document.querySelector('.topbar-actions');if(actions){const shortcut=document.createElement('button');shortcut.type='button';shortcut.className='button secondary';shortcut.textContent='一句话采集';shortcut.onclick=()=>{switchSection('research');card.scrollIntoView({behavior:'smooth',block:'start'});f('command').focus();};actions.prepend(shortcut);}
window.addEventListener('market-section-changed',()=>{if(state.section==='research')load();});
setInterval(()=>{if(state.section==='research'&&!document.hidden&&(data.runs.some(r=>['dispatching','queued','collecting','generating'].includes(r.status))||Date.now()-lastLoaded>60000))load();},10000);
if(state.section==='research'||new URLSearchParams(location.search).get('section')==='research')load();
})();
