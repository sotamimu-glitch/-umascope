(function(g){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const norm=s=>String(s??'').replace(/\r/g,'').replace(/\u3000/g,' ').replace(/[ \t]+/g,' ').trim();
const num=s=>{const m=String(s??'').match(/\d+(?:\.\d+)?/);return m?Number(m[0]):null};
const iso=s=>{const m=String(s).match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);return m?`${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`:''};
function uniq(a){const m=new Map();for(const h of a)if(h.number>0&&h.name&&!m.has(h.number))m.set(h.number,h);return [...m.values()].sort((a,b)=>a.number-b.number)}
function parsePayload(raw){try{const x=JSON.parse(raw);if(x&&x.umascope)return x}catch{}return {umascope:1,url:'',title:'',text:String(raw||''),tables:[],oddsText:'',oddsTables:[]}}
const JRA_COURSES={'01':'札幌','02':'函館','03':'福島','04':'新潟','05':'東京','06':'中山','07':'中京','08':'京都','09':'阪神','10':'小倉'};
function jraUrlMeta(url){
  let u='';try{u=decodeURIComponent(String(url||''))}catch{u=String(url||'')}
  const m=u.match(/pw01dde\d{2}(\d{2})(20\d{2})(\d{2})(\d{2})(\d{2})(20\d{6})/i);
  if(!m)return {};
  const y=m[2],d=m[6];
  return {courseCode:m[1],courseName:JRA_COURSES[m[1]]||'',date:`${y}-${d.slice(4,6)}-${d.slice(6,8)}`,meeting:Number(m[3]),day:Number(m[4]),raceNo:Number(m[5])}
}
function parseHeaderJRA(t,p={}){
  t=jraNormText(t);
  const all=[t,p?.title||'',p?.jraText||'',p?.text||''].map(jraNormText).filter(Boolean).join('\n');
  const h=all.match(/(\d{4}年\d{1,2}月\d{1,2}日)[^\n]*?(\d+)回\s*([^\d\s]+?)\s*(\d+)日[^\n]*?(?:Image:\s*)?(\d{1,2})(?:レース|R)/);
  const simple=all.match(/(\d{4}年\d{1,2}月\d{1,2}日)[^\n]*?([札幌函館福島新潟東京中山中京京都阪神小倉]{2})[^\n]*?(\d{1,2})(?:レース|R)/);
  const urlm=jraUrlMeta(p?.url||'');
  const tm=all.match(/発走時刻[：:]\s*(\d{1,2})時(\d{2})分/);
  const c=all.match(/コース[：:]\s*([\d,]+)メートル（(芝|ダート)(?:・([^）]+))?/);
  let name='';
  const hm=all.match(/(?:^|\n)#{1,3}\s*([^\n]+)/);
  if(hm)name=norm(hm[1]).replace(/^Image\s*/,'');
  if(!name){
    const lines=all.split('\n').map(norm).filter(Boolean),i=lines.findIndex(x=>/コース[：:]/.test(x));
    if(i>0)name=lines[i-1].replace(/^#+\s*/,'')
  }
  const courseName=(h&&h[3])||(simple&&simple[2])||urlm.courseName||'JRA';
  const raceNo=(h&&Number(h[5]))||(simple&&Number(simple[3]))||urlm.raceNo||null;
  const date=(h&&iso(h[1]))||(simple&&iso(simple[1]))||urlm.date||'';
  return {source:'JRA',type:'central',date,courseName,raceNo,name:name||`${raceNo||''}R`,start:tm?`${String(tm[1]).padStart(2,'0')}:${tm[2]}`:'',distance:c?Number(c[1].replace(',','')):null,surface:c?(c[2]==='ダート'?'ダ':c[2]):'',direction:c?c[3]||'':'',going:(all.match(/(?:芝|ダート)[：:\s]*(良|稍重|重|不良)/)||[])[1]||''}
}
function parseJraPast(s){
s=norm(jraNormText(String(s||'')).replace(/\n+/g,' '));
const dm=s.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日\s+([^\s]+)/);if(!dm)return null;
const fm=s.match(/(\d{1,2})着/),field=s.match(/(\d{1,2})頭/),pop=s.match(/(\d{1,2})番人気/);if(!fm||!field)return null;
let jockey='',widx=-1;
const wm=s.match(/(\d{2}(?:\.\d)?)\s*kg/);if(wm){widx=wm.index||0;const pidx=pop?(pop.index||0)+pop[0].length:0;jockey=cleanJockey(s.slice(pidx,widx).replace(/^.*?(?:着|頭|番)\s*/,'').trim())}
let distance=null,surface='';
let tr=s.match(/(\d{3,4})\s*(芝|ダート|ダ)/);if(tr){distance=Number(tr[1]);surface=tr[2]==='芝'?'芝':'ダ'}else{tr=s.match(/(芝|ダート|ダ)\s*(\d{3,4})/);if(tr){surface=tr[1]==='芝'?'芝':'ダ';distance=Number(tr[2])}}
if(!distance)return null;
let going='';const tail=s.slice(tr.index+tr[0].length);const gm=tail.match(/(?:\d+[:.]\d+(?:\.\d+)?\s+)?(良|稍重|重|不良)/);if(gm)going=gm[1];
let margin=null;const ms=[...s.matchAll(/[（(]([0-9]+(?:\.[0-9]+)?)[）)]/g)];if(ms.length)margin=Number(ms[ms.length-1][1]);
const cm=s.match(/(?:^|\s)(\d{1,2}(?:[-－−]\d{1,2}){1,3})(?:\s|$)/),corners=cm?cm[1].split(/[-－−]/).map(Number):[];return {date:`${dm[1]}-${String(dm[2]).padStart(2,'0')}-${String(dm[3]).padStart(2,'0')}`,course:dm[4],finish:Number(fm[1]),field:Number(field[1]),pop:pop?Number(pop[1]):null,jockey,weight:wm?Number(wm[1]):null,distance,surface,going,margin,corners}
}
function cellText(c){return norm(typeof c==='string'?c:(c&&c.text)||'')}
function cellHtml(c){return typeof c==='object'&&c?String(c.html||''):''}
function payloadTables(p){return (p.richTables&&p.richTables.length?p.richTables:(p.tables||[]))}
function fwDigits(s){return String(s||'').replace(/[０-９]/g,d=>String('０１２３４５６７８９'.indexOf(d)))}
function narNormText(s){return fwDigits(String(s||'')).replace(/\u00a0/g,' ').replace(/\r/g,'')}
function narPayloadTables(p){const out=[];for(const k of ['narDetailRichTables','narDetailTables','richTables','tables']){for(const t of (p[k]||[]))out.push(t)}return out}
function jraNormText(s){return fwDigits(String(s||'')).replace(/\u00a0/g,' ').replace(/\r/g,'').replace(/㎏/g,'kg').replace(/ｍ/g,'m')}
function jraPayloadTables(p){const out=[];for(const k of ['jraDetailTables','jraTables','tables','richTables']){for(const t of (p[k]||[]))out.push(t)}return out}
function parseJraPastsFromText(s){s=jraNormText(s);const starts=[...s.matchAll(/20\d{2}年\d{1,2}月\d{1,2}日/g)];const out=[],seen=new Set();for(let i=0;i<starts.length;i++){const st=starts[i].index,en=i+1<starts.length?starts[i+1].index:s.length,p=parseJraPast(s.slice(st,en));if(p){const k=[p.date,p.course,p.finish,p.distance,p.jockey].join('|');if(!seen.has(k)){seen.add(k);out.push(p)}}}return out}
function parseJraHorseTextBlocks(t){
  t=jraNormText(t);const lines=t.split('\n').map(norm).filter(Boolean),marks=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(!/(?:美浦|栗東)[）)]/.test(line)||/^20\d{2}年/.test(line)||/^父[：:]/.test(line)||/^母[：:]/.test(line))continue;
    let name=(line.match(/^([ァ-ヶー々〆ヵヶ一-龠A-Za-z0-9・'’.-]{2,40})(?:\s|\d{1,3}(?:\.\d+)?\s*\(|\()/)||[])[1]||'';
    if(!name){
      const toks=line.split(/\s+/).filter(Boolean);
      name=toks.find(x=>/^[ァ-ヶー々〆ヵヶ一-龠A-Za-z0-9・'’.-]{2,40}$/.test(x)&&!/(美浦|栗東)/.test(x))||'';
    }
    if(name)marks.push({i,name})
  }
  const out=[];let seq=0;
  for(let m=0;m<marks.length;m++){
    const a=marks[m],b=m+1<marks.length?marks[m+1].i:lines.length,block=lines.slice(a.i,b).join('\n');
    let jockey='',weight=null;
    const jm=block.match(/(?:牡|牝|せん|セン|騸)\s*\d+(?:\/[^\s]+)?[\s\S]{0,40}?(\d{2}(?:\.\d)?)\s*kg\s*([▲△☆◇★]?[ぁ-んァ-ヶー一-龠々・A-Za-z. ]{2,30})/);
    if(jm){weight=Number(jm[1]);jockey=cleanJockey(jm[2].split(/\n/)[0])}
    let number=null;
    for(let j=a.i-1;j>=Math.max(0,a.i-5);j--){if(/^\d{1,2}$/.test(lines[j])){const n=Number(lines[j]);if(n>=1&&n<=18){number=n;break}}}
    seq++; if(!number)number=seq;
    out.push({number,frame:null,name:a.name,jockey,weight,odds:null,recent:parseJraPastsFromText(block).slice(0,4),records:{}})
  }
  return out
}

function horseNoFromCells(rawCells,limit){const found=[];for(let i=0;i<Math.min(limit,rawCells.length);i++){const t=cellText(rawCells[i]);if(/^\d{1,2}$/.test(t)){const n=Number(t);if(n>=1&&n<=18)found.push(n)}const h=cellHtml(rawCells[i]);const ms=[...h.matchAll(/(?:umaban|horse[-_ ]?no|number|num)[^0-9]{0,30}(\d{1,2})/gi)];for(const m of ms){const n=Number(m[1]);if(n>=1&&n<=18)found.push(n)}}return found.length?found[found.length-1]:null}
function frameNoFromCells(rawCells,limit){
  const nums=[];
  for(let i=0;i<Math.min(limit,rawCells.length);i++){
    const t=cellText(rawCells[i]);
    const fm=t.match(/枠\s*(\d)/);if(fm)return Number(fm[1]);
    if(/^\d{1,2}$/.test(t)){const n=Number(t);if(n>=1&&n<=18)nums.push(n)}
    const h=cellHtml(rawCells[i]),hm=h.match(/枠[^0-9]{0,15}(\d)/);if(hm)return Number(hm[1]);
  }
  return nums.length>=2&&nums[0]>=1&&nums[0]<=8?nums[0]:null
}
function cleanJockey(s){return norm(String(s||'').replace(/^\s*[▲△☆◇]/,'').replace(/\s+Image:.*$/,''))}
function imgAwareCellText(c){return cellText(c)}
function parseJRA(p){
const t=jraNormText(p.jraDetailText||p.jraText||p.text||'');if(!/(JRA|出馬表|コース[：:]|前走)/.test(t))return null;
const headerText=jraNormText(p.jraText||p.text||p.title||t),r=parseHeaderJRA(headerText,p),map=new Map();let seq=0;
for(const table of jraPayloadTables(p)){
  const texts=table.map(row=>row.map(cellText)),flat=texts.flat().join(' ');
  if(!/馬名/.test(flat)||!/前走/.test(flat))continue;
  for(let ri=0;ri<table.length;ri++){
    const rawCells=table[ri],cells=rawCells.map(cellText),joined=cells.join('\n');
    if(cells.some(x=>/馬番/.test(x)&&/馬名/.test(joined)))continue;
    let hi=cells.findIndex(c=>/(?:美浦|栗東)[）)]/.test(c)&&!/^20\d{2}年/.test(c)&&!/^父[：:]/.test(c));
    if(hi<0)continue;
    let hc=cells[hi].replace(/\s+Image:.*$/,'').trim();
    let name=(hc.match(/^([ァ-ヶー々〆ヵヶ一-龠A-Za-z0-9・'’.-]{2,40})(?:\s|\d{1,3}(?:\.\d+)?\s*\(|\()/)||[])[1]||hc.split(/\s+/)[0]||'';
    name=name.replace(/^Image:/,'').trim();if(!name||/^(馬名|調教師名|父|母|ブリンカー)/.test(name))continue;
    let ji=cells.findIndex((c,i)=>i!==hi&&/(?:牡|牝|せん|セン|騸)\s*\d/.test(c)&&/\d{2}(?:\.\d)?\s*kg/.test(c));if(ji<0)ji=hi+1<cells.length?hi+1:-1;
    const jc=ji>=0?cells[ji]:'';const wm=jc.match(/(\d{2}(?:\.\d)?)\s*kg/);let jockey='';
    if(wm){const after=jc.slice((wm.index||0)+wm[0].length);jockey=cleanJockey(after)}
    seq++;let number=horseNoFromCells(rawCells,Math.max(hi,2));if(!number||map.has(number))number=seq;const frame=frameNoFromCells(rawCells,Math.max(hi,2));
    let recent=parseJraPastsFromText(joined).slice(0,4);
    let odds=null;const om=hc.match(/(\d{1,3}(?:\.\d+)?)\s*\((\d{1,2})番人気\)/);if(om)odds=Number(om[1]);
    map.set(number,{number,frame,name,jockey,weight:wm?Number(wm[1]):null,odds,recent,records:{}})
  }
}
const textHorses=parseJraHorseTextBlocks(t);
for(const h of textHorses){
  let existing=[...map.values()].find(x=>x.name.replace(/\s/g,'')===h.name.replace(/\s/g,''));
  if(existing){
    if(!existing.jockey&&h.jockey)existing.jockey=h.jockey;
    if(existing.weight==null&&h.weight!=null)existing.weight=h.weight;if(existing.frame==null&&h.frame!=null)existing.frame=h.frame;
    if((!existing.recent||!existing.recent.length)&&h.recent?.length)existing.recent=h.recent;
  }else map.set(h.number,h)
}
let hs=[...map.values()].sort((a,b)=>a.number-b.number);
// Last-resort: for horses found from table, parse body block between this name and next horse name.
for(let i=0;i<hs.length;i++){
  const h=hs[i];if(h.recent?.length)continue;
  const st=t.indexOf(h.name);if(st<0)continue;
  let en=t.length;for(let j=i+1;j<hs.length;j++){const q=t.indexOf(hs[j].name,st+h.name.length);if(q>=0){en=q;break}}
  const rec=parseJraPastsFromText(t.slice(st,en)).slice(0,4);if(rec.length)h.recent=rec
}
r.horses=uniq(hs);mergeOdds(r,p);return r.horses.length?r:null
}
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
    const m=lines[i].match(/^([^\d\s]{1,12})(\d{1,2})\.(\d{1,2})\s*(良|稍重|重|不良)\s*(?:ナ\s*)?(?:(芝)\s*)?(右|左|直)\s*(\d{3,4})\b/);
    if(!m)continue;
    let finish=null,field=null,pop=null,jockey='',weight=null,margin=null,corners=[];
    for(let j=i+1;j<Math.min(lines.length,i+7);j++){
      const f=lines[j].match(/^(\d{1,2})\/(\d{1,2})\s*(\d{1,2})人\s*([★▲△☆◇]?)([^\s]+)\s*(\d{2}(?:\.\d)?)/);
      if(f){finish=Number(f[1]);field=Number(f[2]);pop=Number(f[3]);jockey=cleanJockey((f[4]||'')+f[5]);weight=Number(f[6]);break}
      if(/^(?:出走取消|競走除外|競走中止|取消|除外|中止)/.test(lines[j]))break;
    }
    for(let j=i+1;j<Math.min(lines.length,i+9);j++){
      const mg=lines[j].match(/[（(]([0-9]+(?:\.[0-9]+)?)[）)]/);if(mg&&margin==null)margin=Number(mg[1]);
      const cm=lines[j].match(/(?:^|\s)(\d{1,2}(?:[-－−]\d{1,2}){1,3})(?:\s|$)/);
      if(cm&&!corners.length)corners=cm[1].split(/[-－−]/).map(Number).filter(Number.isFinite);
    }
    if(finish!=null)a.push({date:inferNarDate(m[2],m[3],raceDate),course:m[1].replace(/^Ｊ/,''),finish,field,pop,jockey,weight,distance:Number(m[7]),surface:m[5]?'芝':'ダ',going:m[4],margin,corners})
  }
  return a.slice(0,5)
}
function parseNarPastLegacy(s){s=norm(narNormText(String(s||'')).replace(/\n+/g,' '));const m=s.match(/(?:^|\s)(\d{1,2})\s+(\d{2})\.(\d{2})\.(\d{2})\s*(良|稍重|重|不良)\s*(\d{1,2})頭\s*([^\s]+)\s*(?:ナ)?\s*(右|左|直)\s*(\d{3,4})/);if(!m)return null;const tail=s.slice((m.index||0)+m[0].length);const pj=tail.match(/(\d{1,2})人\s+\d+\s+([ぁ-んァ-ヶー一-龠々・A-Za-z.]+)\s*(?:★|▲|△|☆|◇)?\s*(\d{2}(?:\.\d)?)/);const mg=tail.match(/[（(]([0-9]+(?:\.[0-9]+)?)[）)]/);const cm=tail.match(/(?:^|\s)(\d{1,2}(?:[-－−]\d{1,2}){1,3})(?:\s|$)/);return {date:`20${m[2]}-${m[3]}-${m[4]}`,course:m[7].replace(/^Ｊ/,''),finish:Number(m[1]),field:Number(m[6]),pop:pj?Number(pj[1]):null,jockey:pj?pj[2]:'',weight:pj?Number(pj[3]):null,distance:Number(m[9]),surface:null,going:m[5],margin:mg?Number(mg[1]):null,corners:cm?cm[1].split(/[-－−]/).map(Number):[]}}
function parseNarPastCell(s,raceDate=''){const a=parseNarPasts(String(s||''),raceDate);return a[0]||parseNarPastLegacy(s)}
function narHorseRow(c){if(c.length>=4&&/^\d{1,2}$/.test(fwDigits(c[0]))&&/^\d{1,2}$/.test(fwDigits(c[1])))return {frame:Number(fwDigits(c[0])),number:Number(fwDigits(c[1])),horseIdx:2,jockeyIdx:3};if(c.length>=3&&/^\d{1,2}$/.test(fwDigits(c[0]))&&!/^\d{1,2}$/.test(fwDigits(c[1])))return {frame:null,number:Number(fwDigits(c[0])),horseIdx:1,jockeyIdx:2};return null}
function narName(s){const lines=String(s||'').split('\n').map(norm).filter(Boolean);for(let i=0;i<lines.length;i++){if(/(?:牡|牝|セン|せん|騸)\s*\d/.test(lines[i])&&lines[i+1])return lines[i+1].replace(/^Image:\s*/,'').trim()}s=norm(s);const m=s.match(/^(.+?)(?:\s+(?:牡|牝|セン|せん|騸)\s*\d|$)/);return norm(m?m[1]:s).split('\n')[0]}
function narJockey(s){s=norm(s);return norm((s.split(/\n/)[0]||s).replace(/[（(].*$/,'').replace(/^\s*[★▲△☆◇]/,''))}
function mergeHorse(base,extra){if(!base)return extra;if(!extra)return base;return {...base,frame:base.frame??extra.frame??null,name:base.name||extra.name,jockey:base.jockey||extra.jockey,weight:base.weight??extra.weight,odds:base.odds??extra.odds,recent:(base.recent&&base.recent.length)?base.recent:(extra.recent||[]),records:Object.keys(base.records||{}).length?base.records:(extra.records||{})}}
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
    const h={number:Number(m[2]),frame:Number(m[1]),name,jockey,weight,odds:null,recent:parseNarPasts(block,raceDate),records:{all:rec4(block,'全'),venue:rec4(block,'場'),distance:rec4(block,'距')}};
    map.set(h.number,mergeHorse(map.get(h.number),h))
  }
  return map
}
function parseNAR(p){
  const t=narNormText([p.narDetailText||'',...(p.narRows||[]),p.text||''].filter(Boolean).join('\n'));
  if(!((p.url||'').includes('keiba.go.jp')||/地方競馬情報サイト/.test(t)||/第\s*\d{1,2}競走/.test(t)||/\d+Ｒ\s*出\s*馬\s*表/.test(t)))return null;
  const r=parseHeaderNAR(t),map=parseNarTextHorses(t,r.date);
  for(const table of narPayloadTables(p)){
    const rows=table.map(row=>row.map(cellText)),flat=rows.flat().join(' ');
    if(!/馬\s*番/.test(flat)||!/競走馬|馬\s*名/.test(flat))continue;
    for(const c of rows){
      const shp=narHorseRow(c);if(!shp||shp.number<1||shp.number>20)continue;
      const horseCell=c[shp.horseIdx]||'',jockeyCell=c[shp.jockeyIdx]||'',name=narName(horseCell);
      if(!name||/馬名|競走馬/.test(name)||/^\d+$/.test(name))continue;
      const jm=jockeyCell.match(/[（(]\s*[★▲△☆◇]?\s*(\d{2}(?:\.\d)?)[）)]/);
      const recent=[];for(const z of c){for(const pr of parseNarPasts(z,r.date)){const k=[pr.date,pr.course,pr.finish,pr.distance].join('|');if(!recent.some(x=>[x.date,x.course,x.finish,x.distance].join('|')===k))recent.push(pr)}const legacy=parseNarPastLegacy(z);if(legacy){const k=[legacy.date,legacy.course,legacy.finish,legacy.distance].join('|');if(!recent.some(x=>[x.date,x.course,x.finish,x.distance].join('|')===k))recent.push(legacy)}}recent.sort((a,b)=>String(b.date).localeCompare(String(a.date)));recent.splice(5);
      let odds=null;for(const z of c.slice(shp.jockeyIdx+1)){const om=z.match(/^\s*(\d{1,3}(?:\.\d+)?)\s*(?:\n|\s|\()/);if(om&&Number(om[1])>=1){odds=Number(om[1]);break}}
      const recCell=c.find(x=>/全\s*\d+\s*-/.test(x))||'';
      const h={number:shp.number,frame:shp.frame,name,jockey:narJockey(jockeyCell),weight:jm?Number(jm[1]):null,odds,recent,records:{all:rec4(recCell,'全'),venue:rec4(recCell,'場'),distance:rec4(recCell,'距')}};
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
function finishScore(x){if(!x||!x.finish)return null;if(x.field&&x.field>1)return clamp(10-9*(x.finish-1)/(x.field-1),1,10);return clamp(10-(x.finish-1)*.85,1,10)}
function weighted(vals){let s=0,w=0;vals.forEach((v,i)=>{if(v==null||!Number.isFinite(Number(v)))return;const ww=Math.pow(.82,i);s+=Number(v)*ww;w+=ww});return w?s/w:null}
function weightedCustom(items){let s=0,w=0;for(const it of items){if(it?.v==null||!Number.isFinite(Number(it.v))||!it.w)continue;s+=Number(it.v)*it.w;w+=it.w}return w?s/w:null}
function recordScore(rec){if(!rec)return null;const [w,p3,p2,o]=rec;const n=w+p3+p2+o;if(!n)return null;return clamp(3+7*(w+.55*p3+.3*p2)/n,1,10)}
function marginScoreOne(x){if(!x||x.margin==null||!Number.isFinite(Number(x.margin)))return null;const m=Math.max(0,Number(x.margin));if(Number(x.finish)===1)return clamp(8.3+Math.min(m,1.5),7.5,9.8);return clamp(8.8-m*1.65,1,9)}
function popularityScoreOne(x){if(!x?.finish||!x?.pop)return null;const field=Math.max(Number(x.field)||Math.max(x.finish,x.pop),2),out=Number(x.pop)-Number(x.finish),popStrength=10-9*(Number(x.pop)-1)/(field-1);return clamp(5+out*.62+(popStrength-5)*.12,1,10)}
function racePerformance(x){return weightedCustom([{v:finishScore(x),w:.48},{v:marginScoreOne(x),w:.32},{v:popularityScoreOne(x),w:.20}])??5}
function trendScore(recent){const vals=(recent||[]).slice(0,4).map(racePerformance).filter(Number.isFinite);if(vals.length<2)return 5;const a=vals.slice().reverse(),n=a.length,mx=(n-1)/2,my=a.reduce((s,v)=>s+v,0)/n;let num=0,den=0;for(let i=0;i<n;i++){num+=(i-mx)*(a[i]-my);den+=(i-mx)**2}return clamp(5+(den?num/den:0)*1.35,1,10)}
function goingSimilarity(a,b){if(!a||!b)return 0;const ix={良:0,稍重:1,重:2,不良:3};if(ix[a]==null||ix[b]==null)return a===b?1:0;return [1,.72,.38,.18][Math.abs(ix[a]-ix[b])]??0}
function normJockey(s){return String(s||'').replace(/\s/g,'').replace(/^[★▲△☆◇]/,'')}
function rawFeatures(h,r){
 const recent=(h.recent||[]).slice(0,20),latest=recent[0]||null;
 const margin=weighted(recent.map(marginScoreOne))??5,popularity=weighted(recent.map(popularityScoreOne))??5,field=weighted(recent.map(finishScore))??5;
 let distance=5;if(r.distance&&latest?.distance){const delta=Math.abs(Number(r.distance)-Number(latest.distance)),change=clamp(8.6-delta/115,2.2,8.6),near=weighted(recent.map(x=>x.distance&&Math.abs(Number(x.distance)-Number(r.distance))<=200?racePerformance(x):null));distance=near==null?change:.55*change+.45*near}
 const sameSurface=recent.filter(x=>x.surface&&r.surface&&x.surface===r.surface);let surface=5;if(r.surface){if(sameSurface.length)surface=weighted(sameSurface.map(racePerformance))??5;else if(latest?.surface)surface=latest.surface===r.surface?5.8:4.2}
 let going=5;if(r.going){const gv=recent.map((x,i)=>({v:racePerformance(x),w:goingSimilarity(x.going,r.going)*Math.pow(.82,i)})).filter(x=>x.w>0);going=weightedCustom(gv)??5}
 const sameJ=recent.filter(x=>h.jockey&&x.jockey&&(normJockey(x.jockey).includes(normJockey(h.jockey))||normJockey(h.jockey).includes(normJockey(x.jockey))));let jockey=5;if(sameJ.length)jockey=weighted(sameJ.map(racePerformance))??5;else if(h.jockey&&latest?.jockey&&normJockey(h.jockey)===normJockey(latest.jockey))jockey=5.6;
 let frame=5;if(h.frame){const pos=(Number(h.frame)-1)/7;if(r.surface==='ダ'||Number(r.distance)<=1400)frame=clamp(6.25-1.45*pos,4.7,6.25);else if(r.surface==='芝'&&Number(r.distance)>=1800)frame=clamp(5.7-Math.abs(pos-.5)*1.15,5.05,5.7);else frame=clamp(5.55-Math.abs(pos-.45)*.8,5,5.55)}
 let weight=5,weightDelta=null;const rw=recent.map(x=>x.weight).filter(x=>Number.isFinite(Number(x)));if(Number.isFinite(Number(h.weight))&&rw.length){const base=weighted(rw.map(Number));weightDelta=Number(h.weight)-Number(base);weight=clamp(5.4-weightDelta*.48,3.1,7.3)}
 const trend=trendScore(recent),venue=recordScore(h.records?.venue),distRecord=recordScore(h.records?.distance);
 return {recent,latest,margin,popularity,field,distance,surface,going,jockey,frame,weight,weightDelta,trend,venue,distRecord,sameJ:sameJ.length,evidence:recent.length}
}
function cornerRatio(x){const cs=(x?.corners||[]).filter(Number.isFinite);if(!cs.length)return null;const f=Math.max(Number(x.field)||Math.max(...cs),2);return clamp((cs[0]-1)/(f-1),0,1)}
function horseStyle(h){return weighted((h.recent||[]).slice(0,5).map(cornerRatio))}
function paceIndex(h,r){const styles=r.horses.map(x=>horseStyle(x)).filter(v=>v!=null),hs=horseStyle(h);if(hs==null||styles.length<Math.max(3,Math.ceil(r.horses.length*.35)))return {score:50,detail:'位置取りデータ不足のため中立'};const front=styles.filter(v=>v<=.28).length,pressure=front/Math.max(styles.length,1);let score=50;if(pressure>=.34)score=50+(hs-.35)*45;else if(pressure<=.18)score=61-hs*38;else score=57-Math.abs(hs-.42)*28;if(h.frame&&Number(r.distance)<=1400)score+=(4.5-Number(h.frame))*.6;return {score:clamp(Math.round(score),20,85),detail:pressure>=.34?'先行馬が多く速い流れ想定':pressure<=.18?'先行馬が少なく前有利想定':'平均的な流れ想定'}}
const INDEX_LABELS={ability:'能力指数',suitability:'適性指数',pace:'展開指数',jockey:'騎手指数',form:'調子指数',value:'妙味指数'};
const MODEL_WEIGHTS={ability:.36,suitability:.25,pace:.13,jockey:.11,form:.15};
function to100(v){return clamp(Math.round(Number(v||5)*10),10,100)}
function sixIndices(h,r){
 const f=rawFeatures(h,r),perf=weighted(f.recent.slice(0,6).map(racePerformance))??5;
 const ability=to100(weightedCustom([{v:perf,w:.38},{v:f.margin,w:.24},{v:f.field,w:.20},{v:f.popularity,w:.18}]));
 const suitability=to100(weightedCustom([{v:f.distance,w:.29},{v:f.surface,w:.24},{v:f.going,w:.20},{v:f.venue,w:.12},{v:f.distRecord,w:.10},{v:f.frame,w:.05}]));
 const pace=paceIndex(h,r);
 const jockey=to100(f.jockey);
 const recent2=weighted(f.recent.slice(0,2).map(racePerformance))??5;
 const form=to100(weightedCustom([{v:f.trend,w:.45},{v:recent2,w:.30},{v:f.weight,w:.15},{v:f.margin,w:.10}]));
 const details={ability:`着差・着順/頭数・人気を統合（近走${Math.min(f.evidence,6)}走）`,suitability:`距離・芝ダ・馬場・コース/枠を統合`,pace:pace.detail,jockey:f.sameJ?`今回騎手との近走 ${f.sameJ}走を評価`:(h.jockey?'同騎手データが少なく中立寄り':'騎手情報不足'),form:`近3〜4走の推移＋直近内容${f.weightDelta!=null?`・斤量${f.weightDelta>=0?'+':''}${f.weightDelta.toFixed(1)}kg`:''}`,value:'オッズ取得後に推定確率との乖離を評価'};
 const observed=[f.evidence>=2,!!(r.distance&&f.latest?.distance),!!r.surface,!!(r.going&&f.recent.some(x=>x.going)),f.sameJ>0,horseStyle(h)!=null,Number.isFinite(Number(h.weight))].filter(Boolean).length;
 const confidence=clamp(.20+.075*observed+.02*Math.min(f.evidence,8),.22,.93);
 return {ability,suitability,pace:pace.score,jockey,form,value:50,confidence,evidence:f.evidence,details,raw:f}
}
function modelScore(ix){return Math.round(Object.entries(MODEL_WEIGHTS).reduce((s,[k,w])=>s+(Number(ix?.[k])||50)*w,0))}
function overallGrade(score){const s=Number(score)||0;return s>=80?'S':s>=70?'A':s>=60?'B':s>=50?'C':'D'}
function valueIndex(ev){if(ev==null||!Number.isFinite(Number(ev)))return 50;return clamp(Math.round(50+(Number(ev)-1)*100),10,100)}
function judgement(ix){const score=modelScore(ix);return {score,grade:overallGrade(score)}}
function rank(r){
 let rows=r.horses.map(h=>{const indices=sixIndices(h,r),score=modelScore(indices),rating=score/10;return {h,auto:indices,indices,rating,score,grade:overallGrade(score),odds:h.odds||null}});
 const temp=1.55,ex=rows.map(x=>Math.exp(x.rating/temp)),sum=ex.reduce((a,b)=>a+b,0),avgConf=rows.reduce((z,x)=>z+x.auto.confidence,0)/Math.max(1,rows.length),alpha=.28+.58*avgConf;
 rows=rows.map((x,i)=>{const raw=ex[i]/sum,p=alpha*raw+(1-alpha)/rows.length,ev=x.odds?p*x.odds:null,v=valueIndex(ev);return {...x,prob:p,ev,indices:{...x.indices,value:v}}});
 return rows.sort((a,b)=>b.rating-a.rating)
}
function orderProb(order,by){let rem=1,p=1;for(const no of order){const q=by[no]||0;if(q<=0||rem<=0)return 0;p*=q/rem;rem-=q}return p}
function perms(a){if(a.length<=1)return [a.slice()];const out=[];a.forEach((x,i)=>{for(const tail of perms(a.slice(0,i).concat(a.slice(i+1))))out.push([x,...tail])});return out}
function quinellaProb(a,b,by){return clamp(orderProb([a,b],by)+orderProb([b,a],by),0,1)}
function trioProb(a,b,c,by){return clamp(perms([a,b,c]).reduce((s,o)=>s+orderProb(o,by),0),0,1)}
function wideProb(a,b,by){let s=0;for(const k of Object.keys(by).map(Number))if(k!==a&&k!==b)s+=trioProb(a,b,k,by);return clamp(s,0,1)}
function combinationAdvice(rows,comboOdds={},threshold=1.10){const by={};rows.forEach(x=>by[x.h.number]=x.prob);const nos=rows.map(x=>x.h.number);const q=[],w=[],t=[];
for(let i=0;i<nos.length;i++)for(let j=i+1;j<nos.length;j++){const a=nos[i],b=nos[j],key=comboKey([a,b]);const qp=quinellaProb(a,b,by),wp=wideProb(a,b,by),qo=comboOdds.quinella?.[key]??null,wo=comboOdds.wide?.[key]??null;q.push({type:'馬複',key,numbers:[a,b],prob:qp,odds:qo,ev:qo?qp*qo:null,need:threshold/Math.max(qp,1e-9)});w.push({type:'ワイド',key,numbers:[a,b],prob:wp,odds:wo,ev:wo?wp*wo:null,need:threshold/Math.max(wp,1e-9)})}
for(let i=0;i<nos.length;i++)for(let j=i+1;j<nos.length;j++)for(let k=j+1;k<nos.length;k++){const a=nos[i],b=nos[j],c=nos[k],key=comboKey([a,b,c]),p=trioProb(a,b,c,by),o=comboOdds.trio?.[key]??null;t.push({type:'三連複',key,numbers:[a,b,c],prob:p,odds:o,ev:o?p*o:null,need:threshold/Math.max(p,1e-9)})}
const sort=x=>x.sort((a,b)=>(b.ev??-1)-(a.ev??-1)||b.prob-a.prob);return {quinella:sort(q),wide:sort(w),trio:sort(t),threshold}}
function ticketHitOrder(t,o){const n=t.numbers||[];if(t.type==='単勝')return o[0]===n[0];if(t.type==='馬複'||t.type==='馬連'){const a=[o[0],o[1]].sort((x,y)=>x-y),b=n.slice(0,2).sort((x,y)=>x-y);return a[0]===b[0]&&a[1]===b[1]}if(t.type==='ワイド')return o.slice(0,3).includes(n[0])&&o.slice(0,3).includes(n[1]);if(t.type==='三連複'){const a=o.slice(0,3).sort((x,y)=>x-y),b=n.slice(0,3).sort((x,y)=>x-y);return a.every((v,i)=>v===b[i])}return false}
function portfolioHitProbability(tickets,rows){if(!tickets?.length)return 0;const by={};rows.forEach(x=>by[x.h.number]=x.prob);const ns=rows.map(x=>x.h.number);let sum=0;for(const a of ns)for(const b of ns)if(b!==a)for(const c of ns)if(c!==a&&c!==b){const o=[a,b,c],p=orderProb(o,by);if(tickets.some(t=>ticketHitOrder(t,o)))sum+=p}return clamp(sum,0,1)}
function ticketRecommendations(rows,comboOdds={},targetRoi=1.20){const ba=combinationAdvice(rows,comboOdds,targetRoi),single=rows.slice(0,4).map(x=>({type:'単勝',key:String(x.h.number),numbers:[x.h.number],prob:x.prob,odds:x.odds,ev:x.ev,need:targetRoi/Math.max(x.prob,1e-9)}));const score=x=>x.odds!=null?(x.ev??0):x.prob;return {single:single.sort((a,b)=>score(b)-score(a)).slice(0,2),wide:ba.wide.slice().sort((a,b)=>score(b)-score(a)).slice(0,3),quinella:ba.quinella.slice().sort((a,b)=>score(b)-score(a)).slice(0,3),trio:ba.trio.slice().sort((a,b)=>score(b)-score(a)).slice(0,2)}}
function targetPlan(rows,comboOdds={},opts={}){
 const budget=Math.max(100,Math.floor((Number(opts.budget)||1000)/100)*100),targetRoi=Number(opts.targetRoi)||1.20,targetHit=Number(opts.targetHit)||.70,maxTickets=Math.max(1,Math.min(5,Math.floor(budget/100)));
 const rec=ticketRecommendations(rows,comboOdds,targetRoi),anchor=rows[0]?.h.number,top4=new Set(rows.slice(0,4).map(x=>x.h.number));
 let pool=[...rec.single,...rec.wide,...rec.quinella,...rec.trio].filter(x=>x.odds!=null&&x.ev!=null&&x.ev>=targetRoi);
 pool=pool.filter(x=>x.type==='単勝'||x.numbers.includes(anchor)||x.numbers.every(n=>top4.has(n))).sort((a,b)=>b.prob-a.prob||b.ev-a.ev);
 const chosen=[],caps={'単勝':1,'ワイド':3,'馬複':2,'三連複':1},counts={};
 while(chosen.length<maxTickets){let best=null,bestHit=portfolioHitProbability(chosen,rows),gain=0;for(const c of pool){if(chosen.includes(c)||(counts[c.type]||0)>=caps[c.type])continue;const hp=portfolioHitProbability([...chosen,c],rows),g=hp-bestHit;if(g>gain+1e-9||(Math.abs(g-gain)<1e-9&&best&&c.ev>best.ev)){best=c;gain=g;bestHit=hp}}if(!best)break;chosen.push(best);counts[best.type]=(counts[best.type]||0)+1;if(bestHit>=targetHit)break}
 const hitProb=portfolioHitProbability(chosen,rows),roi=chosen.length?chosen.reduce((z,x)=>z+x.ev,0)/chosen.length:null,meets=chosen.length>0&&hitProb>=targetHit&&roi>=targetRoi;
 const tickets=meets?chosen.map(x=>({...x,amount:100})):[];
 return {tickets,bestEffort:chosen,recommendations:rec,budget,targetRoi,targetHit,hitProb,roi,meets,anchor,confidence:rows.reduce((z,x)=>z+(x.auto?.confidence||0),0)/Math.max(rows.length,1),stance:meets?'購入候補あり':'見送り'}
}
function realisticBets(rows,comboOdds={},opts={}){return targetPlan(rows,comboOdds,{budget:opts.budget,targetRoi:opts.targetRoi||1.20,targetHit:opts.targetHit||.70})}
function ticketNumbers(t){if(Array.isArray(t?.numbers)&&t.numbers.length)return t.numbers.map(Number).filter(Number.isFinite);return String(t?.key??'').split(/[-－−–—]/).map(Number).filter(Number.isFinite)}
function historyResult(x){const r=x?.result||{};return {first:Number(r.first??x?.winner)||null,second:Number(r.second)||null,third:Number(r.third)||null}}
function canonType(t){return t==='馬連'?'馬複':t}
function historyTickets(x){const out=[];for(const t of x?.tickets||[])if(t?.type&&t?.key!=null)out.push({...t,type:canonType(t.type),numbers:ticketNumbers(t)});if(x?.pick!=null&&!out.some(t=>t.type==='単勝'))out.unshift({type:'単勝',key:String(x.pick),numbers:[Number(x.pick)],ev:x.ev??null});const seen=new Set();return out.filter(t=>{const k=t.type+'|'+t.key;if(seen.has(k))return false;seen.add(k);return true})}
function ticketGrade(t,result){const nums=ticketNumbers(t),r=result||{};const first=Number(r.first)||null,second=Number(r.second)||null,third=Number(r.third)||null;if(t.type==='単勝'){if(!first||nums.length<1)return null;return nums[0]===first}if(t.type==='馬複'||t.type==='馬連'){if(!first||!second||nums.length<2)return null;const a=nums.slice(0,2).sort((x,y)=>x-y),b=[first,second].sort((x,y)=>x-y);return a[0]===b[0]&&a[1]===b[1]}if(t.type==='ワイド'){if(!first||!second||!third||nums.length<2)return null;const top=new Set([first,second,third]);return top.has(nums[0])&&top.has(nums[1])}if(t.type==='三連複'){if(!first||!second||!third||nums.length<3)return null;const a=nums.slice(0,3).sort((x,y)=>x-y),b=[first,second,third].sort((x,y)=>x-y);return a.every((v,i)=>v===b[i])}return null}
function typeAccuracy(history,type){let hits=0,total=0,raceHits=0,raceTotal=0;for(const x of history||[]){const result=historyResult(x),ts=historyTickets(x).filter(t=>t.type===type);if(!ts.length)continue;let graded=0,hitAny=false;for(const t of ts){const g=ticketGrade(t,result);if(g==null)continue;graded++;total++;if(g){hits++;hitAny=true}}if(graded){raceTotal++;if(hitAny)raceHits++}}return {type,hits,total,rate:total?hits/total:null,raceHits,raceTotal,raceRate:raceTotal?raceHits/raceTotal:null}}
function allTypeAccuracy(history){return ['単勝','馬複','ワイド','三連複'].map(type=>typeAccuracy(history,type))}
function normalizeStoredTicket(t){if(!t)return null;if(t.type)return {...t,type:canonType(t.type),numbers:ticketNumbers(t)};if(t.t)return {type:canonType(t.t),key:String(t.k??''),numbers:Array.isArray(t.n)?t.n.map(Number):ticketNumbers({key:t.k}),ev:t.e==null?null:Number(t.e),prob:t.p==null?null:Number(t.p),odds:t.o==null?null:Number(t.o)};return null}
function backtestTickets(x){const a=(x?.backtestTickets||[]).map(normalizeStoredTicket).filter(Boolean);return a.length?a:historyTickets(x)}
function distanceBand(v){v=Number(v)||0;if(!v)return '不明';if(v<=1200)return '～1200m';if(v<=1600)return '1300～1600m';if(v<=2000)return '1700～2000m';if(v<=2400)return '2100～2400m';return '2500m～'}
function evBand(v){v=Number(v);if(!Number.isFinite(v))return 'EV不明';if(v<1)return '～0.99';if(v<1.1)return '1.00～1.09';if(v<1.2)return '1.10～1.19';if(v<1.3)return '1.20～1.29';return '1.30～'}
function raceMeta(x){return {market:x?.market||x?.type||'unknown',course:x?.course||'',surface:x?.surface||'',distance:Number(x?.distance)||0,distanceBand:distanceBand(x?.distance),going:x?.going||''}}
function filtersMatch(x,t,f={}){const m=raceMeta(x);if(f.type&&f.type!=='all'&&canonType(t.type)!==canonType(f.type))return false;if(f.market&&f.market!=='all'&&m.market!==f.market)return false;if(f.surface&&f.surface!=='all'&&m.surface!==f.surface)return false;if(f.distanceBand&&f.distanceBand!=='all'&&m.distanceBand!==f.distanceBand)return false;if(f.going&&f.going!=='all'&&m.going!==f.going)return false;if(f.course&&f.course!=='all'&&m.course!==f.course)return false;if(f.evBand&&f.evBand!=='all'&&evBand(t.ev)!==f.evBand)return false;if(f.minEv!=null&&(t.ev==null||Number(t.ev)<Number(f.minEv)))return false;return true}
function backtestRows(history,filters={}){const out=[];for(const x of history||[]){const result=historyResult(x);for(const t0 of backtestTickets(x)){const t=normalizeStoredTicket(t0);if(!t||!filtersMatch(x,t,filters))continue;const grade=ticketGrade(t,result);if(grade==null)continue;const odds=Number(t.odds),roiEligible=Number.isFinite(odds)&&odds>=1;out.push({entry:x,ticket:t,hit:!!grade,odds:roiEligible?odds:null,stake:roiEligible?100:0,payout:roiEligible&&grade?100*odds:0,meta:raceMeta(x),evBand:evBand(t.ev)})}}return out}
function summarizeBacktest(history,filters={}){const rows=backtestRows(history,filters),withOdds=rows.filter(x=>x.stake>0),hits=rows.filter(x=>x.hit).length,stake=withOdds.reduce((s,x)=>s+x.stake,0),payout=withOdds.reduce((s,x)=>s+x.payout,0);return {rows,total:rows.length,hits,rate:rows.length?hits/rows.length:null,withOdds:withOdds.length,stake,payout,roi:stake?payout/stake:null}}
function groupBacktest(history,dimension,filters={}){const rows=backtestRows(history,filters),map=new Map();for(const r of rows){let key='';if(dimension==='type')key=r.ticket.type;else if(dimension==='market')key=r.meta.market==='central'?'中央':'地方';else if(dimension==='course')key=r.meta.course||'不明';else if(dimension==='surface')key=r.meta.surface||'不明';else if(dimension==='distanceBand')key=r.meta.distanceBand;else if(dimension==='going')key=r.meta.going||'不明';else if(dimension==='evBand')key=r.evBand;else key='全体';const z=map.get(key)||{key,total:0,hits:0,withOdds:0,stake:0,payout:0};z.total++;if(r.hit)z.hits++;if(r.stake){z.withOdds++;z.stake+=r.stake;z.payout+=r.payout}map.set(key,z)}return [...map.values()].map(z=>({...z,rate:z.total?z.hits/z.total:null,roi:z.stake?z.payout/z.stake:null})).sort((a,b)=>(b.roi??-1)-(a.roi??-1)||b.total-a.total)}
function goalStats(history){let races=0,raceHits=0,stake=0,payout=0;for(const x of history||[]){const result=historyResult(x),ts=historyTickets(x);if(!ts.length||!result.first)continue;races++;let any=false;for(const t of ts){const g=ticketGrade(t,result);if(g==null)continue;if(g)any=true;const o=Number(t.odds);if(Number.isFinite(o)&&o>=1){stake+=100;if(g)payout+=100*o}}if(any)raceHits++}return {races,raceHits,hitRate:races?raceHits/races:null,stake,payout,roi:stake?payout/stake:null,targetHit:.70,targetRoi:1.20}}
function walkForward(history,filters={}){const entries=(history||[]).filter(x=>historyResult(x).first!=null&&backtestTickets(x).some(t=>normalizeStoredTicket(t)?.odds!=null&&normalizeStoredTicket(t)?.ev!=null)).slice().sort((a,b)=>String(a.date||a.createdAt||a.id).localeCompare(String(b.date||b.createdAt||b.id)));if(entries.length<6)return {enough:false,races:entries.length};const cut=Math.max(3,Math.floor(entries.length*.7)),train=entries.slice(0,cut),test=entries.slice(cut),thresholds=[1.0,1.1,1.2,1.3],minTickets=Math.max(5,Math.floor(train.length*.6));const candidates=thresholds.map(th=>({threshold:th,...summarizeBacktest(train,{...filters,minEv:th})})).filter(x=>x.withOdds>=minTickets&&x.roi!=null);if(!candidates.length)return {enough:false,races:entries.length,reason:'tickets'};candidates.sort((a,b)=>b.roi-a.roi||b.threshold-a.threshold);const best=candidates[0],validation=summarizeBacktest(test,{...filters,minEv:best.threshold});return {enough:true,races:entries.length,trainRaces:train.length,testRaces:test.length,threshold:best.threshold,train:best,validation}}
function parse(raw){const p=parsePayload(raw);return parseNAR(p)||parseJRA(p)}
const api={parsePayload,parse,parseJRA,parseNAR,parseJraPast,parseNarPasts,parseNarPastCell,rawFeatures,sixIndices,rank,INDEX_LABELS,MODEL_WEIGHTS,modelScore,overallGrade,judgement,valueIndex,marginScoreOne,popularityScoreOne,racePerformance,trendScore,parseOddsText,parseOddsTables,parseComboOddsText,parseComboOddsTables,quinellaProb,wideProb,trioProb,combinationAdvice,ticketRecommendations,portfolioHitProbability,targetPlan,realisticBets,ticketNumbers,historyResult,historyTickets,ticketGrade,typeAccuracy,allTypeAccuracy,normalizeStoredTicket,backtestTickets,distanceBand,evBand,raceMeta,backtestRows,summarizeBacktest,groupBacktest,goalStats,walkForward};if(typeof module!=='undefined'&&module.exports)module.exports=api;g.UmaCore=api})(typeof globalThis!=='undefined'?globalThis:this);