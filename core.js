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
const cm=s.match(/(?:^|\s)(\d{1,2}(?:[-－−]\d{1,2}){1,3})(?:\s|$)/),corners=cm?cm[1].split(/[-－−]/).map(Number):[];
const bwm=[...s.matchAll(/\b([3-6]\d{2})\s*kg\b/g)],bodyWeight=bwm.length?Number(bwm[bwm.length-1][1]):null;
return {date:`${dm[1]}-${String(dm[2]).padStart(2,'0')}-${String(dm[3]).padStart(2,'0')}`,course:dm[4],finish:Number(fm[1]),field:Number(field[1]),pop:pop?Number(pop[1]):null,jockey,weight:wm?Number(wm[1]):null,bodyWeight,distance,surface,going,margin,corners,classLevel:classLevelFromText(s,'central')}
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
    let finish=null,field=null,pop=null,jockey='',weight=null,bodyWeight=null,margin=null,corners=[];
    for(let j=i+1;j<Math.min(lines.length,i+7);j++){
      const f=lines[j].match(/^(\d{1,2})\/(\d{1,2})\s*(\d{1,2})人\s*([★▲△☆◇]?)([^\s]+)\s*(\d{2}(?:\.\d)?)/);
      if(f){finish=Number(f[1]);field=Number(f[2]);pop=Number(f[3]);jockey=cleanJockey((f[4]||'')+f[5]);weight=Number(f[6]);break}
      if(/^(?:出走取消|競走除外|競走中止|取消|除外|中止)/.test(lines[j]))break;
    }
    for(let j=i+1;j<Math.min(lines.length,i+9);j++){
      const mg=lines[j].match(/[（(]([0-9]+(?:\.[0-9]+)?)[）)]/);if(mg&&margin==null)margin=Number(mg[1]);
      const cm=lines[j].match(/(?:^|\s)(\d{1,2}(?:[-－−]\d{1,2}){1,3})(?:\s|$)/);
      if(cm&&!corners.length)corners=cm[1].split(/[-－−]/).map(Number).filter(Number.isFinite);
      const bw=lines[j].match(/(?:^|\s)\d{1,2}番\s+([3-6]\d{2})(?:\s|$)/);if(bw&&!bodyWeight)bodyWeight=Number(bw[1]);
    }
    const raceTitle=lines[i+1]||'';
    if(finish!=null)a.push({date:inferNarDate(m[2],m[3],raceDate),course:m[1].replace(/^Ｊ/,''),finish,field,pop,jockey,weight,bodyWeight,distance:Number(m[7]),surface:m[5]?'芝':'ダ',going:m[4],margin,corners,classLevel:classLevelFromText(raceTitle,'local')})
  }
  return a.slice(0,5)
}
function parseNarPastLegacy(s){s=norm(narNormText(String(s||'')).replace(/\n+/g,' '));const m=s.match(/(?:^|\s)(\d{1,2})\s+(\d{2})\.(\d{2})\.(\d{2})\s*(良|稍重|重|不良)\s*(\d{1,2})頭\s*([^\s]+)\s*(?:ナ)?\s*(右|左|直)\s*(\d{3,4})/);if(!m)return null;const tail=s.slice((m.index||0)+m[0].length);const pj=tail.match(/(\d{1,2})人\s+\d+\s+([ぁ-んァ-ヶー一-龠々・A-Za-z.]+)\s*(?:★|▲|△|☆|◇)?\s*(\d{2}(?:\.\d)?)/);const mg=tail.match(/[（(]([0-9]+(?:\.[0-9]+)?)[）)]/);const cm=tail.match(/(?:^|\s)(\d{1,2}(?:[-－−]\d{1,2}){1,3})(?:\s|$)/);const bw=tail.match(/(?:^|\s)\d{1,2}番\s+([3-6]\d{2})(?:\s|$)/);return {date:`20${m[2]}-${m[3]}-${m[4]}`,course:m[7].replace(/^Ｊ/,''),finish:Number(m[1]),field:Number(m[6]),pop:pj?Number(pj[1]):null,jockey:pj?pj[2]:'',weight:pj?Number(pj[3]):null,bodyWeight:bw?Number(bw[1]):null,distance:Number(m[9]),surface:null,going:m[5],margin:mg?Number(mg[1]):null,corners:cm?cm[1].split(/[-－−]/).map(Number):[],classLevel:classLevelFromText(s,'local')}}
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
function ticketRecommendations(rows,comboOdds={},targetRoi=1.20){
  const ba=combinationAdvice(rows,comboOdds,targetRoi);
  // 単勝は1.10.1の選び方を維持
  const single=rows.slice(0,4).map(x=>({type:'単勝',key:String(x.h.number),numbers:[x.h.number],prob:x.prob,odds:x.odds,ev:x.ev,need:targetRoi/Math.max(x.prob,1e-9)}));
  const oldScore=x=>x.odds!=null?(x.ev??0):x.prob;
  const singleOut=single.sort((a,b)=>oldScore(b)-oldScore(a)).slice(0,2);

  // 組み合わせ券種は「高EVだけ」を追わず、AI上位馬の組み合わせを優先
  const top=rows.slice(0,4).map(x=>x.h.number),a=top[0],b=top[1],c=top[2],d=top[3];
  const key2=(x,y)=>comboKey([x,y]),key3=(x,y,z)=>comboKey([x,y,z]);
  const allowedWide=new Set([key2(a,b),key2(a,c),key2(b,c),d!=null?key2(a,d):'']);
  const allowedQuinella=new Set([key2(a,b),key2(a,c),key2(b,c)]);
  const allowedTrio=new Set([key3(a,b,c),d!=null?key3(a,b,d):'',d!=null?key3(a,c,d):'']);

  const stableScore=x=>{
    const p=Math.max(Number(x.prob)||0,1e-9);
    const ev=x.ev==null?1:clamp(Number(x.ev),.70,1.80);
    // 的中確率を主、EVは副。長穴EVだけで上に来るのを抑える。
    return p*Math.pow(ev,.28)
  };
  const select=(arr,allowed,n)=>arr.filter(x=>allowed.has(x.key)).sort((x,y)=>stableScore(y)-stableScore(x)||((y.ev??0)-(x.ev??0))).slice(0,n);

  let wide=select(ba.wide,allowedWide,2);
  let quinella=select(ba.quinella,allowedQuinella,2);
  let trio=select(ba.trio,allowedTrio,1);

  // 万一候補が不足したら確率上位から補う
  if(wide.length<2)wide=ba.wide.slice().sort((x,y)=>y.prob-x.prob).slice(0,2);
  if(quinella.length<2)quinella=ba.quinella.slice().sort((x,y)=>y.prob-x.prob).slice(0,2);
  if(!trio.length)trio=ba.trio.slice().sort((x,y)=>y.prob-x.prob).slice(0,1);

  return {single:singleOut,wide,quinella,trio}
}
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
function historyTickets(x){const out=[];for(const t0 of x?.tickets||[]){const t=normalizeStoredTicket(t0);if(t)out.push(t)}if(x?.pick!=null&&!out.some(t=>t.type==='単勝'))out.unshift({type:'単勝',key:String(x.pick),numbers:[Number(x.pick)],ev:x.ev??null});const seen=new Set();return out.filter(t=>{const k=t.type+'|'+t.key;if(seen.has(k))return false;seen.add(k);return true})}
function ticketGrade(t,result){
  const type=canonType(t?.type),nums=[...new Set(ticketNumbers(t).map(Number).filter(Number.isFinite))],r=result||{};
  const first=Number(r.first)||null,second=Number(r.second)||null,third=Number(r.third)||null;
  if(type==='単勝'){if(!first||nums.length<1)return null;return nums[0]===first}
  if(type==='馬複'){if(!first||!second||nums.length<2)return null;const a=nums.slice(0,2).sort((x,y)=>x-y),b=[first,second].sort((x,y)=>x-y);return a[0]===b[0]&&a[1]===b[1]}
  if(type==='ワイド'){if(!first||!second||!third||nums.length<2)return null;const top=new Set([first,second,third]);return top.has(nums[0])&&top.has(nums[1])}
  if(type==='三連複'){if(!first||!second||!third||nums.length<3)return null;const a=nums.slice(0,3).sort((x,y)=>x-y),b=[first,second,third].sort((x,y)=>x-y);return a.every((v,i)=>v===b[i])}
  return null
}
function typeAccuracy(history,type){
  type=canonType(type);let hits=0,total=0,raceHits=0,raceTotal=0,withOdds=0,stake=0,payout=0;
  for(const x of history||[]){
    const result=historyResult(x),ts=allSuggestedTickets(x).filter(t=>canonType(t.type)===type);
    if(!ts.length)continue;
    let graded=0,hitAny=false;
    for(const t of ts){
      const g=ticketGrade(t,result);if(g==null)continue;
      graded++;total++;if(g){hits++;hitAny=true}
      const o=Number(t.odds);if(Number.isFinite(o)&&o>=1){withOdds++;stake+=100;if(g)payout+=100*o}
    }
    if(graded){raceTotal++;if(hitAny)raceHits++}
  }
  return {type,hits,total,rate:total?hits/total:null,raceHits,raceTotal,raceRate:raceTotal?raceHits/raceTotal:null,withOdds,stake,payout,roi:stake?payout/stake:null}
}
function allTypeAccuracy(history){return ['単勝','馬複','ワイド','三連複'].map(type=>typeAccuracy(history,type))}
function normalizeStoredTicket(t){if(!t)return null;if(t.type)return {...t,type:canonType(t.type),numbers:ticketNumbers(t)};if(t.t)return {type:canonType(t.t),key:String(t.k??''),numbers:Array.isArray(t.n)?t.n.map(Number):ticketNumbers({key:t.k}),ev:t.e==null?null:Number(t.e),prob:t.p==null?null:Number(t.p),odds:t.o==null?null:Number(t.o)};return null}
function backtestTickets(x){const a=allSuggestedTickets(x);return a.length?a:historyTickets(x)}
function allSuggestedTickets(x){
  const source=(x?.aiTickets&&x.aiTickets.length)?x.aiTickets:(x?.backtestTickets&&x.backtestTickets.length)?x.backtestTickets:historyTickets(x);
  const out=[],seen=new Set();
  for(const t0 of source||[]){
    const t=normalizeStoredTicket(t0);if(!t)continue;
    const k=t.type+'|'+t.key;if(seen.has(k))continue;seen.add(k);out.push(t)
  }
  return out
}

function payoutKey(type,keyOrNums){
  const typ=canonType(type),nums=Array.isArray(keyOrNums)?keyOrNums.map(Number).filter(Number.isFinite):ticketNumbers({type:typ,key:String(keyOrNums||'')});
  const key=nums.length?comboKey(nums):String(keyOrNums||'').trim();
  return `${typ}|${key}`
}
function parseOfficialPayoutText(text){
  const out={};
  for(const raw of String(text||'').split(/[\n,、]+/)){
    const s=raw.trim();if(!s)continue;
    const m=s.match(/^(単勝|ワイド|馬複|馬連|三連複)\s*[:：]\s*([0-9０-９\-－−]+)\s*=\s*([0-9０-９,，]+)\s*$/);
    if(!m)continue;
    const typ=canonType(m[1]),nums=fwDigits(m[2]).split(/[-－−]/).map(Number).filter(Number.isFinite),amt=Number(fwDigits(m[3]).replace(/[，,]/g,''));
    if(nums.length&&Number.isFinite(amt)&&amt>=0)out[payoutKey(typ,nums)]=amt
  }
  return out
}
function parseRefundText(text){
  const out=[];
  for(const raw of String(text||'').split(/[\n,、]+/)){
    const s=raw.trim();if(!s)continue;
    const m=s.match(/^(?:返還\s*[:：]\s*)?(単勝|ワイド|馬複|馬連|三連複)\s*[:：]\s*([0-9０-９\-－−]+)$/);
    if(!m)continue;
    const typ=canonType(m[1]),nums=fwDigits(m[2]).split(/[-－−]/).map(Number).filter(Number.isFinite);
    if(nums.length)out.push(payoutKey(typ,nums))
  }
  return [...new Set(out)]
}
function officialPayoutForTicket(entry,t){
  const key=payoutKey(t.type,t.numbers?.length?t.numbers:t.key),refunds=new Set(entry?.refundKeys||[]);
  if(refunds.has(key))return {amount:100,refund:true,key};
  const map=entry?.officialPayouts||{},v=Number(map[key]);
  if(Number.isFinite(v)&&v>=0)return {amount:v,refund:false,key};
  return {amount:null,refund:false,key}
}
function exactRaceStats(entry,source='all',type=null){
  const result=historyResult(entry),tickets=(source==='purchase'?historyTickets(entry):allSuggestedTickets(entry)).filter(t=>!type||canonType(t.type)===canonType(type));
  let graded=0,hits=0,stake=0,payout=0,missing=0,anyHit=false;
  for(const t of tickets){
    let g=ticketGrade(t,result),official=officialPayoutForTicket(entry,t);
    if(g==null&&official.amount==null)continue;
    graded++;stake+=100;
    if(official.refund){payout+=100;continue}
    if(official.amount!=null){
      // Official payout map overrides ordinary grading; useful for dead-heats.
      if(official.amount>0){hits++;anyHit=true;payout+=official.amount}
      continue
    }
    if(g){
      hits++;anyHit=true;missing++;
    }
    // Losing tickets need no payout entry; their payout is exactly 0.
  }
  return {tickets:tickets.length,graded,hits,rate:graded?hits/graded:null,stake,payout,missing,complete:graded>0&&missing===0,anyHit,roi:graded&&missing===0? payout/stake:null}
}
function exactStats(history,source='all',type=null){
  let tickets=0,graded=0,hits=0,races=0,raceHits=0,completeRaces=0,completeTickets=0,stake=0,payout=0,missingWins=0;
  for(const x of history||[]){
    const s=exactRaceStats(x,source,type);
    tickets+=s.tickets;graded+=s.graded;hits+=s.hits;missingWins+=s.missing;
    if(s.graded){races++;if(s.anyHit)raceHits++}
    if(s.complete){completeRaces++;completeTickets+=s.graded;stake+=s.stake;payout+=s.payout}
  }
  return {tickets,graded,hits,rate:graded?hits/graded:null,races,raceHits,raceRate:races?raceHits/races:null,completeRaces,completeTickets,stake,payout,roi:stake?payout/stake:null,missingWins}
}
function actualPurchaseStats(history){
  let races=0,stake=0,payout=0;
  for(const x of history||[]){
    const s=Number(x.stake)||0;if(s<=0)continue;
    races++;stake+=s;payout+=Number(x.ret)||0
  }
  return {races,stake,payout,roi:stake?payout/stake:null}
}
function goalStats(history){
  const ex=exactStats(history,'purchase');
  return {races:ex.races,raceHits:ex.raceHits,hitRate:ex.raceRate,stake:ex.stake,payout:ex.payout,roi:ex.roi,completeRaces:ex.completeRaces,missingWins:ex.missingWins,targetHit:.70,targetRoi:1.20}
}
function suggestedRaceStats(x){
  const result=historyResult(x),tickets=allSuggestedTickets(x);
  let graded=0,hits=0,withOdds=0,stake=0,payout=0;
  for(const t of tickets){
    const g=ticketGrade(t,result);if(g==null)continue;
    graded++;if(g)hits++;
    const o=Number(t.odds);
    if(Number.isFinite(o)&&o>=1){withOdds++;stake+=100;if(g)payout+=100*o}
  }
  return {tickets:tickets.length,graded,hits,rate:graded?hits/graded:null,withOdds,stake,payout,roi:stake?payout/stake:null,anyHit:hits>0}
}
function suggestedStats(history){
  let tickets=0,graded=0,hits=0,races=0,raceHits=0,withOdds=0,stake=0,payout=0;
  for(const x of history||[]){
    const s=suggestedRaceStats(x);
    tickets+=s.tickets;graded+=s.graded;hits+=s.hits;withOdds+=s.withOdds;stake+=s.stake;payout+=s.payout;
    if(s.graded){races++;if(s.anyHit)raceHits++}
  }
  return {tickets,graded,hits,rate:graded?hits/graded:null,races,raceHits,raceRate:races?raceHits/races:null,withOdds,stake,payout,roi:stake?payout/stake:null}
}
function currentModelHistory(history,prefix='1.11'){return (history||[]).filter(x=>String(x?.modelVersion||'').startsWith(prefix))}

