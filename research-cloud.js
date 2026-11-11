(()=>{
 const root=document.getElementById('research');if(!root)return;
 const note=root.querySelector('[data-cloud]');
 if(note?.previousElementSibling)note.previousElementSibling.textContent='生成报告时自动采集云图数据。缺失数据、登录和人群包复核可在生成记录的“更多 → 重制与补齐”中处理。';
})();
