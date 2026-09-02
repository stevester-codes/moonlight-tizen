/* Static report-index override: avoids Alberta's missing CORS headers and public CORS proxies. */
(function(){
  function intRowsFor(id){
    const x=window.AB_REPORT_INDEX && window.AB_REPORT_INDEX.I;
    return x && (x[String(id)] || x[String(id).padStart(8,'0')]);
  }
  function atrRowsFor(id){
    const x=window.AB_REPORT_INDEX && window.AB_REPORT_INDEX.A;
    return x && (x[String(id)] || x[String(id).padStart(8,'0')]);
  }

  showINT = function(i){
    const p=INTS[i], m=iLayers[i], id=String(p[0]);
    focus(m);
    const rows=intRowsFor(id);
    let h=`<div class="title">Count location ${esc(id)}</div><div class="desc">${esc(p[3])}</div>`;
    if(!rows){
      h+=`<div class="error small">Report metadata is not in the cached index yet.</div><a class="btn" target="_blank" rel="noopener" href="${BASE+pad8(id)+'.xml'}">Open Alberta report index</a>`;
      details.innerHTML=h;
      return;
    }
    for(const r of rows){
      const [y,t,counted,rawFlag,diagramFlag]=r;
      h+=`<div class="yrow"><span class="year">${esc(y)}</span>${t==='T'?`<a class="btn" target="_blank" rel="noopener" href="${report(y,id)}">Traffic report PDF</a>`:'<span class="small">No annual report</span>'}`;
      if(counted){
        h+=`<div class="small" style="margin-left:46px">Counted ${esc(counted)} ${rawFlag==='T'?`· <a target="_blank" rel="noopener" href="${raw(y,id)}">Raw XLS</a>`:''} ${diagramFlag==='T'?`· <a target="_blank" rel="noopener" href="${diagram(y,id)}">Diagram JPG</a>`:''}</div>`;
      }
      h+='</div>';
    }
    details.innerHTML=h;
  };

  showATR = function(i){
    const p=ATR[i], m=aLayers[i], id=String(p[0]);
    focus(m);
    const rows=atrRowsFor(id);
    let h=`<div class="title">ATR ${esc(id)}</div><div class="desc">${esc(p[3])}</div><a class="btn" target="_blank" rel="noopener" href="${BASE}TenYearHistorical/${encodeURIComponent(id)}.xlsx"><b>Ten Year Historical Report</b></a>`;
    if(!rows){
      h+=`<div class="error small">Station-file metadata is not in the cached index yet.</div>`;
      details.innerHTML=h;
      return;
    }
    const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    for(const r of rows){
      const y=r[0], ann=r[1];
      h+=`<div class="yrow"><span class="year">${esc(y)}</span>`;
      if(ann==='T'){
        const u=+y>=2017?`${BASE}${y}/ATR/${encodeURIComponent(id)}.xlsx`:`${BASE}${y}/ATR/${encodeURIComponent(id)}.pdf`;
        h+=`<a class="btn" target="_blank" rel="noopener" href="${u}">Annual ${+y>=2017?'XLSX':'PDF'}</a>`;
      }
      const mm=months.filter((mon,j)=>r[j+2]==='T');
      if(mm.length){
        h+=`<div style="margin-left:46px">${mm.map(mon=>{const ext=(+y>=2018||(+y===2017&&months.indexOf(mon)>0))?'xlsx':'txt';return `<a class="btn" target="_blank" rel="noopener" href="${BASE}${y}/ATR/${mon}${y}/${encodeURIComponent(id)}.${ext}">${mon}</a>`}).join('')}</div>`;
      }
      h+='</div>';
    }
    details.innerHTML=h;
  };
})();