function aiTop3(x){
  if(Array.isArray(x?.aiTop3)&&x.aiTop3.length)return x.aiTop3.slice(0,3).map((z,i)=>({rank:i+1,number:Number(z.number??z.n),name:z.name||'',score:z.score??null,grade:z.grade||''}));
  return []
}
function resultComparison(x){
  const result=historyResult(x),top=aiTop3(x),names=x?.horseNames||{};
  const actual=[result.first,result.second,result.third].map((n,i)=>n?{rank:i+1,number:Number(n),name:names[String(n)]||names[n]||''}:null);
  const aiSet=new Set(top.map(z=>z.number)),actualSet=new Set(actual.filter(Boolean).map(z=>z.number));
  const top1=!!(top[0]&&actual[0]&&top[0].number===actual[0].number);
  let top3Hits=0;for(const n of aiSet)if(actualSet.has(n))top3Hits++;
  return {top,actual,top1,top3Hits,settled:!!result.first}
}

function distanceBand(v){v=Number(v)||0;if(!v)return '不明';if(v<=1200)return '～1200m';if(v<=1600)return '1300～1600m';if(v<=2000)return '1700～2000m';if(v<=2400)return '2100～2400m';return '2500m～'}
function evBand(v){v=Number(v);if(!Number.isFinite(v))return 'EV不明';if(v<1)return '～0.99';if(v<1.1)return '1.00～1.09';if(v<1.2)return '1.10～1.19';if(v<1.3)return '1.20～1.29';return '1.30～'}
function raceMeta(x){return {market:x?.market||x?.type||'unknown',course:x?.course||'',surface:x?.surface||'',distance:Number(x?.distance)||0,distanceBand:distanceBand(x?.distance),going:x?.going||''}}
function filtersMatch(x,t,f={}){const m=raceMeta(x);if(f.type&&f.type!=='all'&&canonType(t.type)!==canonType(f.type))return false;if(f.market&&f.market!=='all'&&m.market!==f.market)return false;if(f.surface&&f.surface!=='all'&&m.surface!==f.surface)return false;if(f.distanceBand&&f.distanceBand!=='all'&&m.distanceBand!==f.distanceBand)return false;if(f.going&&f.going!=='all'&&m.going!==f.going)return false;if(f.course&&f.course!=='all'&&m.course!==f.course)return false;if(f.evBand&&f.evBand!=='all'&&evBand(t.ev)!==f.evBand)return false;if(f.minEv!=null&&(t.ev==null||Number(t.ev)<Number(f.minEv)))return false;return true}
function backtestRows(history,filters={}){const out=[];for(const x of history||[]){const result=historyResult(x);for(const t0 of backtestTickets(x)){const t=normalizeStoredTicket(t0);if(!t||!filtersMatch(x,t,filters))continue;const grade=ticketGrade(t,result);if(grade==null)continue;const odds=Number(t.odds),roiEligible=Number.isFinite(odds)&&odds>=1;out.push({entry:x,ticket:t,hit:!!grade,odds:roiEligible?odds:null,stake:roiEligible?100:0,payout:roiEligible&&grade?100*odds:0,meta:raceMeta(x),evBand:evBand(t.ev)})}}return out}
function summarizeBacktest(history,filters={}){const rows=backtestRows(history,filters),withOdds=rows.filter(x=>x.stake>0),hits=rows.filter(x=>x.hit).length,stake=withOdds.reduce((s,x)=>s+x.stake,0),payout=withOdds.reduce((s,x)=>s+x.payout,0);return {rows,total:rows.length,hits,rate:rows.length?hits/rows.length:null,withOdds:withOdds.length,stake,payout,roi:stake?payout/stake:null}}
function groupBacktest(history,dimension,filters={}){const rows=backtestRows(history,filters),map=new Map();for(const r of rows){let key='';if(dimension==='type')key=r.ticket.type;else if(dimension==='market')key=r.meta.market==='central'?'中央':'地方';else if(dimension==='course')key=r.meta.course||'不明';else if(dimension==='surface')key=r.meta.surface||'不明';else if(dimension==='distanceBand')key=r.meta.distanceBand;else if(dimension==='going')key=r.meta.going||'不明';else if(dimension==='evBand')key=r.evBand;else key='全体';const z=map.get(key)||{key,total:0,hits:0,withOdds:0,stake:0,payout:0};z.total++;if(r.hit)z.hits++;if(r.stake){z.withOdds++;z.stake+=r.stake;z.payout+=r.payout}map.set(key,z)}return [...map.values()].map(z=>({...z,rate:z.total?z.hits/z.total:null,roi:z.stake?z.payout/z.stake:null})).sort((a,b)=>(b.roi??-1)-(a.roi??-1)||b.total-a.total)}
function walkForward(history,filters={}){const entries=(history||[]).filter(x=>historyResult(x).first!=null&&backtestTickets(x).some(t=>normalizeStoredTicket(t)?.odds!=null&&normalizeStoredTicket(t)?.ev!=null)).slice().sort((a,b)=>String(a.date||a.createdAt||a.id).localeCompare(String(b.date||b.createdAt||b.id)));if(entries.length<6)return {enough:false,races:entries.length};const cut=Math.max(3,Math.floor(entries.length*.7)),train=entries.slice(0,cut),test=entries.slice(cut),thresholds=[1.0,1.1,1.2,1.3],minTickets=Math.max(5,Math.floor(train.length*.6));const candidates=thresholds.map(th=>({threshold:th,...summarizeBacktest(train,{...filters,minEv:th})})).filter(x=>x.withOdds>=minTickets&&x.roi!=null);if(!candidates.length)return {enough:false,races:entries.length,reason:'tickets'};candidates.sort((a,b)=>b.roi-a.roi||b.threshold-a.threshold);const best=candidates[0],validation=summarizeBacktest(test,{...filters,minEv:best.threshold});return {enough:true,races:entries.length,trainRaces:train.length,testRaces:test.length,threshold:best.threshold,train:best,validation}}

// ============================================================
// v1.12 — simulation / calibration / adaptive-learning engine
// ============================================================
const BASE_MODEL_WEIGHTS_112={ability:.34,suitability:.24,pace:.16,jockey:.09,form:.17};
const DEFAULT_TICKET_THRESHOLDS_112={'単勝':1.12,'ワイド':1.15,'馬複':1.25,'三連複':1.40};
const SIMULATIONS_112=6000;

