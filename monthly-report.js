(()=>{
const root=document.getElementById('monthly');if(!root)return;
const research=document.getElementById('research');let selectMonthly;
if(research){
 const standard=document.createElement('div');standard.className='research-standard-view';
 while(research.firstChild)standard.append(research.firstChild);
 const tabs=document.createElement('div');tabs.className='research-mode-tabs';tabs.setAttribute('aria-label','分析模板类型');
 tabs.innerHTML='<button type="button" class="active" data-research-mode="standard">类目研究与 PPT</button><button type="button" data-research-mode="monthly">品牌月度复盘 Skill</button>';
 root.classList.remove('section');root.hidden=true;research.append(tabs,standard,root);
 selectMonthly=monthly=>{root.hidden=!monthly;standard.hidden=monthly;tabs.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',(b.dataset.researchMode==='monthly')===monthly);b.setAttribute('aria-pressed',String((b.dataset.researchMode==='monthly')===monthly));});if(monthly)window.dispatchEvent(new Event('research-monthly-selected'));const url=new URL(location.href);url.searchParams.set('section','research');if(monthly)url.searchParams.set('template','brand_monthly');else url.searchParams.delete('template');history.replaceState(null,'',url);};
 tabs.onclick=e=>{const b=e.target.closest('[data-research-mode]');if(b)selectMonthly(b.dataset.researchMode==='monthly');};
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let loaded=false,picker;
root.innerHTML=`<section class="panel" style="padding:24px"><div class="template-editor-heading"><h3>品牌月度复盘</h3><span class="badge">Monthly Report Skill</span><a class="button secondary" href="/api/monthly-report-skill/reference" target="_blank" rel="noopener">查看34图参考样板</a></div><p class="muted">市场态势、品牌经营、人群与店铺的月度复盘。主要交付为交互图表和 Excel 底表，与现有 PPT 模板独立。</p><small>当前已接入参考样板、时间口径和采集计划。7模块自动采集仍需逐项适配与验收，不会把参考数据标成新月份报告。</small></section>
<section class="panel" style="padding:24px;margin-top:16px"><h3>配置月报</h3><form data-monthly-form><div class="pince-form-grid"><label>品牌名称<input name="brand_name" placeholder="请输入品牌名称" maxlength="80" required></label><label>复盘月份<input name="report_month" type="month" required></label><label>市场类目<textarea name="categories" rows="2" placeholder="请选择完整类目" required></textarea></label><label>竞品名称<textarea name="competitors" rows="2" placeholder="每行一个；待确认品牌ID及画像范围"></textarea></label></div><div class="template-actions"><button type="button" class="button secondary" data-monthly-plan>查看采集计划</button><button type="submit" class="button">保存月报草稿</button><span class="muted">草稿不会启动采集、消耗导出次数或新建云图资产。</span></div><p data-monthly-status role="status"></p></form><div data-monthly-plan-output></div></section>
<section class="panel" style="padding:24px;margin-top:16px"><h3>7 个报告模块</h3><div data-monthly-modules></div></section>
<section class="panel" style="padding:24px;margin-top:16px"><h3>数据源适配</h3><div data-monthly-sources></div></section>
<section class="panel" style="padding:24px;margin-top:16px"><h3>月报配置记录</h3><div data-monthly-drafts></div></section>`;
const form=root.querySelector('form'),field=n=>form.elements.namedItem(n),status=root.querySelector('[data-monthly-status]');
function payload(action){return {action,brand_name:field('brand_name').value,report_month:field('report_month').value,categories:field('categories').value.split('\n').map(x=>x.trim()).filter(Boolean),competitors:field('competitors').value.split('\n').map(x=>x.trim()).filter(Boolean)};}
function showPlan(p){const w=p.windows;root.querySelector('[data-monthly-plan-output]').innerHTML=`<div style="border-top:1px solid var(--border,#e9e4f2);padding-top:18px;margin-top:18px"><strong>${esc(p.title)} · ${esc(p.status)}</strong><div class="pince-form-grid" style="margin-top:14px"><div><span class="muted">完整趋势窗</span><p>${esc(w.trend_months[0])} — ${esc(w.trend_months.at(-1))}（13个月）</p></div><div><span class="muted">同比基期</span><p>${esc(w.yoy.start)} — ${esc(w.yoy.end)}</p></div><div><span class="muted">过去12个月画像（不含当月）</span><p>${esc(w.portrait_past12.start)} — ${esc(w.portrait_past12.end)}</p></div><div><span class="muted">月初老客快照</span><p>${esc(w.old_customer_snapshot)}（单日）</p></div></div><details open><summary>采集前需要核验的配置与权限</summary><ul>${p.blockers.map(x=>'<li>'+esc(x)+'</li>').join('')}</ul></details><small class="muted">云图配额：尚未读取；新增资产 0 个。次月复购窗 ${esc(w.next_month_repurchase.start)} — ${esc(w.next_month_repurchase.end)}，未到完整月不计算。</small></div>`;}
function fill(p){field('brand_name').value=p.profile.meta.brand_name;field('report_month').value=p.windows.month;field('categories').value=p.profile.categories.join('\n');field('competitors').value=p.profile.entities.competitors.map(x=>x.name).join('\n');picker?.sync();showPlan(p);}
async function load(){
 try{
  const d=await api('/api/monthly-report-skill');
  root.querySelector('[data-monthly-modules]').innerHTML='<div class="table-wrap"><table class="data-table"><thead><tr><th>模块</th><th>报告内容</th><th>数据源</th></tr></thead><tbody>'+d.modules.map(m=>`<tr><td>${esc(m.name)}</td><td>${esc(m.scope)}</td><td>${esc(m.sources.join(' / '))}</td></tr>`).join('')+'</tbody></table></div>';
  root.querySelector('[data-monthly-sources]').innerHTML='<div class="table-wrap"><table class="data-table"><thead><tr><th>来源</th><th>当前状态</th><th>待核验</th></tr></thead><tbody>'+d.sources.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.status)}</td><td>${esc(s.required)}</td></tr>`).join('')+'</tbody></table></div>';
  root.querySelector('[data-monthly-drafts]').innerHTML=d.drafts.length?d.drafts.map(d=>`<article class="task research-row"><div class="task-body"><h3>${esc(d.title)}</h3><p>${esc(d.status)}</p></div><div class="task-actions"><button type="button" class="button secondary" data-monthly-load="${esc(d.id)}">载入配置</button></div></article>`).join(''):'<p class="muted">尚无月报草稿。</p>';
  if(!loaded){loaded=true;Promise.allSettled([api('/api/feigua/pince'),api('/api/competitors')]);if(d.drafts.length)fill(await api('/api/monthly-report-skill/drafts/'+d.drafts[0].id));}
 }catch(error){status.textContent=error.message;}
}
async function submit(action){if(!form.reportValidity())return;const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{status.textContent='正在核对配置…';const p=await api('/api/monthly-report-skill',{method:'POST',body:JSON.stringify(payload(action))});showPlan(p);status.textContent=action==='save'?'月报草稿已保存；尚未启动采集。':'采集计划已生成；各来源仍需独立核验。';if(action==='save')await load();}catch(error){status.textContent=error.message;}finally{buttons.forEach(b=>b.disabled=false);}}
form.onsubmit=e=>{e.preventDefault();submit('save');};root.querySelector('[data-monthly-plan]').onclick=()=>submit('plan');
root.querySelector('[data-monthly-drafts]').onclick=async e=>{const b=e.target.closest('[data-monthly-load]');if(!b)return;try{fill(await api('/api/monthly-report-skill/drafts/'+b.dataset.monthlyLoad));form.scrollIntoView({behavior:'smooth'});}catch(error){showToast(error.message);}};
try{picker=window.mountPinceCategories?.(form);}catch{}
window.addEventListener('research-monthly-selected',load);
window.addEventListener('market-section-changed',()=>{if(state.section==='research'&&!root.hidden)load();});
const query=new URLSearchParams(location.search);
if(query.get('section')==='monthly'||query.get('template')==='brand_monthly'){switchSection('research');selectMonthly?.(true);}
})();
