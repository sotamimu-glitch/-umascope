(function(g){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=s=>String(s??'').replace(/\r/g,'').replace(/\u3000/g,' ').replace(/[ \t]+/g,' ').trim();
const num=s=>{const m=String(s??'').match(/\d+(?:\.\d+)?/);return m?Number(m[0]):null};
const iso=s=>{const m=String(s).match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);return m?`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`:''};
function uniq(a){const m=new Map();for(const h of a)if(h.number>0&&h.name&&!m.has(h.number))m.set(h.number,h);return [...m.values()].sort((a,b)=>a.number-b.number)}
function parsePayload(raw){try{const x=JSON.parse(raw);if(x&&x.umascope)return x}catch{}return {umascope:1,url:'',title:'',text:String(raw||''),tables:[],oddsText:'',oddsTables:[]}}
function parseHeaderJRA(t){const h=t.match(/(\d{4}年\d{1,2}月\d{1,2}日)[^\n]*?(\d+)回([^\d\s]+?)(\d+)日[^\n]*?(?:Image:\s*)?(\d{1,2})(?:レース|R)/);const tm=t.match(/発走時刻[：:]\s*(\d{1,2})時(\d{2})分/);const c=t.match(/コース[：:]\s*([\d,]+)メートル（(芝|ダート)(?:・([^）]+))?/);let name='';const hm=t.match(/(?:^|\n)#{1,3}\s*([^\n]+)/);if(hm)name=norm(hm[1]).replace(/^Image\s*/,'');if(!name){const lines=t.split('\n').map(norm).filter(Boolean);const i=lines.findIndex(x=>/コース[：:]/.test(x));if(i>0)name=lines[i-1].replace(/^#+\s*/,'')}
return {source:'JRA',type:'central',date:h?iso(h[1]):'',courseName:h?h[3]:'JRA',raceNo:h?Number(h[5]):null,name:name||`${h?h[5]:''}R`,start:tm?`${String(tm[1]).padStart(2,'0')}:${tm[2]}`:'',distance:c?Number(c[1].replace(',','')):null,surface:c?(c[2]==='ダート'?'ダ':c[2]):'',direction:c?c[3]||'':'',going:(t.match(/(?:芝|ダート)[：:\s]*(良|稍重|重|不良)/)||[])[1]||''}}
function parseJraPast(s){s=norm(s.replace(/\n+/g,' '));const m=s.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日\s+([^\s]+)[\s\S]*?(\d{1,2})着\s+(\d{1,2})頭[^\s]*?(\d{1,2})番人気\s+(.+?)\s+\d{2}(?:\.\d)?\s*kg\s+(\d{3,4})(芝|ダ)[^\s]*\s+\d+[:.]\d+(?:\.\d+)?\s+(良|稍重|重|不良)/);if(!m)return null;const mm=s.match(/\(([0-9]+(?:\.[0-9]+)?)\)\s*$/)||s.match(/\(([0-9]+(?:\.[0-9]+)?)\)/g);let margin=null;if(mm){const z=Array.isArray(mm)?String(mm[mm.length-1]).match(/[0-9.]+/):mm; margin=Number(z[1]||z[0])}
return {date:`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`,course:m[4],finish:Number(m[5]),field:Number(m[6]),pop:Number(m[7]),jockey:norm(m[8]).replace(/^[▲△☆◇]/,''),distance:Number(m[9]),surface:m[10],going:m[11],margin}}
function cellText(c){return norm(typeof c==='string'?c:(c&&c.text)||'')}
function cellHtml(c){return typeof c==='object'&&c?String(c.html||''):''}
function payloadTables(p){return (p.richTables&&p.richTables.length?p.richTables:(p.tables||[]))}
function fwDigits(s){return String(s||'').replace(/[０-９]/g,d=>String('０１２３４５６７８９'.indexOf(d)))}
function narNormText(s){return fwDigits(String(s||'')).replace(/\u00a0/g,' ').replace(/\r/g,'')}
function narPayloadTables(p){const out=[];for(const k of ['narDetailRichTables','narDetailTables','richTables','tables']){for(const t of (p[k]||[]))out.push(t)}return out}
function horseNoFromCells(rawCells,limit){const found=[];for(let i=0;i<Math.min(limit,rawCells.length);i++){const t=cellText(rawCells[i]);if(/^\d{1,2}$/.test(t)){const n=Number(t);if(n>=1&&n<=18)found.push(n)}const h=cellHtml(rawCells[i]);const ms=[...h.matchAll(/(?:umaban|horse[-_ ]?no|number|num)[^0-9]{0,30}(\d{1,2})/gi)];for(const m of ms){const n=Number(m[1]);if(n>=1&&n<=18)found.push(n)}}return found.length?found[found.length-1]:null}
function cleanJockey(s){return norm(String(s||'').replace(/^\s*[▲△☆◇]/,'').replace(/\s+Image:.*$/,''))}
function imgAwareCellText(c){return cellText(c)}
function parseJRA(p){const t=p.text||'';if(!/(JRA|出馬表|コース：|コース:)/.test(t))return null;const r=parseHeaderJRA(t);const hs=[];let seq=0;
for(const table of payloadTables(p)){const texts=table.map(row=>row.map(cellText));const flat=texts.flat().join(' ');if(!/馬名|調教師名/.test(flat)||!/前走/.test(flat))continue;
for(let ri=0;ri<table.length;ri++){const rawCells=table[ri],cells=rawCells.map(cellText);if(cells.some(x=>/馬番/.test(x)&&/馬名/.test(cells.join(' '))))continue;
let hi=cells.findIndex(c=>/(?:美浦|栗東)[）)]/.test(c)&&!/20\d{2}年/.test(c)&&!/^父[：:]/.test(c));
if(hi<0)hi=cells.findIndex(c=>/父[：:]|母[：:]/.test(c)&&!/^20\d{2}年/.test(c));
if(hi<0)continue;
let hc=cells[hi].replace(/\s+Image:.*$/,'').trim();let first=hc.split(/\s+/)[0]||'';first=first.replace(/^Image:/,'').trim();
if(!first||/^(馬名|調教師名|父|母|ブリンカー)/.test(first))continue;
let ji=cells.findIndex((c,i)=>i!==hi&&/(?:牡|牝|せん|セン|騸)\s*\d/.test(c)&&/\d{2}(?:\.\d)?\s*kg/.test(c));if(ji<0)ji=hi+1<cells.length?hi+1:-1;
const jc=ji>=0?cells[ji]:'';const wm=jc.match(/(\d{2}(?:\.\d)?)\s*kg/);let jockey='';if(wm){const after=jc.slice((wm.index||0)+wm[0].length);jockey=cleanJockey(after)}
seq++;let number=horseNoFromCells(rawCells,Math.max(hi,2));if(!number||hs.some(x=>x.number===number))number=seq;
const recent=[];for(const c of cells){const past=parseJraPast(c);if(past)recent.push(past)}
hs.push({number,name:first,jockey,weight:wm?Number(wm[1]):null,odds:null,recent:recent.slice(0,4),records:{}})}}
if(!hs.length){const lines=t.split('\n').map(norm).filter(Boolean);for(let i=0;i<lines.length;i++){const line=lines[i];const hm=line.match(/^([ァ-ヶー々〆ヵヶ一-龠A-Za-z0-9・'’.-]+)\s+.+[（(](?:美浦|栗東)[）)]/);if(!hm)continue;const name=hm[1];let jockey='',weight=null;for(let j=i+1;j<Math.min(lines.length,i+8);j++){const jm=lines[j].match(/(?:牡|牝|せん|セン|騸)\s*\d[^\n]*?(\d{2}(?:\.\d)?)\s*kg\s*(.+)$/);if(jm){weight=Number(jm[1]);jockey=cleanJockey(jm[2]);break}}hs.push({number:hs.length+1,name,jockey,weight,odds:null,recent:[],records:{}})}}
r.horses=uniq(hs);mergeOdds(r,p);return r.horses.length?r:null}
function parseHeaderNAR(t){
t=narNormText(t);
const h=t.match(/(\d{4}年\d{1,2}月\d{1,2}日)[^\n]*?([ぁ-んァ-ヶー一-龠々\s]{1,16})\s*第?\s*(\d{1,2})競走/);
const rn=h?h[3]:(t.match(/第?\s*(\d{1,2})競走/)||[])[1];
const start=(t.match(/(\d{1,2}:\d{2})発走/)||[])[1]||'';
const c=t.match(/(ダート|芝)\s*([\d,]+)ｍ（([^）]+)）/);
const lines=t.split('\n').map(norm).filter(Boolean);
let name='';
const hi=lines.findIndex(x=>/第\s*\d+\s*競走/.test(fwDigits(x))||/\d+Ｒ\s*出\s*馬\s*表/.test(fwDigits(x)));
let stop=lines.findIndex((x,i)=>i>hi&&/(?:サラブレッド系|電話投票コード|賞金)/.test(x));
if(stop<0)stop=Math.min(lines.length,hi+10);
const cand=[];
for(let i=Math.max(0,hi+1);i<stop;i++){
  const x=lines[i].replace(/^#{1,4}\s*/,'');
  if(!x||/^(?:出馬表|枠|番|馬|父|母|調教師|騎手)/.test(x)||/(?:ダート|芝)\s*\d+ｍ|発走/.test(x))continue;
  if(x.length<=70)cand.push(x);
}
if(cand.length)name=cand[cand.length-1];
if(!name){
  const ci=lines.findIndex(x=>/(?:サラブレッド系|電話投票コード|賞金)/.test(x));
  if(ci>0){
    for(let i=ci-1;i>=0&&i>=ci-5;i--){
      const x=lines[i].replace(/^#{1,4}\s*/,'');
      if(x&&!/(?:ダート|芝)\s*\d+ｍ|発走|第\s*\d+\s*競走/.test(fwDigits(x))){name=x;break}
    }
  }
}
const course=h?norm(h[2]).replace(/\s/g,'').replace(/第$/,''):'地方';
return {source:'NAR',type:'local',date:h?iso(h[1]):'',courseName:course,raceNo:rn?Number(rn):null,name,start,distance:c?Number(c[2].replace(',','')):null,surface:c?(c[1]==='ダート'?'ダ':'芝'):'',direction:c?c[3]:'',going:(t.match(/(?:馬場[：:]?\s*)?(良|稍重|重|不良)/)||[])[1]||''}
}
function rec4(block,label){const m=narNormText(block).match(new RegExp(label+'\\s*([0-9]+)\\s*-\\s*([0-9]+)\\s*-\\s*([0-9]+)\\s*-\\s*([0-9]+)'));return m?m.slice(1).map(Number):null}
function inferNarDate(mm,dd,raceDate){
  const now=new Date(),baseYear=Number(String(raceDate||'').slice(0,4))||now.getFullYear(),raceMonth=Number(String(raceDate||'').slice(5,7))||now.getMonth()+1;
  let y=baseYear;if(Number(mm)>raceMonth+1)y--;
  return `${y}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`
}
function parseNarPasts(block,raceDate=''){
  const lines=narNormText(block).split('\n').map(norm).filter(Boolean),a=[];
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(/^([^\d\s]{1,10})(\d{2})\.(\d{2})\s+(良|稍重|重|不良)\s*(?:ナ\s*)?(?:(芝)\s*)?(右|左|直)\s*(\d{3,4})\b/);
    if(!m)continue;
    let finish=null,field=null,pop=null,jockey='',margin=null;
    for(let j=i+1;j<Math.min(lines.length,i+5);j++){
      const f=lines[j].match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2})人\s+([^\s]+)\s+(?:★|▲|△|☆|◇)?\s*\d{2}(?:\.\d)?/);
      if(f){finish=Number(f[1]);field=Number(f[2]);pop=Number(f[3]);jockey=cleanJockey(f[4]);break}
      if(/^(?:出走取消|競走除外|競走中止|取消|除外|中止)/.test(lines[j]))break;
    }
    for(let j=i+1;j<Math.min(lines.length,i+7);j++){
      const mg=lines[j].match(/[（(]([0-9]+(?:\.[0-9]+)?)[）)]/);
      if(mg){margin=Number(mg[1]);break}
    }
    if(finish!=null)a.push({date:inferNarDate(m[2],m[3],raceDate),course:m[1].replace(/^Ｊ/,''),finish,field,pop,jockey,distance:Number(m[7]),surface:m[5]?'芝':'ダ',going:m[4],margin})
  }
  return a.slice(0,5)
}
function narHorseRow(c){if(c.length>=4&&/^\d{1,2}$/.test(fwDigits(c[0]))&&/^\d{1,2}$/.test(fwDigits(c[1])))return {number:Number(fwDigits(c[1])),horseIdx:2,jockeyIdx:3};if(c.length>=3&&/^\d{1,2}$/.test(fwDigits(c[0]))&&!/^\d{1,2}$/.test(fwDigits(c[1])))return {number:Number(fwDigits(c[0])),horseIdx:1,jockeyIdx:2};return null}
function narName(s){s=norm(s);const m=s.match(/^(.+?)(?:\s+(?:牡|牝|セン|せん|騸)\s*\d|$)/);return norm(m?m[1]:s).split('\n')[0]}
function narJockey(s){s=norm(s);return norm((s.split(/\n/)[0]||s).replace(/[（(].*$/,'').replace(/^\s*[★▲△☆◇]/,''))}
function parseNarPastCell(s){s=norm(narNormText(String(s||'')).replace(/\n+/g,' '));const m=s.match(/(?:^|\s)(\d{1,2})\s+(\d{2})\.(\d{2})\.(\d{2})\s*(良|稍重|重|不良)\s*(\d{1,2})頭\s*([^\s]+)\s*(?:ナ)?\s*(右|左|直)\s*(\d{3,4})/);if(!m)return null;const tail=s.slice((m.index||0)+m[0].length);const pj=tail.match(/(\d{1,2})人\s+\d+\s+([ぁ-んァ-ヶー一-龠々・A-Za-z.]+)\s*(?:★|▲|△|☆|◇)?\s*\d{2}(?:\.\d)?/);const mg=tail.match(/[（(]([0-9]+(?:\.[0-9]+)?)[）)]/);return {date:`20${m[2]}-${m[3]}-${m[4]}`,course:m[7].replace(/^Ｊ/,''),finish:Number(m[1]),field:Number(m[6]),pop:pj?Number(pj[1]):null,jockey:pj?pj[2]:'',distance:Number(m[9]),surface:null,going:m[5],margin:mg?Number(mg[1]):null}}
function mergeHorse(base,extra){if(!base)return extra;if(!extra)return base;return {...base,name:base.name||extra.name,jockey:base.jockey||extra.jockey,weight:base.weight??extra.weight,odds:base.odds??extra.odds,recent:(base.recent&&base.recent.length)?base.recent:(extra.recent||[]),records:Object.keys(base.records||{}).length?base.records:(extra.records||{})}}
function parseNarTextHorses(t,raceDate=''){
  t=narNormText(t);const map=new Map();
  const re=/(?:^|\n)\s*(\d{1,2})[\t ]+(\d{1,2})[\t ]+([^\n]*?)\s+(牡|牝|セン|せん|騸)\s*(\d{1,2})\s*(?=\n|$)/g;
  const matches=[...t.matchAll(re)];
  for(let i=0;i<matches.length;i++){
    const m=matches[i],start=m.index+(m[0].startsWith('\n')?1:0),end=i+1<matches.length?matches[i+1].index:t.length,block=t.slice(start,end),lines=block.split('\n').map(norm).filter(Boolean);
    let name='';
    for(let j=1;j<Math.min(lines.length,6);j++){
      const x=lines[j];
      if(!x||/^母\b|^\（|^\(|^調教師$/.test(x))continue;
      if(/^[ぁ-んァ-ヶー一-龠々・A-Za-z0-9'’.-]{2,40}$/.test(x)){name=x;break}
    }
    if(!name)continue;
    let jockey='',weight=null;
    for(let j=0;j<lines.length-1;j++){
      const wm=lines[j].match(/^[（(][^）)]+[）)]\s*(?:★|▲|△|☆|◇)?\s*(\d{2}(?:\.\d)?)\s*$/);
      if(wm){
        const nxt=lines[j+1];
        if(nxt&&!/^[（(]|^(?:全|左|右|場|距)\s/.test(nxt)){weight=Number(wm[1]);jockey=narJockey(nxt);break}
      }
    }
    const h={number:Number(m[2]),name,jockey,weight,odds:null,recent:parseNarPasts(block,raceDate),records:{all:rec4(block,'全'),venue:rec4(block,'場'),distance:rec4(block,'距')}};
    map.set(h.number,mergeHorse(map.get(h.number),h))
  }
  return map
}
function parseNAR(p){
  const t=narNormText(p.narDetailText||p.text||'');
  if(!((p.url||'').includes('keiba.go.jp')||/地方競馬情報サイト/.test(t)||/第\s*\d{1,2}競走/.test(t)||/\d+Ｒ\s*出\s*馬\s*表/.test(t)))return null;
  const r=parseHeaderNAR(t),map=parseNarTextHorses(t,r.date);
  for(const table of narPayloadTables(p)){
    const rows=table.map(row=>row.map(cellText)),flat=rows.flat().join(' ');
    if(!/馬番/.test(flat)||!/競走馬|馬名|馬\s*名/.test(flat))continue;
    for(const c of rows){
      const shp=narHorseRow(c);if(!shp||shp.number<1||shp.number>20)continue;
      const horseCell=c[shp.horseIdx]||'',jockeyCell=c[shp.jockeyIdx]||'',name=narName(horseCell);
      if(!name||/馬名|競走馬/.test(name)||/^\d+$/.test(name))continue;
      const jm=jockeyCell.match(/[（(]\s*[★▲△☆◇]?\s*(\d{2}(?:\.\d)?)[）)]/);
      const recent=c.map(parseNarPastCell).filter(Boolean).slice(0,5);
      let odds=null;for(const z of c.slice(shp.jockeyIdx+1)){const om=z.match(/^\s*(\d{1,3}(?:\.\d+)?)\s*(?:\n|\s|\()/);if(om&&Number(om[1])>=1){odds=Number(om[1]);break}}
      const recCell=c.find(x=>/全\s*\d+\s*-/.test(x))||'';
      const h={number:shp.number,name,jockey:narJockey(jockeyCell),weight:jm?Number(jm[1]):null,odds,recent,records:{all:rec4(recCell,'全'),venue:rec4(recCell,'場'),distance:rec4(recCell,'距')}};
      map.set(h.number,mergeHorse(map.get(h.number),h))
    }
  }
  r.horses=uniq([...map.values()]);mergeOdds(r,p);return r.horses.length?r:null
}
function parseOddsTables(tables){const out={};for(const table of tables||[]){for(const row of table){const c=row.map(norm);for(let i=0;i<c.length-2;i++){if(/^\d{1,2}$/.test(c[i])&&c[i+1]&&!/馬名|枠/.test(c[i+1])){const o=Number(c[i+2]);if(o>=1&&o<=999.9)out[Number(c[i])]=o}}}}return out}
function parseOddsText(t){const out={};for(const line of String(t||'').split('\n')){const m=norm(line).match(/^(\d{1,2})\s*[|\t ]+([^|\t]+?)[|\t ]+(\d{1,3}(?:\.\d+)?)\b/);if(m){const o=Number(m[3]);if(o>=1)out[Number(m[1])]=o}}return out}
function comboKey(nums){return nums.map(Number).sort((a,b)=>a-b).join('-')}
function parseComboOddsTables(tables,size=2,wide=false){const out={};for(const table of tables||[]){for(const row of table){const c=row.map(norm);for(let i=0;i<c.length;i++){const m=c[i].replace(/[－−–—]/g,'-').match(new RegExp('^(\\d{1,2})\\s*-\\s*(\\d{1,2})'+(size===3?'\\s*-\\s*(\\d{1,2})':'')+'$'));if(!m)continue;const nums=m.slice(1).filter(Boolean).map(Number);if(new Set(nums).size!==size)continue;let val=null;for(let j=i+1;j<c.length;j++){const z=c[j].match(/(\d+(?:\.\d+)?)(?:\s*[-~～]\s*(\d+(?:\.\d+)?))?/);if(z){val=Number(z[1]);break}}if(val&&val>=1)out[comboKey(nums)]=val}}}return out}
function parseComboOddsText(t,size=2){const out={};const re=size===3?/(?:^|\n)\s*(\d{1,2})\s*[-－]\s*(\d{1,2})\s*[-－]\s*(\d{1,2})\s*[|\t ]+\s*(\d+(?:\.\d+)?)/g:/(?:^|\n)\s*(\d{1,2})\s*[-－]\s*(\d{1,2})\s*[|\t ]+\s*(\d+(?:\.\d+)?)/g;let m;while((m=re.exec(String(t||'')))){const nums=size===3?[m[1],m[2],m[3]]:[m[1],m[2]];const v=Number(m[size+1]);if(v>=1)out[comboKey(nums)]=v}return out}
function mergeComboOdds(r,p){const b=p.betOdds||{};r.comboOdds={
  quinella:{...parseComboOddsText(b.quinellaText,2),...parseComboOddsTables(b.quinellaTables,2,false)},
  wide:{...parseComboOddsText(b.wideText,2),...parseComboOddsTables(b.wideTables,2,true)},
  trio:{...parseComboOddsText(b.trioText,3),...parseComboOddsTables(b.trioTables,3,false)}
}}
function mergeOdds(r,p){const a={...parseOddsText(p.oddsText),...parseOddsTables(p.oddsTables)};for(const h of r.horses)if(a[h.number]!=null)h.odds=a[h.number];mergeComboOdds(r,p)}
function finishScore(x){if(!x||!x.finish)return 5;if(x.field&&x.field>1)return clamp(10-9*(x.finish-1)/(x.field-1),1,10);return clamp(10-(x.finish-1)*.85,1,10)}
function weighted(vals){let s=0,w=0;vals.forEach((v,i)=>{if(v==null)return;const ww=Math.pow(.82,i);s+=v*ww;w+=ww});return w?s/w:null}
function recordScore(rec){if(!rec)return null;const [w,p3,p2,o]=rec;const n=w+p3+p2+o;if(!n)return null;return clamp(3+7*(w+.55*p3+.3*p2)/n,1,10)}
function autoFactors(h,r){const recent=(h.recent||[]).slice(0,20), fs=recent.map(finishScore);const form=weighted(fs)??5;const speedVals=recent.map((x,i)=>{let v=finishScore(x);if(x.margin!=null)v+=clamp(1.2-x.margin*.45,-1.5,1.2);return clamp(v,1,10)});const speed=weighted(speedVals)??form;
const distVals=recent.map(x=>{if(!x.distance||!r.distance)return null;const match=clamp(10-Math.abs(x.distance-r.distance)/120,1,10);return .55*match+.45*finishScore(x)});let distance=weighted(distVals);const dr=recordScore(h.records?.distance);if(dr!=null)distance=distance==null?dr:.55*distance+.45*dr;if(distance==null)distance=5;
const trackVals=recent.map(x=>{let evidence=5;if(x.surface&&r.surface)evidence+=(x.surface===r.surface?2:-2);if(x.going&&r.going)evidence+=(x.going===r.going?1:0);if(x.course&&r.courseName)evidence+=(x.course.replace(/ナ$/,'')===r.courseName?.replace(/競馬場$/,'')?.replace(/\s/g,'')?.slice(0,x.course.length)?1:0);return clamp(.6*evidence+.4*finishScore(x),1,10)});let track=weighted(trackVals)??5;const vr=recordScore(h.records?.venue);if(vr!=null)track=.6*track+.4*vr;
const same=recent.filter(x=>h.jockey&&x.jockey&&x.jockey.replace(/\s/g,'').includes(h.jockey.replace(/\s/g,''))||h.jockey&&x.jockey&&h.jockey.replace(/\s/g,'').includes(x.jockey.replace(/\s/g,'')));const jockey=same.length?weighted(same.map(finishScore)):5;
const evidence=recent.length;const confidence=clamp((Math.min(evidence,10)/10)*.75 + (dr!=null?0.1:0)+(vr!=null?0.1:0)+(same.length?0.05:0),.18,1);return {speed:clamp(speed,1,10),form:clamp(form,1,10),distance:clamp(distance,1,10),track:clamp(track,1,10),jockey:clamp(jockey,1,10),confidence,evidence}}
function rank(r,overrides={}){const W={speed:.28,form:.26,distance:.18,track:.14,jockey:.14};let rows=r.horses.map(h=>{const auto=autoFactors(h,r),v={...auto,...(overrides[h.number]||{})};const rating=Object.entries(W).reduce((s,[k,w])=>s+Number(v[k])*w,0);return {h,auto,v,rating,odds:h.odds||null}});const temp=1.35,ex=rows.map(x=>Math.exp(x.rating/temp)),sum=ex.reduce((a,b)=>a+b,0),avgConf=rows.reduce((s,x)=>s+x.auto.confidence,0)/Math.max(1,rows.length),alpha=.35+.45*avgConf;rows=rows.map((x,i)=>{const raw=ex[i]/sum,p=alpha*raw+(1-alpha)/rows.length;return {...x,prob:p,ev:x.odds?p*x.odds:null}});return rows.sort((a,b)=>b.rating-a.rating)}
function orderProb(order,by){let rem=1,p=1;for(const no of order){const q=by[no]||0;if(q<=0||rem<=0)return 0;p*=q/rem;rem-=q}return p}
function perms(a){if(a.length<=1)return [a.slice()];const out=[];a.forEach((x,i)=>{for(const tail of perms(a.slice(0,i).concat(a.slice(i+1))))out.push([x,...tail])});return out}
function quinellaProb(a,b,by){return clamp(orderProb([a,b],by)+orderProb([b,a],by),0,1)}
function trioProb(a,b,c,by){return clamp(perms([a,b,c]).reduce((s,o)=>s+orderProb(o,by),0),0,1)}
function wideProb(a,b,by){let s=0;for(const k of Object.keys(by).map(Number))if(k!==a&&k!==b)s+=trioProb(a,b,k,by);return clamp(s,0,1)}
function combinationAdvice(rows,comboOdds={},threshold=1.10){const by={};rows.forEach(x=>by[x.h.number]=x.prob);const nos=rows.map(x=>x.h.number);const q=[],w=[],t=[];
for(let i=0;i<nos.length;i++)for(let j=i+1;j<nos.length;j++){const a=nos[i],b=nos[j],key=comboKey([a,b]);const qp=quinellaProb(a,b,by),wp=wideProb(a,b,by),qo=comboOdds.quinella?.[key]??null,wo=comboOdds.wide?.[key]??null;q.push({type:'馬連',key,numbers:[a,b],prob:qp,odds:qo,ev:qo?qp*qo:null,need:threshold/Math.max(qp,1e-9)});w.push({type:'ワイド',key,numbers:[a,b],prob:wp,odds:wo,ev:wo?wp*wo:null,need:threshold/Math.max(wp,1e-9)})}
for(let i=0;i<nos.length;i++)for(let j=i+1;j<nos.length;j++)for(let k=j+1;k<nos.length;k++){const a=nos[i],b=nos[j],c=nos[k],key=comboKey([a,b,c]),p=trioProb(a,b,c,by),o=comboOdds.trio?.[key]??null;t.push({type:'三連複',key,numbers:[a,b,c],prob:p,odds:o,ev:o?p*o:null,need:threshold/Math.max(p,1e-9)})}
const sort=x=>x.sort((a,b)=>(b.ev??-1)-(a.ev??-1)||b.prob-a.prob);return {quinella:sort(q),wide:sort(w),trio:sort(t),threshold}}
function ticketNumbers(t){if(Array.isArray(t?.numbers)&&t.numbers.length)return t.numbers.map(Number).filter(Number.isFinite);return String(t?.key??'').split(/[-－−–—]/).map(Number).filter(Number.isFinite)}
function historyResult(x){const r=x?.result||{};return {first:Number(r.first??x?.winner)||null,second:Number(r.second)||null,third:Number(r.third)||null}}
function historyTickets(x){const out=[];for(const t of x?.tickets||[])if(t?.type&&t?.key!=null)out.push({...t,numbers:ticketNumbers(t)});if(x?.pick!=null&&!out.some(t=>t.type==='単勝'))out.unshift({type:'単勝',key:String(x.pick),numbers:[Number(x.pick)],ev:x.ev??null});const seen=new Set();return out.filter(t=>{const k=t.type+'|'+t.key;if(seen.has(k))return false;seen.add(k);return true})}
function ticketGrade(t,result){const nums=ticketNumbers(t),r=result||{};const first=Number(r.first)||null,second=Number(r.second)||null,third=Number(r.third)||null;if(t.type==='単勝'){if(!first||nums.length<1)return null;return nums[0]===first}if(t.type==='馬連'){if(!first||!second||nums.length<2)return null;const a=nums.slice(0,2).sort((x,y)=>x-y),b=[first,second].sort((x,y)=>x-y);return a[0]===b[0]&&a[1]===b[1]}if(t.type==='ワイド'){if(!first||!second||!third||nums.length<2)return null;const top=new Set([first,second,third]);return top.has(nums[0])&&top.has(nums[1])}if(t.type==='三連複'){if(!first||!second||!third||nums.length<3)return null;const a=nums.slice(0,3).sort((x,y)=>x-y),b=[first,second,third].sort((x,y)=>x-y);return a.every((v,i)=>v===b[i])}return null}
function typeAccuracy(history,type){let hits=0,total=0,raceHits=0,raceTotal=0;for(const x of history||[]){const result=historyResult(x),ts=historyTickets(x).filter(t=>t.type===type);if(!ts.length)continue;let graded=0,hitAny=false;for(const t of ts){const g=ticketGrade(t,result);if(g==null)continue;graded++;total++;if(g){hits++;hitAny=true}}if(graded){raceTotal++;if(hitAny)raceHits++}}return {type,hits,total,rate:total?hits/total:null,raceHits,raceTotal,raceRate:raceTotal?raceHits/raceTotal:null}}
function allTypeAccuracy(history){return ['単勝','馬連','ワイド','三連複'].map(type=>typeAccuracy(history,type))}
function normalizeStoredTicket(t){if(!t)return null;if(t.type)return {...t,numbers:ticketNumbers(t)};if(t.t)return {type:t.t,key:String(t.k??''),numbers:Array.isArray(t.n)?t.n.map(Number):ticketNumbers({key:t.k}),ev:t.e==null?null:Number(t.e),prob:t.p==null?null:Number(t.p),odds:t.o==null?null:Number(t.o)};return null}
function backtestTickets(x){const a=(x?.backtestTickets||[]).map(normalizeStoredTicket).filter(Boolean);return a.length?a:historyTickets(x)}
function distanceBand(v){v=Number(v)||0;if(!v)return '不明';if(v<=1200)return '～1200m';if(v<=1600)return '1300～1600m';if(v<=2000)return '1700～2000m';if(v<=2400)return '2100～2400m';return '2500m～'}
function evBand(v){v=Number(v);if(!Number.isFinite(v))return 'EV不明';if(v<1)return '～0.99';if(v<1.1)return '1.00～1.09';if(v<1.2)return '1.10～1.19';if(v<1.3)return '1.20～1.29';return '1.30～'}
function raceMeta(x){return {market:x?.market||x?.type||'unknown',course:x?.course||'',surface:x?.surface||'',distance:Number(x?.distance)||0,distanceBand:distanceBand(x?.distance),going:x?.going||''}}
function filtersMatch(x,t,f={}){const m=raceMeta(x);if(f.type&&f.type!=='all'&&t.type!==f.type)return false;if(f.market&&f.market!=='all'&&m.market!==f.market)return false;if(f.surface&&f.surface!=='all'&&m.surface!==f.surface)return false;if(f.distanceBand&&f.distanceBand!=='all'&&m.distanceBand!==f.distanceBand)return false;if(f.going&&f.going!=='all'&&m.going!==f.going)return false;if(f.course&&f.course!=='all'&&m.course!==f.course)return false;if(f.evBand&&f.evBand!=='all'&&evBand(t.ev)!==f.evBand)return false;if(f.minEv!=null&&(t.ev==null||Number(t.ev)<Number(f.minEv)))return false;return true}
function backtestRows(history,filters={}){const out=[];for(const x of history||[]){const result=historyResult(x);for(const t0 of backtestTickets(x)){const t=normalizeStoredTicket(t0);if(!t||!filtersMatch(x,t,filters))continue;const grade=ticketGrade(t,result);if(grade==null)continue;const odds=Number(t.odds),roiEligible=Number.isFinite(odds)&&odds>=1;out.push({entry:x,ticket:t,hit:!!grade,odds:roiEligible?odds:null,stake:roiEligible?100:0,payout:roiEligible&&grade?100*odds:0,meta:raceMeta(x),evBand:evBand(t.ev)})}}return out}
function summarizeBacktest(history,filters={}){const rows=backtestRows(history,filters),withOdds=rows.filter(x=>x.stake>0),hits=rows.filter(x=>x.hit).length,stake=withOdds.reduce((s,x)=>s+x.stake,0),payout=withOdds.reduce((s,x)=>s+x.payout,0);return {rows,total:rows.length,hits,rate:rows.length?hits/rows.length:null,withOdds:withOdds.length,stake,payout,roi:stake?payout/stake:null}}
function groupBacktest(history,dimension,filters={}){const rows=backtestRows(history,filters),map=new Map();for(const r of rows){let key='';if(dimension==='type')key=r.ticket.type;else if(dimension==='market')key=r.meta.market==='central'?'中央':'地方';else if(dimension==='course')key=r.meta.course||'不明';else if(dimension==='surface')key=r.meta.surface||'不明';else if(dimension==='distanceBand')key=r.meta.distanceBand;else if(dimension==='going')key=r.meta.going||'不明';else if(dimension==='evBand')key=r.evBand;else key='全体';const z=map.get(key)||{key,total:0,hits:0,withOdds:0,stake:0,payout:0};z.total++;if(r.hit)z.hits++;if(r.stake){z.withOdds++;z.stake+=r.stake;z.payout+=r.payout}map.set(key,z)}return [...map.values()].map(z=>({...z,rate:z.total?z.hits/z.total:null,roi:z.stake?z.payout/z.stake:null})).sort((a,b)=>(b.roi??-1)-(a.roi??-1)||b.total-a.total)}
function walkForward(history,filters={}){const entries=(history||[]).filter(x=>historyResult(x).first!=null&&backtestTickets(x).some(t=>normalizeStoredTicket(t)?.odds!=null&&normalizeStoredTicket(t)?.ev!=null)).slice().sort((a,b)=>String(a.date||a.createdAt||a.id).localeCompare(String(b.date||b.createdAt||b.id)));if(entries.length<6)return {enough:false,races:entries.length};const cut=Math.max(3,Math.floor(entries.length*.7)),train=entries.slice(0,cut),test=entries.slice(cut),thresholds=[1.0,1.1,1.2,1.3],minTickets=Math.max(5,Math.floor(train.length*.6));const candidates=thresholds.map(th=>({threshold:th,...summarizeBacktest(train,{...filters,minEv:th})})).filter(x=>x.withOdds>=minTickets&&x.roi!=null);if(!candidates.length)return {enough:false,races:entries.length,reason:'tickets'};candidates.sort((a,b)=>b.roi-a.roi||b.threshold-a.threshold);const best=candidates[0],validation=summarizeBacktest(test,{...filters,minEv:best.threshold});return {enough:true,races:entries.length,trainRaces:train.length,testRaces:test.length,threshold:best.threshold,train:best,validation}}
function parse(raw){const p=parsePayload(raw);return parseNAR(p)||parseJRA(p)}
const api={parsePayload,parse,parseJRA,parseNAR,parseJraPast,autoFactors,rank,parseOddsText,parseOddsTables,parseNarPastCell,parseComboOddsText,parseComboOddsTables,quinellaProb,wideProb,trioProb,combinationAdvice,ticketNumbers,historyResult,historyTickets,ticketGrade,typeAccuracy,allTypeAccuracy,normalizeStoredTicket,backtestTickets,distanceBand,evBand,raceMeta,backtestRows,summarizeBacktest,groupBacktest,walkForward};if(typeof module!=='undefined'&&module.exports)module.exports=api;g.UmaCore=api})(typeof globalThis!=='undefined'?globalThis:this);