function classLevelFromText(s,market='central'){
  s=String(s||'').replace(/\s/g,'').toUpperCase();
  if(!s)return null;
  if(/GⅠ|GI(?!I)|G1/.test(s))return 10;
  if(/GⅡ|GII|G2/.test(s))return 9;
  if(/GⅢ|GIII|G3/.test(s))return 8;
  if(/リステッド|LISTED|OPEN|オープン|OP\b/.test(s))return 7;
  if(/3勝クラス|1600万/.test(s))return 6;
  if(/2勝クラス|1000万/.test(s))return 5;
  if(/1勝クラス|500万/.test(s))return 4;
  if(/未勝利/.test(s))return 3;
  if(/新馬/.test(s))return 2.5;
  const local=s.match(/(?:^|[^A-Z])([ABC])([123])(?:[^0-9]|$)/);
  if(local){
    const base={A:8,B:6.5,C:5}[local[1]]||5;
    return base-(Number(local[2])-1)*.45;
  }
  const localNum=s.match(/(?:C|B|A)(\d)[－\-]/);
  if(localNum){
    const letter=(s.match(/([ABC])\d[－\-]/)||[])[1]||'C';
    const base={A:8,B:6.5,C:5}[letter]||5;
    return base-(Number(localNum[1])-1)*.45;
  }
  return null;
}
function safeDateMs(s){const d=Date.parse(String(s||''));return Number.isFinite(d)?d:null}
function daysBetween(a,b){const x=safeDateMs(a),y=safeDateMs(b);return x!=null&&y!=null?Math.round((x-y)/86400000):null}
function layoffScore(days){
  if(days==null)return 5;
  if(days<=5)return 4.4;
  if(days<=10)return 5.0;
  if(days<=35)return 6.2;
  if(days<=56)return 5.8;
  if(days<=90)return 5.2;
  if(days<=150)return 4.6;
  return 4.0;
}
function bodyWeightStability(recent){
  const w=(recent||[]).map(x=>Number(x.bodyWeight)).filter(x=>Number.isFinite(x)&&x>=300).slice(0,4);
  if(w.length<2)return {score:5,detail:'馬体重履歴不足'};
  const diffs=[];for(let i=0;i<w.length-1;i++)diffs.push(Math.abs(w[i]-w[i+1]));
  const avg=diffs.reduce((a,b)=>a+b,0)/diffs.length;
  const score=avg<=8?6.1:avg<=15?5.6:avg<=25?4.8:4.1;
  return {score,detail:`近走馬体重変動 平均${avg.toFixed(0)}kg`};
}
function classChangeScore(current,previous){
  if(current==null||previous==null)return {score:5,delta:null,detail:'クラス比較データ不足'};
  const delta=Number(current)-Number(previous);
  const score=clamp(5-delta*.85,2.7,7.3);
  return {score,delta,detail:delta>.2?`前走より昇級相当 +${delta.toFixed(1)}`:delta<-.2?`前走より降級相当 ${delta.toFixed(1)}`:'前走と同程度のクラス'};
}
function shrinkScore(empirical,n,prior=5,k=3){
  if(empirical==null||!Number.isFinite(Number(empirical))||!n)return prior;
  return (Number(empirical)*n+prior*k)/(n+k)
}
function conditionScore(recent,pred){
  const vals=[];for(let i=0;i<(recent||[]).length;i++){const x=recent[i];if(pred(x))vals.push({v:racePerformance(x),w:Math.pow(.84,i)})}
  const emp=weightedCustom(vals),n=vals.length;
  return {score:shrinkScore(emp,n,5,3),n}
}
function styleProfile(h){
  const xs=(h.recent||[]).slice(0,6),early=[],late=[],gain=[];
  for(const x of xs){
    const cs=(x.corners||[]).filter(Number.isFinite),f=Math.max(Number(x.field)||0,...cs,2);
    if(!cs.length||f<=1)continue;
    const e=clamp((cs[0]-1)/(f-1),0,1),l=clamp((cs[cs.length-1]-1)/(f-1),0,1);
    early.push(e);late.push(l);gain.push(e-l);
  }
  const e=weighted(early),l=weighted(late),g=weighted(gain);
  if(e==null)return {early:null,late:null,gain:null,label:'不明',samples:0};
  const label=e<=.18?'逃げ':e<=.38?'先行':e<=.66?'差し':'追込';
  return {early:e,late:l,gain:g??0,label,samples:early.length}
}
function paceIndex(h,r){
  const profiles=(r.horses||[]).map(x=>styleProfile(x)),valid=profiles.filter(x=>x.early!=null),hp=styleProfile(h);
  if(hp.early==null||valid.length<Math.max(4,Math.ceil((r.horses?.length||0)*.4)))return {score:50,detail:'位置取りデータ不足のため中立',style:hp.label,pressure:null};
  const leaders=valid.filter(x=>x.early<=.18).length,front=valid.filter(x=>x.early<=.38).length;
  const pressure=(leaders*1.35+front*.55)/Math.max(valid.length,1);
  let score=50;
  if(pressure>=.58){
    score=47+(hp.early-.38)*26+(hp.gain||0)*32; // high pace: closers / improving-position horses
  }else if(pressure<=.28){
    score=63-hp.early*33-(Math.max(0,-(hp.gain||0))*8); // slow pace: front advantage
  }else{
    score=58-Math.abs(hp.early-.40)*22+(hp.gain||0)*14;
  }
  if(h.frame&&Number(r.distance)<=1400)score+=(4.5-Number(h.frame))*.55;
  const detail=pressure>=.58?`先行圧力高め（逃げ${leaders}・先行系${front}）`:pressure<=.28?`先行圧力低め（前残り寄り）`:`平均的な先行圧力`;
  return {score:clamp(Math.round(score),20,85),detail,style:hp.label,pressure}
}
function rawFeatures(h,r){
  const recent=(h.recent||[]).slice(0,20),latest=recent[0]||null;
  const margin=weighted(recent.map(marginScoreOne))??5,popularity=weighted(recent.map(popularityScoreOne))??5,field=weighted(recent.map(finishScore))??5;
  let distance=5;
  if(r.distance&&latest?.distance){
    const delta=Math.abs(Number(r.distance)-Number(latest.distance)),change=clamp(8.5-delta/120,2.4,8.5);
    const near=conditionScore(recent,x=>x.distance&&Math.abs(Number(x.distance)-Number(r.distance))<=200);
    distance=.50*change+.50*near.score;
  }
  const sameSurface=conditionScore(recent,x=>x.surface&&r.surface&&x.surface===r.surface);
  const surface=r.surface?sameSurface.score:5;
  let going=5;
  if(r.going){
    const gv=recent.map((x,i)=>({v:racePerformance(x),w:goingSimilarity(x.going,r.going)*Math.pow(.84,i)})).filter(x=>x.w>0);
    going=shrinkScore(weightedCustom(gv),gv.length,5,3);
  }
  const sameCourse=conditionScore(recent,x=>r.courseName&&x.course&&String(x.course).replace(/^Ｊ/,'')===String(r.courseName).replace(/^Ｊ/,''));
  const courseDistance=conditionScore(recent,x=>r.courseName&&x.course&&String(x.course).replace(/^Ｊ/,'')===String(r.courseName).replace(/^Ｊ/,'')&&r.distance&&x.distance&&Math.abs(Number(x.distance)-Number(r.distance))<=200&&(x.surface?x.surface===r.surface:true));
  const sameJ=recent.filter(x=>h.jockey&&x.jockey&&(normJockey(x.jockey).includes(normJockey(h.jockey))||normJockey(h.jockey).includes(normJockey(x.jockey))));
  let jockey=5;if(sameJ.length)jockey=shrinkScore(weighted(sameJ.map(racePerformance)),sameJ.length,5,2.5);else if(h.jockey&&latest?.jockey&&normJockey(h.jockey)===normJockey(latest.jockey))jockey=5.5;
  let frame=5;if(h.frame){const pos=(Number(h.frame)-1)/7;if(r.surface==='ダ'||Number(r.distance)<=1400)frame=clamp(6.15-1.25*pos,4.8,6.15);else frame=clamp(5.6-Math.abs(pos-.48)*.75,5.0,5.6)}
  let weight=5,weightDelta=null;const rw=recent.map(x=>x.weight).filter(x=>Number.isFinite(Number(x)));if(Number.isFinite(Number(h.weight))&&rw.length){const base=weighted(rw.map(Number));weightDelta=Number(h.weight)-Number(base);weight=clamp(5.4-weightDelta*.45,3.2,7.1)}
  const trend=trendScore(recent),venue=recordScore(h.records?.venue),distRecord=recordScore(h.records?.distance);
  const cls=classChangeScore(r.classLevel,latest?.classLevel);
  const layDays=latest?.date&&r.date?daysBetween(r.date,latest.date):null,layoff=layoffScore(layDays);
  const body=bodyWeightStability(recent);
  return {recent,latest,margin,popularity,field,distance,surface,going,jockey,frame,weight,weightDelta,trend,venue,distRecord,sameJ:sameJ.length,evidence:recent.length,sameCourse,courseDistance,classChange:cls.score,classDelta:cls.delta,classDetail:cls.detail,layoff,layDays,bodyScore:body.score,bodyDetail:body.detail}
}
function sixIndices(h,r){
  const f=rawFeatures(h,r),perf=weighted(f.recent.slice(0,6).map(racePerformance))??5;
  const ability=to100(weightedCustom([{v:perf,w:.32},{v:f.margin,w:.23},{v:f.field,w:.18},{v:f.popularity,w:.17},{v:f.classChange,w:.10}]));
  const suitability=to100(weightedCustom([{v:f.distance,w:.22},{v:f.surface,w:.18},{v:f.going,w:.16},{v:f.courseDistance.score,w:.20},{v:f.sameCourse.score,w:.11},{v:f.distRecord,w:.08},{v:f.frame,w:.05}]));
  const pace=paceIndex(h,r);
  const jockey=to100(f.jockey);
  const recent2=weighted(f.recent.slice(0,2).map(racePerformance))??5;
  const form=to100(weightedCustom([{v:f.trend,w:.34},{v:recent2,w:.25},{v:f.weight,w:.12},{v:f.layoff,w:.12},{v:f.bodyScore,w:.07},{v:f.margin,w:.10}]));
  const details={
    ability:`着差・着順/頭数・人気＋${f.classDetail}`,
    suitability:`コース×距離${f.courseDistance.n}走 / 同場${f.sameCourse.n}走を縮小推定`,
    pace:`${pace.detail} / 脚質 ${pace.style}`,
    jockey:f.sameJ?`今回騎手との近走 ${f.sameJ}走を縮小評価`:(h.jockey?'同騎手データが少なく中立寄り':'騎手情報不足'),
    form:`近走推移＋直近内容 / ${f.layDays!=null?`前走から${f.layDays}日`: '間隔不明'} / ${f.bodyDetail}`,
    value:'能力評価とは分離し、オッズとの差だけで計算'
  };
  const observed=[f.evidence>=2,!!(r.distance&&f.latest?.distance),!!r.surface,!!(r.going&&f.recent.some(x=>x.going)),f.sameJ>0,styleProfile(h).samples>=2,Number.isFinite(Number(h.weight)),f.courseDistance.n>0,f.latest?.classLevel!=null].filter(Boolean).length;
  const confidence=clamp(.18+.065*observed+.018*Math.min(f.evidence,8),.22,.93);
  return {ability,suitability,pace:pace.score,jockey,form,value:50,confidence,evidence:f.evidence,style:pace.style,details,raw:f}
}
function normalizeWeights(w){
  const keys=['ability','suitability','pace','jockey','form'];let sum=0,out={};
  for(const k of keys){out[k]=Math.max(.01,Number(w?.[k]??BASE_MODEL_WEIGHTS_112[k]));sum+=out[k]}
  for(const k of keys)out[k]/=sum;
  return out
}
function modelScore(ix,weights=BASE_MODEL_WEIGHTS_112){weights=normalizeWeights(weights);return Math.round(Object.entries(weights).reduce((s,[k,w])=>s+(Number(ix?.[k])||50)*w,0))}
function judgement(ix){const score=modelScore(ix,BASE_MODEL_WEIGHTS_112);return {score,grade:overallGrade(score)}}

function forecastRows(x){
  if(Array.isArray(x?.aiForecast)&&x.aiForecast.length)return x.aiForecast;
  if(Array.isArray(x?.aiForecastPacked))return x.aiForecastPacked.map(a=>({
    number:Number(a[0]),pWin:Number(a[1]),pTop2:Number(a[2]),pTop3:Number(a[3]),
    roleRanks:{win:Number(a[4])||null,top2:Number(a[5])||null,top3:Number(a[6])||null},
    indices:{ability:Number(a[7]),suitability:Number(a[8]),pace:Number(a[9]),jockey:Number(a[10]),form:Number(a[11])}
  }));
  return []
}
function forecastEntries(history,market){
  return (history||[]).filter(x=>historyResult(x).first!=null&&forecastRows(x).length>=3&&(market?((x.market||x.type)===market):true))
    .map(x=>({...x,aiForecast:forecastRows(x)}))
    .sort((a,b)=>String(a.date||a.createdAt||a.id).localeCompare(String(b.date||b.createdAt||b.id)));
}
function learnWeightsFromEntries(entries){
  const keys=['ability','suitability','pace','jockey','form'],lifts=Object.fromEntries(keys.map(k=>[k,[]]));
  for(const x of entries||[]){
    const f=x.aiForecast||[],win=historyResult(x).first,w=f.find(z=>Number(z.number)===Number(win));if(!w?.indices)continue;
    for(const k of keys){
      const vals=f.map(z=>Number(z.indices?.[k])).filter(Number.isFinite);if(vals.length<3)continue;
      const mean=vals.reduce((a,b)=>a+b,0)/vals.length,sd=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length)||1;
      lifts[k].push((Number(w.indices[k])-mean)/sd)
    }
  }
  const raw={};for(const k of keys){const a=lifts[k];const lift=a.length?a.reduce((s,v)=>s+v,0)/a.length:0;raw[k]=BASE_MODEL_WEIGHTS_112[k]*Math.exp(clamp(lift,-1.2,1.2)*.38)}
  return normalizeWeights(raw)
}
function scoreForecastHorse(z,w){return Object.entries(normalizeWeights(w)).reduce((s,[k,v])=>s+(Number(z.indices?.[k])||50)*v,0)}
function evaluateTop1(entries,w){
  let n=0,h=0;for(const x of entries||[]){const f=x.aiForecast||[],win=historyResult(x).first;if(!win||f.length<3)continue;const best=f.slice().sort((a,b)=>scoreForecastHorse(b,w)-scoreForecastHorse(a,w))[0];n++;if(Number(best.number)===Number(win))h++}return {n,h,rate:n?h/n:null}
}
function weightWalkForward(history,market){
  const e=forecastEntries(history,market);if(e.length<30)return {enough:false,races:e.length,weights:BASE_MODEL_WEIGHTS_112};
  const cut=Math.max(20,Math.floor(e.length*.7)),train=e.slice(0,cut),test=e.slice(cut),learned=learnWeightsFromEntries(train),baseEval=evaluateTop1(test,BASE_MODEL_WEIGHTS_112),learnEval=evaluateTop1(test,learned);
  const usable=learnEval.n>=8&&learnEval.rate!=null&&baseEval.rate!=null&&learnEval.rate>=baseEval.rate-.005;
  const blend=usable?clamp((e.length-30)/120,0,.50):0,weights={};
  for(const k of Object.keys(BASE_MODEL_WEIGHTS_112))weights[k]=BASE_MODEL_WEIGHTS_112[k]*(1-blend)+learned[k]*blend;
  return {enough:true,races:e.length,train:train.length,test:test.length,learned,baseEval,learnEval,usable,blend,weights:normalizeWeights(weights)}
}
function calibrationSamples(history,market,target='pWin'){
  const out=[];for(const x of forecastEntries(history,market)){const r=historyResult(x),top2=new Set([r.first,r.second]),top3=new Set([r.first,r.second,r.third]);for(const z of x.aiForecast||[]){const p=Number(z[target]);if(!Number.isFinite(p))continue;let y=0;if(target==='pWin')y=Number(z.number)===Number(r.first)?1:0;else if(target==='pTop2')y=top2.has(Number(z.number))?1:0;else y=top3.has(Number(z.number))?1:0;out.push({p,y})}}return out
}
function calibrateOne(p,samples){
  p=clamp(Number(p)||0,0,1);if(!samples||samples.length<80)return p;
  const edges=[0,.04,.08,.12,.18,.25,.35,.50,1.01];let lo=0,hi=1;
  for(let i=0;i<edges.length-1;i++)if(p>=edges[i]&&p<edges[i+1]){lo=edges[i];hi=edges[i+1];break}
  const bin=samples.filter(x=>x.p>=lo&&x.p<hi);if(bin.length<15)return p;
  const avg=bin.reduce((s,x)=>s+x.p,0)/bin.length,hits=bin.reduce((s,x)=>s+x.y,0),priorN=30,post=(hits+priorN*avg)/(bin.length+priorN),blend=clamp(bin.length/120,0,.65);
  return clamp(p*(1-blend)+post*blend,0.001,.999)
}
function rescaleProbabilities(vals,targetSum){
  let a=vals.map(v=>clamp(Number(v)||0,0,1)),sum=a.reduce((s,v)=>s+v,0);if(!sum)return a;
  for(let iter=0;iter<5;iter++){const f=targetSum/sum;a=a.map(v=>clamp(v*f,0,1));sum=a.reduce((s,v)=>s+v,0);if(Math.abs(sum-targetSum)<1e-6)break}
  return a
}
function hashSeed(s){let h=2166136261>>>0;for(const ch of String(s||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng32(seed){let x=(seed||123456789)>>>0;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296}}
function weightedPick(items,weights,rand){
  let sum=0;for(const i of items)sum+=Math.max(1e-9,weights[i]);let r=rand()*sum;
  for(const i of items){r-=Math.max(1e-9,weights[i]);if(r<=0)return i}return items[items.length-1]
}
function simulateRace(rows,n=SIMULATIONS_112,seed=1){
  const nums=rows.map(x=>x.h.number),weights={};for(const x of rows)weights[x.h.number]=Math.max(1e-6,Number(x.baseProb)||1/rows.length);
  const win={},top2={},top3={},q={},w={},t={},orders={};for(const no of nums){win[no]=0;top2[no]=0;top3[no]=0}
  const rand=rng32(seed);
  for(let z=0;z<n;z++){
    const left=nums.slice(),o=[],picks=Math.min(3,left.length);
    for(let pos=0;pos<picks;pos++){const no=weightedPick(left,weights,rand);o.push(no);left.splice(left.indexOf(no),1)}
    if(!o.length)continue;
    win[o[0]]++;for(let i=0;i<Math.min(2,o.length);i++)top2[o[i]]++;for(let i=0;i<Math.min(3,o.length);i++)top3[o[i]]++;
    if(o.length>=2){const k=comboKey([o[0],o[1]]);q[k]=(q[k]||0)+1}
    if(o.length>=3){
      const pairs=[[o[0],o[1]],[o[0],o[2]],[o[1],o[2]]];for(const p of pairs){const k=comboKey(p);w[k]=(w[k]||0)+1}
      const tk=comboKey(o.slice(0,3));t[tk]=(t[tk]||0)+1;orders[o.join('-')]=(orders[o.join('-')]||0)+1
    }
  }
  const div=obj=>Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,v/n]));
  return {n,win:div(win),top2:div(top2),top3:div(top3),quinella:div(q),wide:div(w),trio:div(t),orders:div(orders)}
}
function relativeIndexScores(rows,weights){
  const keys=['ability','suitability','pace','jockey','form'],rel={};for(const x of rows)rel[x.h.number]={};
  for(const k of keys){
    const vals=rows.map(x=>Number(x.indices[k])||50),mean=vals.reduce((a,b)=>a+b,0)/vals.length,sd=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length)||1;
    rows.forEach((x,i)=>rel[x.h.number][k]=clamp(50+12*(vals[i]-mean)/sd,20,80))
  }
  return rel
}
function rank(r,opts={}){
  const history=opts.history||[],market=r.type||'central',wf=weightWalkForward(history,market),weights=wf.weights||BASE_MODEL_WEIGHTS_112;
  let rows=r.horses.map(h=>{const indices=sixIndices(h,r),score=modelScore(indices,BASE_MODEL_WEIGHTS_112);return {h,auto:indices,indices,score,grade:overallGrade(score),odds:h.odds||null}});
  const rel=relativeIndexScores(rows,weights);
  rows=rows.map(x=>{
    const abs=modelScore(x.indices,weights),relScore=Object.entries(normalizeWeights(weights)).reduce((s,[k,v])=>s+(rel[x.h.number][k]||50)*v,0),latent=.56*abs+.44*relScore;
    return {...x,absoluteScore:abs,relativeScore:relScore,rating:latent/10}
  }).sort((a,b)=>b.rating-a.rating);
  const max=Math.max(...rows.map(x=>x.rating)),raw=rows.map(x=>Math.exp((x.rating-max)/1.22)),sum=raw.reduce((a,b)=>a+b,0),avgConf=rows.reduce((z,x)=>z+x.auto.confidence,0)/Math.max(rows.length,1),alpha=.32+.55*avgConf;
  let base=raw.map(x=>x/sum),uniform=1/rows.length;base=base.map(p=>alpha*p+(1-alpha)*uniform);
  const calWin=calibrationSamples(history,market,'pWin');base=rescaleProbabilities(base.map(p=>calibrateOne(p,calWin)),1);
  rows.forEach((x,i)=>x.baseProb=base[i]);
  const seed=hashSeed([r.date,r.courseName,r.raceNo,r.name].join('|')),sim=simulateRace(rows,SIMULATIONS_112,seed);
  const cal2=calibrationSamples(history,market,'pTop2'),cal3=calibrationSamples(history,market,'pTop3');
  let p2=rows.map(x=>sim.top2[x.h.number]||0),p3=rows.map(x=>sim.top3[x.h.number]||0);
  p2=rescaleProbabilities(p2.map(p=>calibrateOne(p,cal2)),Math.min(2,rows.length));p3=rescaleProbabilities(p3.map(p=>calibrateOne(p,cal3)),Math.min(3,rows.length));
  rows=rows.map((x,i)=>{const p=base[i],ev=x.odds?p*x.odds:null,v=valueIndex(ev);return {...x,prob:p,pWin:p,pTop2:p2[i],pTop3:p3[i],ev,indices:{...x.indices,value:v}}});
  // Marginal calibration adjustment for combination probabilities.
  const adjMap=(obj,target,rawTarget,size)=>{const out={};for(const [k,p] of Object.entries(obj)){const ns=k.split('-').map(Number);let f=1;for(const no of ns){const i=rows.findIndex(x=>x.h.number===no),den=Math.max(1e-6,rawTarget[no]||0),num=Math.max(1e-6,target[i]||0);f*=num/den}f=Math.pow(f,1/size);out[k]=clamp(p*f,0,1)}return out};
  sim.quinella=adjMap(sim.quinella,p2,sim.top2,2);sim.wide=adjMap(sim.wide,p3,sim.top3,2);sim.trio=adjMap(sim.trio,p3,sim.top3,3);
  rows.simulation=sim;rows.modelMeta={simulations:SIMULATIONS_112,weights,weightWalkForward:wf,calibrationSamples:{win:calWin.length,top2:cal2.length,top3:cal3.length},market};
  return rows.sort((a,b)=>b.rating-a.rating)
}
function combinationAdvice(rows,comboOdds={},threshold=1.10){
  const sim=rows.simulation||null,by={};rows.forEach(x=>by[x.h.number]=x.prob);const nos=rows.map(x=>x.h.number),q=[],w=[],t=[];
  for(let i=0;i<nos.length;i++)for(let j=i+1;j<nos.length;j++){
    const a=nos[i],b=nos[j],key=comboKey([a,b]),qp=sim?.quinella?.[key]??quinellaProb(a,b,by),wp=sim?.wide?.[key]??wideProb(a,b,by),qo=comboOdds.quinella?.[key]??null,wo=comboOdds.wide?.[key]??null;
    q.push({type:'馬複',key,numbers:[a,b],prob:qp,odds:qo,ev:qo?qp*qo:null,need:threshold/Math.max(qp,1e-9)});
    w.push({type:'ワイド',key,numbers:[a,b],prob:wp,odds:wo,ev:wo?wp*wo:null,need:threshold/Math.max(wp,1e-9)})
  }
  for(let i=0;i<nos.length;i++)for(let j=i+1;j<nos.length;j++)for(let k=j+1;k<nos.length;k++){
    const a=nos[i],b=nos[j],c=nos[k],key=comboKey([a,b,c]),p=sim?.trio?.[key]??trioProb(a,b,c,by),o=comboOdds.trio?.[key]??null;
    t.push({type:'三連複',key,numbers:[a,b,c],prob:p,odds:o,ev:o?p*o:null,need:threshold/Math.max(p,1e-9)})
  }
  const sort=x=>x.sort((a,b)=>(b.ev??-1)-(a.ev??-1)||b.prob-a.prob);return {quinella:sort(q),wide:sort(w),trio:sort(t),threshold}
}
function ticketThresholdStats(entries,type,th){
  let n=0,h=0,stake=0,payout=0;for(const x of entries||[]){const res=historyResult(x);for(const t of allSuggestedTickets(x)){if(canonType(t.type)!==type||t.ev==null||Number(t.ev)<th)continue;const g=ticketGrade(t,res),o=Number(t.odds);if(g==null||!Number.isFinite(o)||o<1)continue;n++;stake+=100;if(g){h++;payout+=100*o}}}
  return {n,h,rate:n?h/n:null,roi:stake?payout/stake:null}
}
function learnTicketThresholds(history,market){
  const entries=(history||[]).filter(x=>/^1\.(12|13|14|15|16)/.test(String(x.modelVersion||''))&&historyResult(x).first!=null&&(market?((x.market||x.type)===market):true)).slice().sort((a,b)=>String(a.date||a.createdAt||a.id).localeCompare(String(b.date||b.createdAt||b.id)));
  const out={};for(const [type,def] of Object.entries(DEFAULT_TICKET_THRESHOLDS_112))out[type]={threshold:def,learned:false,races:entries.length};
  if(entries.length<25)return out;
  const cut=Math.max(18,Math.floor(entries.length*.7)),train=entries.slice(0,cut),test=entries.slice(cut),grid=[1.05,1.10,1.15,1.20,1.25,1.30,1.40,1.50,1.70];
  for(const [type,def] of Object.entries(DEFAULT_TICKET_THRESHOLDS_112)){
    const candidates=grid.map(th=>({th,...ticketThresholdStats(train,type,th)})).filter(x=>x.n>=10&&x.roi!=null).sort((a,b)=>(b.roi*(.85+.15*(b.rate||0)))-(a.roi*(.85+.15*(a.rate||0))));
    if(!candidates.length)continue;
    const best=candidates[0],val=ticketThresholdStats(test,type,best.th);
    if(val.n>=5&&val.roi!=null&&val.roi>=.95){out[type]={threshold:Math.max(def,best.th),learned:true,races:entries.length,train:best,validation:val}}
  }
  return out
}
function ticketRecommendations(rows,comboOdds={},thresholds=DEFAULT_TICKET_THRESHOLDS_112){
  if(typeof thresholds==='number')thresholds={'単勝':thresholds,'ワイド':thresholds,'馬複':thresholds,'三連複':thresholds};
  const ba=combinationAdvice(rows,comboOdds,1.20);
  const single=rows.slice(0,5).map(x=>({type:'単勝',key:String(x.h.number),numbers:[x.h.number],prob:x.pWin,odds:x.odds,ev:x.ev,need:(thresholds['単勝']||1.12)/Math.max(x.pWin,1e-9)}))
    .sort((a,b)=>(b.prob*Math.pow(Math.max(.8,b.ev??1),.25))-(a.prob*Math.pow(Math.max(.8,a.ev??1),.25))).slice(0,2);
  const top=rows.slice(0,5).map(x=>x.h.number),a=top[0],b=top[1],c=top[2],d=top[3],e=top[4];
  const key2=(x,y)=>x!=null&&y!=null?comboKey([x,y]):'',key3=(x,y,z)=>x!=null&&y!=null&&z!=null?comboKey([x,y,z]):'';
  const wideAllowed=new Set([key2(a,b),key2(a,c),key2(b,c),key2(a,d),key2(b,d)]);
  const qAllowed=new Set([key2(a,b),key2(a,c),key2(b,c),key2(a,d)]);
  const tAllowed=new Set([key3(a,b,c),key3(a,b,d),key3(a,c,d),key3(b,c,d),key3(a,b,e)]);
  const stable=x=>Math.max(x.prob,1e-9)*Math.pow(clamp(x.ev??1,.75,2),.22);
  const choose=(arr,set,n)=>arr.filter(x=>set.has(x.key)).sort((x,y)=>stable(y)-stable(x)).slice(0,n);
  return {single,wide:choose(ba.wide,wideAllowed,3),quinella:choose(ba.quinella,qAllowed,2),trio:choose(ba.trio,tAllowed,1)}
}
function portfolioHitProbability(tickets,rows){
  if(!tickets?.length)return 0;const ord=rows.simulation?.orders;if(ord&&Object.keys(ord).length){let sum=0;for(const [k,p] of Object.entries(ord)){const o=k.split('-').map(Number);if(tickets.some(t=>ticketHitOrder(t,o)))sum+=p}return clamp(sum,0,1)}
  const by={};rows.forEach(x=>by[x.h.number]=x.prob);const ns=rows.map(x=>x.h.number);let sum=0;for(const a of ns)for(const b of ns)if(b!==a)for(const c of ns)if(c!==a&&c!==b){const o=[a,b,c],p=orderProb(o,by);if(tickets.some(t=>ticketHitOrder(t,o)))sum+=p}return clamp(sum,0,1)
}
function targetPlan(rows,comboOdds={},opts={}){
  const budget=Math.max(100,Math.floor((Number(opts.budget)||1000)/100)*100),targetRoi=Number(opts.targetRoi)||1.20,targetHit=Number(opts.targetHit)||.70,maxTickets=Math.max(1,Math.min(5,Math.floor(budget/100))),market=opts.market||rows.modelMeta?.market||'central',history=opts.history||[];
  const learned=learnTicketThresholds(history,market),thresholds=Object.fromEntries(Object.entries(learned).map(([k,v])=>[k,v.threshold])),rec=ticketRecommendations(rows,comboOdds,thresholds),anchor=rows[0]?.h.number,top4=new Set(rows.slice(0,4).map(x=>x.h.number));
  const minProb={'単勝':.07,'ワイド':.18,'馬複':.06,'三連複':.025};
  let pool=[...rec.single,...rec.wide,...rec.quinella,...rec.trio].filter(x=>x.odds!=null&&x.ev!=null&&x.ev>=(thresholds[canonType(x.type)]||1.2)&&x.prob>=(minProb[canonType(x.type)]||0));
  pool=pool.filter(x=>x.type==='単勝'||x.numbers.includes(anchor)||x.numbers.every(n=>top4.has(n))).sort((a,b)=>b.prob-a.prob||b.ev-a.ev);
  const chosen=[],caps={'単勝':1,'ワイド':2,'馬複':2,'三連複':1},counts={};
  while(chosen.length<maxTickets){
    let best=null,bestHit=portfolioHitProbability(chosen,rows),gain=0;
    for(const c of pool){if(chosen.includes(c)||(counts[canonType(c.type)]||0)>=caps[canonType(c.type)])continue;const hp=portfolioHitProbability([...chosen,c],rows),g=hp-bestHit,score=g*.80+(Math.max(0,c.ev-1))*.02;if(score>gain+1e-9){best=c;gain=score;bestHit=hp}}
    if(!best)break;chosen.push(best);counts[canonType(best.type)]=(counts[canonType(best.type)]||0)+1;if(bestHit>=targetHit)break
  }
  const hitProb=portfolioHitProbability(chosen,rows),roi=chosen.length?chosen.reduce((z,x)=>z+x.ev,0)/chosen.length:null,meets=chosen.length>0&&hitProb>=targetHit&&roi>=targetRoi;
  const tickets=meets?chosen.map(x=>({...x,amount:100})):[];
  return {tickets,bestEffort:chosen,recommendations:rec,budget,targetRoi,targetHit,hitProb,roi,meets,anchor,confidence:rows.reduce((z,x)=>z+(x.auto?.confidence||0),0)/Math.max(rows.length,1),stance:meets?'購入候補あり':'見送り',thresholds,thresholdLearning:learned}
}
function realisticBets(rows,comboOdds={},opts={}){return targetPlan(rows,comboOdds,{...opts,targetRoi:opts.targetRoi||1.20,targetHit:opts.targetHit||.70})}
function rankingDiagnostics(history){
  let n1=0,h1=0,n2=0,h2=0,n3=0,h3=0,nTwo=0,hTwo=0,nAll=0,hAll=0,nQ=0,hQ=0;
  for(const x of history||[]){
    const r=historyResult(x),top=aiTop3(x);if(!r.first||!top.length)continue;
    n1++;if(top[0]&&Number(top[0].number)===r.first)h1++;
    if(top.length>=2){n2++;if(top.slice(0,2).some(z=>Number(z.number)===r.first))h2++;if(r.second){nQ++;const a=top.slice(0,2).map(z=>Number(z.number)).sort((a,b)=>a-b),b=[r.first,r.second].sort((a,b)=>a-b);if(a[0]===b[0]&&a[1]===b[1])hQ++}}
    if(top.length>=3){n3++;if(top.slice(0,3).some(z=>Number(z.number)===r.first))h3++;if(r.second&&r.third){const ai=new Set(top.slice(0,3).map(z=>Number(z.number))),act=new Set([r.first,r.second,r.third]);let c=0;for(const no of ai)if(act.has(no))c++;nTwo++;if(c>=2)hTwo++;nAll++;if(c===3)hAll++}}
  }
  const q=(h,n)=>n?h/n:null;
  return {top1Win:q(h1,n1),top2Winner:q(h2,n2),top3Winner:q(h3,n3),top3AtLeast2:q(hTwo,nTwo),top3All:q(hAll,nAll),top2Quinella:q(hQ,nQ),counts:{n1,n2,n3,nTwo,nAll,nQ}}
}
function calibrationStatus(history,market){
  return {win:calibrationSamples(history,market,'pWin').length,top2:calibrationSamples(history,market,'pTop2').length,top3:calibrationSamples(history,market,'pTop3').length}
}
function currentModelHistory(history,prefix='1.12'){return (history||[]).filter(x=>String(x?.modelVersion||'').startsWith(prefix))}

// ============================================================
// v1.13 — separate win / top2 / top3 models + ticket-specific ranks
// ============================================================
const ROLE_BASE_WEIGHTS_113={
  win:{ability:.38,suitability:.17,pace:.18,jockey:.08,form:.19},
  top2:{ability:.31,suitability:.23,pace:.15,jockey:.09,form:.22},
  top3:{ability:.24,suitability:.29,pace:.18,jockey:.08,form:.21}
};
function roleTargetSet(result,role){
  if(role==='win')return new Set([Number(result.first)].filter(Boolean));
  if(role==='top2')return new Set([Number(result.first),Number(result.second)].filter(Boolean));
  return new Set([Number(result.first),Number(result.second),Number(result.third)].filter(Boolean))
}
function roleForecastEntries(history,market){
  return (history||[]).filter(x=>{
    const r=historyResult(x);
    return r.first!=null&&forecastRows(x).length>=3&&(market?((x.market||x.type)===market):true)
  }).map(x=>({...x,aiForecast:forecastRows(x)})).sort((a,b)=>String(a.date||a.createdAt||a.id).localeCompare(String(b.date||b.createdAt||b.id)))
}
function roleWeightsBase(role){return normalizeWeights(ROLE_BASE_WEIGHTS_113[role]||ROLE_BASE_WEIGHTS_113.win)}
function learnRoleWeights(entries,role){
  const keys=['ability','suitability','pace','jockey','form'],lifts=Object.fromEntries(keys.map(k=>[k,[]]));
  for(const x of entries||[]){
    const f=x.aiForecast||[],targets=roleTargetSet(historyResult(x),role);if(!targets.size||f.length<3)continue;
    for(const k of keys){
      const vals=f.map(z=>Number(z.indices?.[k])).filter(Number.isFinite);if(vals.length<3)continue;
      const mean=vals.reduce((a,b)=>a+b,0)/vals.length,sd=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length)||1;
      const pos=f.filter(z=>targets.has(Number(z.number))&&Number.isFinite(Number(z.indices?.[k]))).map(z=>(Number(z.indices[k])-mean)/sd);
      if(pos.length)lifts[k].push(pos.reduce((a,b)=>a+b,0)/pos.length)
    }
  }
  const base=roleWeightsBase(role),raw={};
  for(const k of keys){
    const a=lifts[k],lift=a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
    raw[k]=base[k]*Math.exp(clamp(lift,-1.2,1.2)*.34)
  }
  return normalizeWeights(raw)
}
function scoreForecastRole(z,w){return Object.entries(normalizeWeights(w)).reduce((s,[k,v])=>s+(Number(z.indices?.[k])||50)*v,0)}
function evaluateRole(entries,w,role){
  let n=0,hit=0,totalCredit=0;
  for(const x of entries||[]){
    const f=(x.aiForecast||[]).slice().sort((a,b)=>scoreForecastRole(b,w)-scoreForecastRole(a,w)),r=historyResult(x),targets=roleTargetSet(r,role);
    if(!targets.size||f.length<3)continue;
    if(role==='win'){
      n++;if(targets.has(Number(f[0]?.number)))hit++
    }else{
      const k=role==='top2'?2:3,selected=new Set(f.slice(0,k).map(z=>Number(z.number)));
      let c=0;for(const no of targets)if(selected.has(no))c++;
      n++;totalCredit+=c/Math.max(1,targets.size);if(c===targets.size)hit++
    }
  }
  return {n,h:hit,rate:n?hit/n:null,credit:n?totalCredit/n:null}
}
function roleWeightWalkForward(history,market,role){
  const e=roleForecastEntries(history,market),base=roleWeightsBase(role);
  if(e.length<30)return {enough:false,races:e.length,weights:base,role};
  const cut=Math.max(20,Math.floor(e.length*.7)),train=e.slice(0,cut),test=e.slice(cut),learned=learnRoleWeights(train,role),
        baseEval=evaluateRole(test,base,role),learnEval=evaluateRole(test,learned,role);
  const baseMetric=role==='win'?baseEval.rate:baseEval.credit,learnMetric=role==='win'?learnEval.rate:learnEval.credit;
  const usable=learnEval.n>=8&&learnMetric!=null&&baseMetric!=null&&learnMetric>=baseMetric-.005;
  const blend=usable?clamp((e.length-30)/120,0,.50):0,weights={};
  for(const k of Object.keys(base))weights[k]=base[k]*(1-blend)+learned[k]*blend;
  return {enough:true,races:e.length,train:train.length,test:test.length,learned,baseEval,learnEval,usable,blend,weights:normalizeWeights(weights),role}
}
function finishConsistency(h){
  const vals=(h.recent||[]).slice(0,6).map(x=>finishScore(x)).filter(Number.isFinite);
  if(vals.length<2)return {score:50,samples:vals.length};
  const mean=vals.reduce((a,b)=>a+b,0)/vals.length,sd=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length);
  return {score:clamp(Math.round(50+(mean-5)*5-sd*4),25,78),samples:vals.length}
}
function archiveBucketAvg(v){return Array.isArray(v)&&Number(v[0])>0?Number(v[1])/Number(v[0]):null}
function archiveConditionSignal(h,r){
  const a=h?.archiveSummary;if(!a||Number(a.n)<1)return 0;
  const vals=[],add=(v,w)=>{if(Number.isFinite(Number(v)))vals.push({v:Number(v),w})};
  add(Number(a.perfSum)/Math.max(1,Number(a.n)),.30);
  add(archiveBucketAvg(a.surfaces?.[r.surface]),.20);
  add(archiveBucketAvg(a.courses?.[String(r.courseName||'').replace(/^Ｊ/, '')]),.20);
  add(archiveBucketAvg(a.distances?.[distanceBand(r.distance)]),.18);
  add(archiveBucketAvg(a.goings?.[r.going]),.12);
  if(!vals.length)return 0;
  const avg=weightedCustom(vals)??5;
  return clamp((avg-5)*1.15,-2.5,2.5)
}
function roleScoreForRow(x,role,w,r,relative){
  const abs=Object.entries(normalizeWeights(w)).reduce((s,[k,v])=>s+(Number(x.indices?.[k])||50)*v,0);
  const rel=Object.entries(normalizeWeights(w)).reduce((s,[k,v])=>s+(Number(relative?.[x.h.number]?.[k])||50)*v,0);
  let score=.55*abs+.45*rel;
  const st=styleProfile(x.h),cons=finishConsistency(x.h),archiveSig=archiveConditionSignal(x.h,r);
  if(role==='win'){
    score+=(Number(x.indices.ability)-50)*.035+(Number(x.indices.form)-50)*.025+archiveSig*.28;
    if(st.gain!=null&&st.gain>.10)score+=Math.min(3,st.gain*12)
  }else if(role==='top2'){
    score+=(cons.score-50)*.055+(Number(x.indices.suitability)-50)*.018+archiveSig*.45
  }else{
    score+=(cons.score-50)*.085+(Number(x.indices.suitability)-50)*.030+archiveSig*.62;
    if(st.early!=null&&st.early<=.42)score+=1.2
  }
  return score
}
function roleSoftmax(rows,roleScores,targetSum,temp=8.5){
  const vals=rows.map(x=>roleScores[x.h.number]),mx=Math.max(...vals),raw=vals.map(v=>Math.exp((v-mx)/temp)),sum=raw.reduce((a,b)=>a+b,0)||1;
  return rescaleProbabilities(raw.map(v=>v/sum),Math.min(targetSum,rows.length))
}
function rescaleWithFloor(vals,target,floors){
  let a=vals.map((v,i)=>clamp(Math.max(Number(v)||0,Number(floors?.[i])||0),0,1)),sum=a.reduce((s,v)=>s+v,0);
  if(sum<target){
    for(let z=0;z<6&&sum<target-.000001;z++){
      const room=a.map(v=>1-v),rs=room.reduce((s,v)=>s+v,0);if(!rs)break;
      const add=target-sum;a=a.map((v,i)=>clamp(v+add*room[i]/rs,0,1));sum=a.reduce((s,v)=>s+v,0)
    }
  }else if(sum>target){
    for(let z=0;z<6&&sum>target+.000001;z++){
      const room=a.map((v,i)=>Math.max(0,v-(Number(floors?.[i])||0))),rs=room.reduce((s,v)=>s+v,0);if(!rs)break;
      const sub=sum-target;a=a.map((v,i)=>Math.max(Number(floors?.[i])||0,v-sub*room[i]/rs));sum=a.reduce((s,v)=>s+v,0)
    }
  }
  return a
}
function enforceMarginals(p1,p2,p3,n){
  p1=rescaleProbabilities(p1,Math.min(1,n));
  p2=rescaleWithFloor(p2,Math.min(2,n),p1);
  p3=rescaleWithFloor(p3,Math.min(3,n),p2);
  return {p1,p2,p3}
}
function simulateRaceRole(rows,n=SIMULATIONS_112,seed=1){
  const nums=rows.map(x=>x.h.number),ww={},w2={},w3={};
  for(const x of rows){
    ww[x.h.number]=Math.max(1e-7,Number(x.roleBaseWin)||1/rows.length);
    w2[x.h.number]=Math.max(1e-7,Number(x.roleBaseTop2)||2/rows.length);
    w3[x.h.number]=Math.max(1e-7,Number(x.roleBaseTop3)||3/rows.length)
  }
  const win={},top2={},top3={},q={},w={},t={},orders={};for(const no of nums){win[no]=0;top2[no]=0;top3[no]=0}
  const rand=rng32(seed);
  for(let z=0;z<n;z++){
    const left=nums.slice(),o=[],picks=Math.min(3,left.length);
    if(picks>=1){const no=weightedPick(left,ww,rand);o.push(no);left.splice(left.indexOf(no),1)}
    if(picks>=2){const no=weightedPick(left,w2,rand);o.push(no);left.splice(left.indexOf(no),1)}
    if(picks>=3){const no=weightedPick(left,w3,rand);o.push(no);left.splice(left.indexOf(no),1)}
    if(!o.length)continue;
    win[o[0]]++;for(let i=0;i<Math.min(2,o.length);i++)top2[o[i]]++;for(let i=0;i<Math.min(3,o.length);i++)top3[o[i]]++;
    if(o.length>=2){const k=comboKey([o[0],o[1]]);q[k]=(q[k]||0)+1}
    if(o.length>=3){
      for(const pair of [[o[0],o[1]],[o[0],o[2]],[o[1],o[2]]]){const k=comboKey(pair);w[k]=(w[k]||0)+1}
      const tk=comboKey(o);t[tk]=(t[tk]||0)+1;orders[o.join('-')]=(orders[o.join('-')]||0)+1
    }
  }
  const div=obj=>Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,v/n]));
  return {n,win:div(win),top2:div(top2),top3:div(top3),quinella:div(q),wide:div(w),trio:div(t),orders:div(orders)}
}
function rank(r,opts={}){
  const history=opts.history||[],market=r.type||'central';
  const rwWin=roleWeightWalkForward(history,market,'win'),rw2=roleWeightWalkForward(history,market,'top2'),rw3=roleWeightWalkForward(history,market,'top3');
  let rows=r.horses.map(h=>{const indices=sixIndices(h,r),score=modelScore(indices,BASE_MODEL_WEIGHTS_112);return {h,auto:indices,indices,score,grade:overallGrade(score),odds:h.odds||null}});
  const relWin=relativeIndexScores(rows,rwWin.weights),rel2=relativeIndexScores(rows,rw2.weights),rel3=relativeIndexScores(rows,rw3.weights);
  const sWin={},s2={},s3={};
  for(const x of rows){sWin[x.h.number]=roleScoreForRow(x,'win',rwWin.weights,r,relWin);s2[x.h.number]=roleScoreForRow(x,'top2',rw2.weights,r,rel2);s3[x.h.number]=roleScoreForRow(x,'top3',rw3.weights,r,rel3)}
  let b1=roleSoftmax(rows,sWin,1,7.8),b2=roleSoftmax(rows,s2,2,9.2),b3=roleSoftmax(rows,s3,3,10.2);
  rows.forEach((x,i)=>{x.roleBaseWin=b1[i];x.roleBaseTop2=b2[i];x.roleBaseTop3=b3[i];x.roleScores={win:sWin[x.h.number],top2:s2[x.h.number],top3:s3[x.h.number]}});

  const seed=hashSeed([r.date,r.courseName,r.raceNo,r.name,'v113'].join('|')),sim=simulateRaceRole(rows,SIMULATIONS_112,seed);
  const cal1=calibrationSamples(history,market,'pWin'),cal2=calibrationSamples(history,market,'pTop2'),cal3=calibrationSamples(history,market,'pTop3');
  let p1=rows.map(x=>sim.win[x.h.number]||0).map(p=>calibrateOne(p,cal1)),
      p2=rows.map(x=>sim.top2[x.h.number]||0).map(p=>calibrateOne(p,cal2)),
      p3=rows.map(x=>sim.top3[x.h.number]||0).map(p=>calibrateOne(p,cal3));
  ({p1,p2,p3}=enforceMarginals(p1,p2,p3,rows.length));

  rows=rows.map((x,i)=>{const ev=x.odds?p1[i]*x.odds:null;return {...x,prob:p1[i],pWin:p1[i],pTop2:p2[i],pTop3:p3[i],ev,indices:{...x.indices,value:valueIndex(ev)}}});
  const winOrder=rows.slice().sort((a,b)=>b.pWin-a.pWin),twoOrder=rows.slice().sort((a,b)=>b.pTop2-a.pTop2),threeOrder=rows.slice().sort((a,b)=>b.pTop3-a.pTop3);
  const wr=new Map(winOrder.map((x,i)=>[x.h.number,i+1])),r2=new Map(twoOrder.map((x,i)=>[x.h.number,i+1])),r3=new Map(threeOrder.map((x,i)=>[x.h.number,i+1]));
  rows=rows.map(x=>({...x,roleRanks:{win:wr.get(x.h.number),top2:r2.get(x.h.number),top3:r3.get(x.h.number)}}));

  const adjMap=(obj,target,rawTarget,size)=>{const out={};for(const [k,p] of Object.entries(obj)){const ns=k.split('-').map(Number);let f=1;for(const no of ns){const i=rows.findIndex(x=>x.h.number===no),den=Math.max(1e-6,rawTarget[no]||0),num=Math.max(1e-6,target[i]||0);f*=num/den}out[k]=clamp(p*Math.pow(f,1/size),0,1)}return out};
  sim.quinella=adjMap(sim.quinella,p2,sim.top2,2);sim.wide=adjMap(sim.wide,p3,sim.top3,2);sim.trio=adjMap(sim.trio,p3,sim.top3,3);

  rows.simulation=sim;
  rows.roleOrders={win:winOrder.map(x=>x.h.number),top2:twoOrder.map(x=>x.h.number),top3:threeOrder.map(x=>x.h.number)};
  rows.modelMeta={simulations:SIMULATIONS_112,market,roleWeights:{win:rwWin.weights,top2:rw2.weights,top3:rw3.weights},roleWalkForward:{win:rwWin,top2:rw2,top3:rw3},calibrationSamples:{win:cal1.length,top2:cal2.length,top3:cal3.length}};
  return rows.sort((a,b)=>a.roleRanks.win-b.roleRanks.win)
}
function ticketRecommendations(rows,comboOdds={},thresholds=DEFAULT_TICKET_THRESHOLDS_112){
  if(typeof thresholds==='number')thresholds={'単勝':thresholds,'ワイド':thresholds,'馬複':thresholds,'三連複':thresholds};
  const ba=combinationAdvice(rows,comboOdds,1.20),byKey=arr=>new Map(arr.map(x=>[x.key,x]));
  const fallbackRank=x=>Math.max(1,rows.indexOf(x)+1),rv=(x,k)=>Number(x?.roleRanks?.[k])||fallbackRank(x);
  const win=rows.slice().sort((a,b)=>rv(a,'win')-rv(b,'win')),
        top2=rows.slice().sort((a,b)=>rv(a,'top2')-rv(b,'top2')),
        top3=rows.slice().sort((a,b)=>rv(a,'top3')-rv(b,'top3'));
  const single=win.slice(0,4).map(x=>({type:'単勝',key:String(x.h.number),numbers:[x.h.number],prob:Number(x.pWin??x.prob)||0,odds:x.odds,ev:x.ev,need:(thresholds['単勝']||1.12)/Math.max(Number(x.pWin??x.prob)||0,1e-9)}))
    .sort((a,b)=>(b.prob*Math.pow(Math.max(.8,b.ev??1),.22))-(a.prob*Math.pow(Math.max(.8,a.ev??1),.22))).slice(0,2);

  const wideMap=byKey(ba.wide),qMap=byKey(ba.quinella),tMap=byKey(ba.trio),key2=(a,b)=>comboKey([a,b]),key3=(a,b,c)=>comboKey([a,b,c]);
  const t3=top3.slice(0,6).map(x=>x.h.number),t2=top2.slice(0,5).map(x=>x.h.number),tw=win.slice(0,3).map(x=>x.h.number);
  const wideKeys=[];for(let i=0;i<t3.length;i++)for(let j=i+1;j<t3.length;j++)if(i<3||j<3)wideKeys.push(key2(t3[i],t3[j]));
  const qKeys=[];for(const a of tw)for(const b of t2)if(a!==b)qKeys.push(key2(a,b));
  const trioKeys=[];for(let i=0;i<t3.length;i++)for(let j=i+1;j<t3.length;j++)for(let k=j+1;k<t3.length;k++){const ns=[t3[i],t3[j],t3[k]],topFour=ns.filter(n=>t3.slice(0,4).includes(n)).length;if(topFour>=2)trioKeys.push(key3(...ns))}
  const stable=x=>Math.max(x?.prob||0,1e-9)*Math.pow(clamp(x?.ev??1,.75,2),.18);
  const uniqBest=(keys,map,n)=>[...new Set(keys)].map(k=>map.get(k)).filter(Boolean).sort((a,b)=>stable(b)-stable(a)).slice(0,n);
  return {single,wide:uniqBest(wideKeys,wideMap,3),quinella:uniqBest(qKeys,qMap,2),trio:uniqBest(trioKeys,tMap,1)}
}
function targetPlan(rows,comboOdds={},opts={}){
  const budget=Math.max(100,Math.floor((Number(opts.budget)||1000)/100)*100),targetRoi=Number(opts.targetRoi)||1.20,targetHit=Number(opts.targetHit)||.70,maxTickets=Math.max(1,Math.min(5,Math.floor(budget/100))),market=opts.market||rows.modelMeta?.market||'central',history=opts.history||[];
  const learned=learnTicketThresholds(history,market),thresholds=Object.fromEntries(Object.entries(learned).map(([k,v])=>[k,v.threshold])),rec=ticketRecommendations(rows,comboOdds,thresholds);
  const minProb={'単勝':.07,'ワイド':.18,'馬複':.06,'三連複':.025};
  let pool=[...rec.single,...rec.wide,...rec.quinella,...rec.trio].filter(x=>x.odds!=null&&x.ev!=null&&x.ev>=(thresholds[canonType(x.type)]||1.2)&&x.prob>=(minProb[canonType(x.type)]||0)).sort((a,b)=>b.prob-a.prob||b.ev-a.ev);
  const chosen=[],caps={'単勝':1,'ワイド':2,'馬複':2,'三連複':1},counts={};
  while(chosen.length<maxTickets){
    let best=null,bestHit=portfolioHitProbability(chosen,rows),gain=0;
    for(const c of pool){
      const typ=canonType(c.type);if(chosen.includes(c)||(counts[typ]||0)>=caps[typ])continue;
      const hp=portfolioHitProbability([...chosen,c],rows),g=hp-bestHit,score=g*.82+(Math.max(0,c.ev-1))*.018;
      if(score>gain+1e-9){best=c;gain=score;bestHit=hp}
    }
    if(!best)break;chosen.push(best);counts[canonType(best.type)]=(counts[canonType(best.type)]||0)+1;if(bestHit>=targetHit)break
  }
  const hitProb=portfolioHitProbability(chosen,rows),roi=chosen.length?chosen.reduce((z,x)=>z+x.ev,0)/chosen.length:null,meets=chosen.length>0&&hitProb>=targetHit&&roi>=targetRoi;
  const tickets=meets?chosen.map(x=>({...x,amount:100})):[];
  return {tickets,bestEffort:chosen,recommendations:rec,budget,targetRoi,targetHit,hitProb,roi,meets,anchor:rows.roleOrders?.win?.[0]??rows[0]?.h.number,confidence:rows.reduce((z,x)=>z+(x.auto?.confidence||0),0)/Math.max(rows.length,1),stance:meets?'購入候補あり':'見送り',thresholds,thresholdLearning:learned}
}
function rankingDiagnostics(history,prefix=null){
  const src=prefix?(history||[]).filter(x=>String(x.modelVersion||'').startsWith(prefix)):(history||[]);
  let n1=0,h1=0,n2=0,h2=0,n3=0,h3=0,nTwo=0,hTwo=0,nAll=0,hAll=0,nQ=0,hQ=0;
  for(const x of src){
    const r=historyResult(x),top=aiTop3(x);if(!r.first||!top.length)continue;
    n1++;if(top[0]&&Number(top[0].number)===r.first)h1++;
    if(top.length>=2){n2++;if(top.slice(0,2).some(z=>Number(z.number)===r.first))h2++;if(r.second){nQ++;const a=top.slice(0,2).map(z=>Number(z.number)).sort((a,b)=>a-b),b=[r.first,r.second].sort((a,b)=>a-b);if(a[0]===b[0]&&a[1]===b[1])hQ++}}
    if(top.length>=3){n3++;if(top.slice(0,3).some(z=>Number(z.number)===r.first))h3++;if(r.second&&r.third){const ai=new Set(top.slice(0,3).map(z=>Number(z.number))),act=new Set([r.first,r.second,r.third]);let c=0;for(const no of ai)if(act.has(no))c++;nTwo++;if(c>=2)hTwo++;nAll++;if(c===3)hAll++}}
  }
  const q=(h,n)=>n?h/n:null;return {top1Win:q(h1,n1),top2Winner:q(h2,n2),top3Winner:q(h3,n3),top3AtLeast2:q(hTwo,nTwo),top3All:q(hAll,nAll),top2Quinella:q(hQ,nQ),counts:{n1,n2,n3,nTwo,nAll,nQ}}
}
function roleRankingDiagnostics(history,prefix='1.13'){
  const src=(history||[]).filter(x=>!prefix||String(x.modelVersion||'').startsWith(prefix));
  let n=0,w1=0,n2=0,both2=0,n3=0,two3=0,all3=0;
  for(const x of src){
    const r=historyResult(x),rt=x.aiRoleTop;if(!r.first||!rt)continue;
    if(rt.win?.length){n++;if(Number(rt.win[0])===Number(r.first))w1++}
    if(r.second&&rt.top2?.length>=2){n2++;const s=new Set(rt.top2.slice(0,2).map(Number));if(s.has(Number(r.first))&&s.has(Number(r.second)))both2++}
    if(r.second&&r.third&&rt.top3?.length>=3){n3++;const s=new Set(rt.top3.slice(0,3).map(Number)),a=[r.first,r.second,r.third].map(Number);const c=a.filter(no=>s.has(no)).length;if(c>=2)two3++;if(c===3)all3++}
  }
  const q=(h,z)=>z?h/z:null;return {winTop1:q(w1,n),top2Exact:q(both2,n2),top3AtLeast2:q(two3,n3),top3All:q(all3,n3),counts:{n,n2,n3}}
}
function currentModelHistory(history,prefix='1.13'){return (history||[]).filter(x=>String(x?.modelVersion||'').startsWith(prefix))}

// ============================================================
// v1.16 — three bet types + empirical purchase filter + chaos
// ============================================================
const ACTIVE_TYPES_116=['単勝','馬複','ワイド'];
function raceChaosFeatures(rows,r={}){
  const a=rows.slice().sort((x,y)=>y.pWin-x.pWin),p1=Number(a[0]?.pWin)||0,p2=Number(a[1]?.pWin)||0,p3=Number(a[2]?.pWin)||0;
  const top3=p1+p2+p3,spread=p1-p2,n=Math.max(rows.length,2),entropy=-rows.reduce((s,x)=>{const p=Math.max(1e-9,Number(x.pWin)||0);return s+p*Math.log(p)},0)/Math.log(n);
  const odds=rows.map(x=>Number(x.odds)).filter(x=>Number.isFinite(x)&&x>=1),favOdds=odds.length?Math.min(...odds):null,front=rows.filter(x=>['逃げ','先行'].includes(x.indices?.style)).length;
  return {p1,p2,p3,top3,spread,field:rows.length,entropy,favOdds,front}
}
function predictChaos(rows,r={}){
  const f=raceChaosFeatures(rows,r);let s=0;
  s+=clamp((f.entropy-.72)/.20,0,1)*3.1+s*0;
  s+=clamp((.30-f.p1)/.18,0,1)*2.3;
  s+=clamp((.60-f.top3)/.28,0,1)*1.8;
  s+=clamp((.10-f.spread)/.09,0,1)*1.0;
  s+=clamp((f.field-12)/6,0,1)*1.1;
  if(f.favOdds!=null)s+=clamp((f.favOdds-2.2)/2.8,0,1)*1.0;
  if(f.front>=4)s+=.45;
  return {label:s>=5?'荒':s>=2.7?'中':'堅',score:+s.toFixed(2),features:f}
}
function empiricalContextKey(x){return {market:(x.market||x.type)==='local'?'地方':'中央',surf:x.surface||'不明',dist:distanceBand(x.distance),chaos:x.chaosLabel||'不明'}}
function empiricalTicketRows(history,type){
  const out=[];for(const x of history||[]){const ctx=empiricalContextKey(x),res=historyResult(x);for(const t of allSuggestedTickets(x)){if(canonType(t.type)!==canonType(type))continue;const g=ticketGrade(t,res);if(g==null)continue;const po=officialPayoutForTicket(x,t);out.push({ctx,hit:!!g,payout:po.amount,ev:Number(t.ev),prob:Number(t.prob)})}}return out
}
function empiricalGroupStats(rows,pred){
  let n=0,h=0,known=0,stake=0,payout=0;for(const x of rows){if(!pred(x))continue;n++;if(x.hit)h++;if(!x.hit){known++;stake+=100}else if(x.payout!=null){known++;stake+=100;payout+=x.payout}}
  return {n,h,rate:n?h/n:null,known,roi:stake?payout/stake:null}
}
function empiricalTicketGate(history,type,current={}){
  type=canonType(type);const rows=empiricalTicketRows(history,type),ctx=current.context||{},ev=Number(current.ev),prob=Number(current.prob)||0;
  const specs=[['同券種',x=>true,35],['同市場',x=>x.ctx.market===ctx.market,25],['同市場×芝ダ',x=>x.ctx.market===ctx.market&&x.ctx.surf===ctx.surf,18],['同荒れ度',x=>x.ctx.chaos===ctx.chaos,18],['同市場×荒れ度',x=>x.ctx.market===ctx.market&&x.ctx.chaos===ctx.chaos,12],['同距離帯',x=>x.ctx.dist===ctx.dist,18]];
  const evidence=[];for(const [name,pred,min] of specs){const z=empiricalGroupStats(rows,pred);if(z.n>=min)evidence.push({name,...z})}
  const known=evidence.filter(x=>x.roi!=null),weightedRoi=known.length?known.reduce((s,x)=>s+x.roi*Math.min(x.known,60),0)/known.reduce((s,x)=>s+Math.min(x.known,60),0):null;
  const weightedRate=evidence.length?evidence.reduce((s,x)=>s+(x.rate||0)*Math.min(x.n,60),0)/evidence.reduce((s,x)=>s+Math.min(x.n,60),0):null;
  let evReq=({'単勝':1.12,'馬複':1.28,'ワイド':1.22}[type]||1.25);if(weightedRoi!=null){if(weightedRoi>=1.15)evReq-=.04;else if(weightedRoi<.90)evReq+=.10;else if(weightedRoi<1)evReq+=.06}
  const minProb=({'単勝':.085,'馬複':.075,'ワイド':.20}[type]||0),pass=Number.isFinite(ev)&&ev>=evReq&&prob>=minProb&&(weightedRoi==null||weightedRoi>=.85||ev>=evReq+.08);
  return {pass,evReq:+evReq.toFixed(2),minProb,historyRows:rows.length,weightedRoi,weightedRate,evidence,enough:rows.length>=30}
}
function ticketRecommendations(rows,comboOdds={},thresholds=DEFAULT_TICKET_THRESHOLDS_112){
  if(typeof thresholds==='number')thresholds={'単勝':thresholds,'ワイド':thresholds,'馬複':thresholds};
  const ba=combinationAdvice(rows,comboOdds,1.20),map=a=>new Map(a.map(x=>[x.key,x])),fallback=x=>Math.max(1,rows.indexOf(x)+1),rv=(x,k)=>Number(x?.roleRanks?.[k])||fallback(x);
  const win=rows.slice().sort((a,b)=>rv(a,'win')-rv(b,'win')),top2=rows.slice().sort((a,b)=>rv(a,'top2')-rv(b,'top2')),top3=rows.slice().sort((a,b)=>rv(a,'top3')-rv(b,'top3'));
  const single=win.slice(0,4).map(x=>({type:'単勝',key:String(x.h.number),numbers:[x.h.number],prob:Number(x.pWin??x.prob)||0,odds:x.odds,ev:x.ev,need:(thresholds['単勝']||1.12)/Math.max(Number(x.pWin??x.prob)||0,1e-9)})).sort((a,b)=>b.prob-a.prob).slice(0,2);
  const wm=map(ba.wide),qm=map(ba.quinella),k2=(a,b)=>comboKey([a,b]),t3=top3.slice(0,6).map(x=>x.h.number),t2=top2.slice(0,5).map(x=>x.h.number),tw=win.slice(0,3).map(x=>x.h.number),wk=[],qk=[];
  for(let i=0;i<t3.length;i++)for(let j=i+1;j<t3.length;j++)if(i<3||j<3)wk.push(k2(t3[i],t3[j]));for(const a of tw)for(const b of t2)if(a!==b)qk.push(k2(a,b));
  const score=x=>Math.max(x?.prob||0,1e-9)*Math.pow(clamp(x?.ev??1,.75,2),.16),best=(keys,m,n)=>[...new Set(keys)].map(k=>m.get(k)).filter(Boolean).sort((a,b)=>score(b)-score(a)).slice(0,n);
  return {single,wide:best(wk,wm,3),quinella:best(qk,qm,2),trio:[]}
}
function targetPlan(rows,comboOdds={},opts={}){
  const budget=Math.max(100,Math.floor((Number(opts.budget)||1000)/100)*100),history=opts.history||[],market=opts.market||rows.modelMeta?.market||'central',race=opts.race||{},chaos=opts.chaos||predictChaos(rows,race),maxTickets=Math.min(5,Math.floor(budget/100));
  const learned=learnTicketThresholds(history,market),thresholds=Object.fromEntries(ACTIVE_TYPES_116.map(k=>[k,Number(learned?.[k]?.threshold)||({'単勝':1.12,'馬複':1.28,'ワイド':1.22}[k])])),rec=ticketRecommendations(rows,comboOdds,thresholds),ctx={market:market==='local'?'地方':'中央',surf:race.surface||'不明',dist:distanceBand(race.distance),chaos:chaos.label};
  let pool=[...rec.single,...rec.wide,...rec.quinella].map(x=>({...x,empiricalGate:empiricalTicketGate(history,x.type,{context:ctx,ev:x.ev,prob:x.prob})})).filter(x=>x.odds!=null&&x.ev!=null&&x.empiricalGate.pass).sort((a,b)=>b.prob-a.prob||b.ev-a.ev);
  const chosen=[],caps={'単勝':1,'ワイド':2,'馬複':2},counts={};while(chosen.length<maxTickets){let best=null,bestHit=portfolioHitProbability(chosen,rows),bestScore=0;for(const c of pool){const typ=canonType(c.type);if(chosen.includes(c)||(counts[typ]||0)>=caps[typ])continue;const hp=portfolioHitProbability([...chosen,c],rows),gain=hp-bestHit,hb=clamp((c.empiricalGate.weightedRoi??1)-1,-.3,.4),sc=gain*.80+Math.max(0,c.ev-1)*.015+hb*.03;if(sc>bestScore){best=c;bestScore=sc;bestHit=hp}}if(!best)break;chosen.push(best);counts[canonType(best.type)]=(counts[canonType(best.type)]||0)+1;if(chosen.length>=2&&bestScore<.025)break}
  const hitProb=portfolioHitProbability(chosen,rows),roi=chosen.length?chosen.reduce((s,x)=>s+x.ev,0)/chosen.length:null,meets=chosen.length>0&&roi!=null&&roi>=1.12,tickets=meets?chosen.map(x=>({...x,amount:100})):[];
  return {tickets,bestEffort:chosen,recommendations:rec,budget,targetRoi:.20+1,targetHit:.70,hitProb,roi,meets,anchor:rows.roleOrders?.win?.[0]??rows[0]?.h.number,confidence:rows.reduce((s,x)=>s+(x.auto?.confidence||0),0)/Math.max(rows.length,1),stance:meets?'購入候補あり':'見送り',chaos,empiricalContext:ctx,thresholds}
}
function realisticBets(rows,comboOdds={},opts={}){return targetPlan(rows,comboOdds,opts)}
function allTypeAccuracy(history){return ACTIVE_TYPES_116.map(type=>typeAccuracy(history,type))}

// ============================================================
// v1.17 — win/place main + daily exact stats
// ============================================================
const ACTIVE_TYPES_117=['単勝','複勝','馬複','ワイド'];

function canonType(t){
  if(t==='馬連')return '馬複';
  if(t==='複')return '複勝';
  return t
}
function ticketGrade(t,result){
  const type=canonType(t?.type),nums=[...new Set(ticketNumbers(t).map(Number).filter(Number.isFinite))],r=result||{};
  const first=Number(r.first)||null,second=Number(r.second)||null,third=Number(r.third)||null;
  if(type==='単勝'){if(!first||nums.length<1)return null;return nums[0]===first}
  if(type==='複勝'){if(!first||!second||!third||nums.length<1)return null;return [first,second,third].includes(nums[0])}
  if(type==='馬複'){if(!first||!second||nums.length<2)return null;const a=nums.slice(0,2).sort((x,y)=>x-y),b=[first,second].sort((x,y)=>x-y);return a[0]===b[0]&&a[1]===b[1]}
  if(type==='ワイド'){if(!first||!second||!third||nums.length<2)return null;const top=new Set([first,second,third]);return top.has(nums[0])&&top.has(nums[1])}
  if(type==='三連複'){if(!first||!second||!third||nums.length<3)return null;const a=nums.slice(0,3).sort((x,y)=>x-y),b=[first,second,third].sort((x,y)=>x-y);return a.every((v,i)=>v===b[i])}
  return null
}
function ticketHitOrder(t,o){
  const type=canonType(t?.type),n=t.numbers||[];
  if(type==='単勝')return o[0]===n[0];
  if(type==='複勝')return o.slice(0,3).includes(n[0]);
  if(type==='馬複'){const a=[o[0],o[1]].sort((x,y)=>x-y),b=n.slice(0,2).sort((x,y)=>x-y);return a[0]===b[0]&&a[1]===b[1]}
  if(type==='ワイド')return o.slice(0,3).includes(n[0])&&o.slice(0,3).includes(n[1]);
  if(type==='三連複'){const a=o.slice(0,3).sort((x,y)=>x-y),b=n.slice(0,3).sort((x,y)=>x-y);return a.every((v,i)=>v===b[i])}
  return false
}
function parseOfficialPayoutText(text){
  const out={};
  for(const raw of String(text||'').split(/[\n,、]+/)){
    const s=raw.trim();if(!s)continue;
    const m=s.match(/^(単勝|複勝|ワイド|馬複|馬連|三連複)\s*[:：]\s*([0-9０-９\-－−]+)\s*=\s*([0-9０-９,，]+)\s*$/);
    if(!m)continue;
    const typ=canonType(m[1]),nums=fwDigits(m[2]).split(/[-－−]/).map(Number).filter(Number.isFinite),amt=Number(fwDigits(m[3]).replace(/[，,]/g,''));
    if(nums.length&&Number.isFinite(amt)&&amt>=0)out[payoutKey(typ,nums)]=amt
  }
  return out
}
function parseRefundText(text){
  const out=[];
  for(const raw of String(text||'').split(/[\n,、]+/)){
    const s=raw.trim();if(!s)continue;
    const m=s.match(/^(?:返還\s*[:：]\s*)?(単勝|複勝|ワイド|馬複|馬連|三連複)\s*[:：]\s*([0-9０-９\-－−]+)$/);
    if(!m)continue;
    const typ=canonType(m[1]),nums=fwDigits(m[2]).split(/[-－−]/).map(Number).filter(Number.isFinite);
    if(nums.length)out.push(payoutKey(typ,nums))
  }
  return [...new Set(out)]
}
function parsePlaceOddsTables(tables){
  const out={};
  for(const table of tables||[]){
    for(const row of table||[]){
      const c=row.map(norm),ni=c.findIndex(x=>/^\d{1,2}$/.test(x));
      if(ni<0)continue;
      const no=Number(c[ni]);if(!Number.isFinite(no))continue;
      for(let j=ni+1;j<c.length;j++){
        const m=c[j].replace(/[－−–—~]/g,'～').match(/(\d+(?:\.\d+)?)\s*～\s*(\d+(?:\.\d+)?)/);
        if(m){
          const lo=Number(m[1]),hi=Number(m[2]);
          if(lo>=1&&hi>=lo&&hi<=999.9){out[no]=lo;break}
        }
      }
    }
  }
  return out
}
function mergeOdds(r,p){
  const win={...parseOddsText(p.oddsText),...parseOddsTables(p.oddsTables)},
        place={...(p.placeOdds||{}),...parsePlaceOddsTables(p.oddsTables)};
  for(const h of r.horses){
    if(win[h.number]!=null)h.odds=win[h.number];
    if(place[h.number]!=null)h.placeOdds=place[h.number]
  }
  mergeComboOdds(r,p)
}

function empiricalTicketGate(history,type,current={}){
  type=canonType(type);const rows=empiricalTicketRows(history,type),ctx=current.context||{},ev=Number(current.ev),prob=Number(current.prob)||0;
  const specs=[['同券種',x=>true,35],['同市場',x=>x.ctx.market===ctx.market,25],['同市場×芝ダ',x=>x.ctx.market===ctx.market&&x.ctx.surf===ctx.surf,18],['同荒れ度',x=>x.ctx.chaos===ctx.chaos,18],['同市場×荒れ度',x=>x.ctx.market===ctx.market&&x.ctx.chaos===ctx.chaos,12],['同距離帯',x=>x.ctx.dist===ctx.dist,18]];
  const evidence=[];for(const [name,pred,min] of specs){const z=empiricalGroupStats(rows,pred);if(z.n>=min)evidence.push({name,...z})}
  const known=evidence.filter(x=>x.roi!=null),weightedRoi=known.length?known.reduce((s,x)=>s+x.roi*Math.min(x.known,60),0)/known.reduce((s,x)=>s+Math.min(x.known,60),0):null;
  const weightedRate=evidence.length?evidence.reduce((s,x)=>s+(x.rate||0)*Math.min(x.n,60),0)/evidence.reduce((s,x)=>s+Math.min(x.n,60),0):null;

  let evReq=({'単勝':1.12,'複勝':1.10,'馬複':1.36,'ワイド':1.30}[type]||1.25);
  if(weightedRoi!=null){
    if(weightedRoi>=1.15)evReq-=.04;
    else if(weightedRoi<.90)evReq+=.10;
    else if(weightedRoi<1)evReq+=.06
  }
  // 馬連・ワイドは補助券種。中/荒ではさらに厳しくする。
  if(type==='馬複'||type==='ワイド'){
    if(ctx.chaos==='中')evReq+=.06;
    if(ctx.chaos==='荒')evReq+=.14
  }else if(type==='複勝'&&ctx.chaos==='荒'){
    evReq+=.04
  }
  const minProb=({'単勝':.085,'複勝':.42,'馬複':.08,'ワイド':.22}[type]||0);
  const pass=Number.isFinite(ev)&&ev>=evReq&&prob>=minProb&&(weightedRoi==null||weightedRoi>=.85||ev>=evReq+.08);
  return {pass,evReq:+evReq.toFixed(2),minProb,historyRows:rows.length,weightedRoi,weightedRate,evidence,enough:rows.length>=30}
}
function ticketRecommendations(rows,comboOdds={},thresholds={}){
  const ba=combinationAdvice(rows,comboOdds,1.20),map=a=>new Map(a.map(x=>[x.key,x])),fallback=x=>Math.max(1,rows.indexOf(x)+1),rv=(x,k)=>Number(x?.roleRanks?.[k])||fallback(x);
  const win=rows.slice().sort((a,b)=>rv(a,'win')-rv(b,'win')),
        top2=rows.slice().sort((a,b)=>rv(a,'top2')-rv(b,'top2')),
        top3=rows.slice().sort((a,b)=>rv(a,'top3')-rv(b,'top3'));
  const single=win.slice(0,4).map(x=>({
    type:'単勝',key:String(x.h.number),numbers:[x.h.number],prob:Number(x.pWin??x.prob)||0,odds:x.odds,ev:x.ev,
    need:(Number(thresholds['単勝'])||1.12)/Math.max(Number(x.pWin??x.prob)||0,1e-9)
  })).sort((a,b)=>b.prob-a.prob).slice(0,2);
  const place=top3.slice(0,5).map(x=>{
    const p=Number(x.pTop3)||0,o=Number(x.h.placeOdds);
    return {type:'複勝',key:String(x.h.number),numbers:[x.h.number],prob:p,odds:Number.isFinite(o)&&o>=1?o:null,ev:Number.isFinite(o)&&o>=1?p*o:null,need:(Number(thresholds['複勝'])||1.10)/Math.max(p,1e-9)}
  }).sort((a,b)=>(b.ev??b.prob)-(a.ev??a.prob)).slice(0,3);

  const wm=map(ba.wide),qm=map(ba.quinella),k2=(a,b)=>comboKey([a,b]),t3=top3.slice(0,5).map(x=>x.h.number),t2=top2.slice(0,4).map(x=>x.h.number),tw=win.slice(0,2).map(x=>x.h.number),wk=[],qk=[];
  for(let i=0;i<t3.length;i++)for(let j=i+1;j<t3.length;j++)if(i<2||j<2)wk.push(k2(t3[i],t3[j]));
  for(const a of tw)for(const b of t2)if(a!==b)qk.push(k2(a,b));
  const score=x=>Math.max(x?.prob||0,1e-9)*Math.pow(clamp(x?.ev??1,.75,2),.14),best=(keys,m,n)=>[...new Set(keys)].map(k=>m.get(k)).filter(Boolean).sort((a,b)=>score(b)-score(a)).slice(0,n);
  return {single,place,wide:best(wk,wm,2),quinella:best(qk,qm,2),trio:[]}
}
function targetPlan(rows,comboOdds={},opts={}){
  const budget=Math.max(100,Math.floor((Number(opts.budget)||1000)/100)*100),history=opts.history||[],market=opts.market||rows.modelMeta?.market||'central',race=opts.race||{},chaos=opts.chaos||predictChaos(rows,race),maxTickets=Math.min(4,Math.floor(budget/100));
  const learned=learnTicketThresholds(history,market),thresholds={
    '単勝':Number(learned?.['単勝']?.threshold)||1.12,
    '複勝':1.10,
    '馬複':Math.max(1.36,Number(learned?.['馬複']?.threshold)||1.36),
    'ワイド':Math.max(1.30,Number(learned?.['ワイド']?.threshold)||1.30)
  };
  const rec=ticketRecommendations(rows,comboOdds,thresholds),ctx={market:market==='local'?'地方':'中央',surf:race.surface||'不明',dist:distanceBand(race.distance),chaos:chaos.label};
  let pool=[...rec.single,...rec.place,...rec.quinella,...rec.wide].map(x=>({...x,empiricalGate:empiricalTicketGate(history,x.type,{context:ctx,ev:x.ev,prob:x.prob})}))
    .filter(x=>x.odds!=null&&x.ev!=null&&x.empiricalGate.pass);

  pool.sort((a,b)=>{
    const pa=['単勝','複勝'].includes(canonType(a.type))?.035:0,pb=['単勝','複勝'].includes(canonType(b.type))?.035:0;
    return (b.prob+pb)-(a.prob+pa)||b.ev-a.ev
  });

  const chosen=[],caps={'単勝':1,'複勝':2,'馬複':1,'ワイド':1},counts={};
  while(chosen.length<maxTickets){
    let best=null,bestHit=portfolioHitProbability(chosen,rows),bestScore=-Infinity;
    for(const c of pool){
      const typ=canonType(c.type);if(chosen.includes(c)||(counts[typ]||0)>=caps[typ])continue;
      const hp=portfolioHitProbability([...chosen,c],rows),gain=hp-bestHit,hb=clamp((c.empiricalGate.weightedRoi??1)-1,-.3,.4);
      const primary=(typ==='単勝'||typ==='複勝')?.035:0;
      const secondary=(typ==='馬複'||typ==='ワイド')?-.010:0;
      const sc=gain*.72+Math.max(0,c.ev-1)*.018+hb*.035+primary+secondary;
      if(sc>bestScore){best=c;bestScore=sc;bestHit=hp}
    }
    if(!best)break;
    chosen.push(best);counts[canonType(best.type)]=(counts[canonType(best.type)]||0)+1;
    if(chosen.length>=2&&bestScore<.020)break
  }
  const hitProb=portfolioHitProbability(chosen,rows),roi=chosen.length?chosen.reduce((s,x)=>s+x.ev,0)/chosen.length:null,meets=chosen.length>0&&roi!=null&&roi>=1.12,tickets=meets?chosen.map(x=>({...x,amount:100})):[];
  return {tickets,bestEffort:chosen,recommendations:rec,budget,targetRoi:1.20,targetHit:.70,hitProb,roi,meets,anchor:rows.roleOrders?.win?.[0]??rows[0]?.h.number,confidence:rows.reduce((s,x)=>s+(x.auto?.confidence||0),0)/Math.max(rows.length,1),stance:meets?'購入候補あり':'見送り',chaos,empiricalContext:ctx,thresholds}
}
function realisticBets(rows,comboOdds={},opts={}){return targetPlan(rows,comboOdds,opts)}
function allTypeAccuracy(history){return ACTIVE_TYPES_117.map(type=>typeAccuracy(history,type))}
function dailyExactStats(history,source='purchase'){
  const map=new Map();
  for(const x of history||[]){
    let d=String(x.date||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)){
      const z=new Date(x.createdAt||x.id||0);
      d=Number.isFinite(z.getTime())?`${z.getFullYear()}-${String(z.getMonth()+1).padStart(2,'0')}-${String(z.getDate()).padStart(2,'0')}`:'日付不明'
    }
    if(!map.has(d))map.set(d,[]);
    map.get(d).push(x)
  }
  return [...map.entries()].map(([date,entries])=>{
    const s=exactStats(entries,source),all=exactStats(entries,'all');
    return {date,races:s.races,hitRate:s.raceRate,roi:s.roi,stake:s.stake,payout:s.payout,completeRaces:s.completeRaces,allRaces:all.races,allHitRate:all.raceRate,allRoi:all.roi}
  }).sort((a,b)=>String(b.date).localeCompare(String(a.date)))
}
function parse(raw){
  const p=parsePayload(raw),r=parseNAR(p)||parseJRA(p);
  if(r)r.classLevel=classLevelFromText([r.name,p.title,p.text,p.jraText,p.narDetailText].filter(Boolean).join(' '),r.type);
  return r
}
const api={parsePayload,parse,parseJRA,parseNAR,parseJraPast,parseNarPasts,parseNarPastCell,classLevelFromText,rawFeatures,sixIndices,rank,INDEX_LABELS,MODEL_WEIGHTS,BASE_MODEL_WEIGHTS_112,modelScore,overallGrade,judgement,valueIndex,marginScoreOne,popularityScoreOne,racePerformance,trendScore,styleProfile,paceIndex,simulateRace,simulateRaceRole,forecastRows,weightWalkForward,roleWeightWalkForward,archiveConditionSignal,calibrationStatus,learnTicketThresholds,rankingDiagnostics,roleRankingDiagnostics,ROLE_BASE_WEIGHTS_113,parseOddsText,parseOddsTables,parsePlaceOddsTables,parseComboOddsText,parseComboOddsTables,quinellaProb,wideProb,trioProb,combinationAdvice,ACTIVE_TYPES_116,ACTIVE_TYPES_117,raceChaosFeatures,predictChaos,empiricalTicketGate,ticketRecommendations,portfolioHitProbability,targetPlan,realisticBets,ticketNumbers,historyResult,historyTickets,ticketGrade,typeAccuracy,allTypeAccuracy,normalizeStoredTicket,backtestTickets,allSuggestedTickets,payoutKey,parseOfficialPayoutText,parseRefundText,officialPayoutForTicket,exactRaceStats,exactStats,actualPurchaseStats,dailyExactStats,suggestedRaceStats,suggestedStats,currentModelHistory,aiTop3,resultComparison,distanceBand,evBand,raceMeta,backtestRows,summarizeBacktest,groupBacktest,goalStats,walkForward};if(typeof module!=='undefined'&&module.exports)module.exports=api;g.UmaCore=api})(typeof globalThis!=='undefined'?globalThis:this);