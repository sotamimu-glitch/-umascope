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
return {date:`${dm[1]}-${String(dm[2]).padStart(2,'0')}-${String(dm[3]).padStart(2,'0')}`,course:dm[4],finish:Number(fm[1]),field:Number(field[1]),pop:pop?Number(pop[1]):null,jockey,weight:wm?Number(wm[1]):null,distance,surface,going,margin}
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
    const m=lines[i].match(/^([^\d\s]{1,10})(\d{2})\.(\d{2})\s+(良|稍重|重|不良)\s*(?:ナ\s*)?(?:(芝)\s*)?(右|左|直)\s*(\d{3,4})\b/);
    if(!m)continue;
    let finish=null,field=null,pop=null,jockey='',weight=null,margin=null;
    for(let j=i+1;j<Math.min(lines.length,i+5);j++){
      const f=lines[j].match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2})人\s+([^\s]+)\s+(?:★|▲|△|☆|◇)?\s*(\d{2}(?:\.\d)?)/);
      if(f){finish=Number(f[1]);field=Number(f[2]);pop=Number(f[3]);jockey=cleanJockey(f[4]);weight=Number(f[5]);break}
      if(/^(?:出走取消|競走除外|競走中止|取消|除外|中止)/.test(lines[j]))break;
    }
    for(let j=i+1;j<Math.min(lines.length,i+7);j++){
      const mg=lines[j].match(/[（(]([0-9]+(?:\.[0-9]+)?)[）)]/);
      if(mg){margin=Number(mg[1]);break}
    }
    if(finish!=null)a.push({date:inferNarDate(m[2],m[3],raceDate),course:m[1].replace(/^Ｊ/,''),finish,field,pop,jockey,weight,distance:Number(m[7]),surface:m[5]?'芝':'ダ',going:m[4],margin})
  }
  return a.slice(0,5)
}
function narHorseRow(c){if(c.length>=4&&/^\d{1,2}$/.test(fwDigits(c[0]))&&/^\d{1,2}$/.test(fwDigits(c[1])))return {frame:Number(fwDigits(c[0])),number:Number(fwDigits(c[1])),horseIdx:2,jockeyIdx:3};if(c.length>=3&&/^\d{1,2}$/.test(fwDigits(c[0]))&&!/^\d{1,2}$/.test(fwDigits(c[1])))return {frame:null,number:Number(fwDigits(c[0])),horseIdx:1,jockeyIdx:2};return null}
function narName(s){s=norm(s);const m=s.match(/^(.+?)(?:\s+(?:牡|牝|セン|せん|騸)\s*\d|$)/);return norm(m?m[1]:s).split('\n')[0]}
function narJockey(s){s=norm(s);return norm((s.split(/\n/)[0]||s).replace(/[（(].*$/,'').replace(/^\s*[★▲△☆◇]/,''))}
function parseNarPastCell(s){s=norm(narNormText(String(s||'')).replace(/\n+/g,' '));const m=s.match(/(?:^|\s)(\d{1,2})\s+(\d{2})\.(\d{2})\.(\d{2})\s*(良|稍重|重|不良)\s*(\d{1,2})頭\s*([^\s]+)\s*(?:ナ)?\s*(右|左|直)\s*(\d{3,4})/);if(!m)return null;const tail=s.slice((m.index||0)+m[0].length);const pj=tail.match(/(\d{1,2})人\s+\d+\s+([ぁ-んァ-ヶー一-龠々・A-Za-z.]+)\s*(?:★|▲|△|☆|◇)?\s*(\d{2}(?:\.\d)?)/);const mg=tail.match(/[（(]([0-9]+(?:\.[0-9]+)?)[）)]/);return {date:`20${m[2]}-${m[3]}-${m[4]}`,course:m[7].replace(/^Ｊ/,''),finish:Number(m[1]),field:Number(m[6]),pop:pj?Number(pj[1]):null,jockey:pj?pj[2]:'',weight:pj?Number(pj[3]):null,distance:Number(m[9]),surface:null,going:m[5],margin:mg?Number(mg[1]):null}}
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
function marginScoreOne(x){
  if(!x||x.margin==null||!Number.isFinite(Number(x.margin)))return null;
  const m=Math.max(0,Number(x.margin));
  if(Number(x.finish)===1)return clamp(8.3+Math.min(m,1.5)*1.0,7.5,9.8);
  return clamp(8.8-m*1.65,1,9)
}
function popularityScoreOne(x){
  if(!x?.finish||!x?.pop)return null;
  const field=Math.max(Number(x.field)||Math.max(x.finish,x.pop),2);
  const outperform=Number(x.pop)-Number(x.finish);
  const popStrength=10-9*(Number(x.pop)-1)/(field-1);
  return clamp(5+outperform*.62+(popStrength-5)*.12,1,10)
}
function racePerformance(x){
  const a=[{v:finishScore(x),w:.50},{v:marginScoreOne(x),w:.30},{v:popularityScoreOne(x),w:.20}];
  return weightedCustom(a)??5
}
function trendScore(recent){
  const vals=(recent||[]).slice(0,4).map(racePerformance).filter(Number.isFinite);
  if(vals.length<2)return 5;
  const a=vals.slice().reverse(),n=a.length,meanX=(n-1)/2,meanY=a.reduce((s,v)=>s+v,0)/n;
  let num=0,den=0;for(let i=0;i<n;i++){num+=(i-meanX)*(a[i]-meanY);den+=(i-meanX)**2}
  const slope=den?num/den:0;
  return clamp(5+slope*1.35,1,10)
}
function goingSimilarity(a,b){
  if(!a||!b)return 0;
  const ix={良:0,稍重:1,重:2,不良:3};if(ix[a]==null||ix[b]==null)return a===b?1:0;
  const d=Math.abs(ix[a]-ix[b]);return [1,.72,.38,.18][d]??0
}
const FEATURE_WEIGHTS={margin:.16,popularity:.08,field:.08,distance:.12,surface:.10,going:.08,jockey:.10,frame:.05,weight:.07,trend:.16};
const FEATURE_LABELS={margin:'着差',popularity:'人気',field:'頭数',distance:'距離変化',surface:'芝ダート',going:'馬場状態',jockey:'騎手',frame:'枠順',weight:'斤量',trend:'近走推移'};
function overallScore(v){
  const rating=Object.entries(FEATURE_WEIGHTS).reduce((sum,[k,w])=>sum+(Number(v?.[k])||5)*w,0);
  return clamp(Math.round(rating*10),10,100)
}
function overallGrade(score){
  const s=Number(score)||0;
  return s>=80?'S':s>=70?'A':s>=60?'B':s>=50?'C':'D'
}
function judgement(v){
  const score=overallScore(v);
  return {score,grade:overallGrade(score)}
}
function autoFactors(h,r){
  const recent=(h.recent||[]).slice(0,20),latest=recent[0]||null,details={};

  const marginVals=recent.map(marginScoreOne),margin=weighted(marginVals)??5;
  details.margin=marginVals.some(v=>v!=null)?`近走の着差を時間減衰評価`:'着差データ不足';

  const popVals=recent.map(popularityScoreOne),popularity=weighted(popVals)??5;
  details.popularity=popVals.some(v=>v!=null)?`人気より上に走った実績を評価`:'人気データ不足';

  const fieldVals=recent.map(finishScore),field=weighted(fieldVals)??5;
  details.field=fieldVals.some(v=>v!=null)?`頭数に対する着順位置を補正`:'頭数データ不足';

  let distance=5;
  if(r.distance&&latest?.distance){
    const delta=Math.abs(Number(r.distance)-Number(latest.distance));
    const changeBase=clamp(8.6-delta/115,2.2,8.6);
    const target=weighted(recent.map(x=>x.distance&&Math.abs(Number(x.distance)-Number(r.distance))<=200?racePerformance(x):null));
    distance=target==null?changeBase:.55*changeBase+.45*target;
    details.distance=`前走から${Number(r.distance)-Number(latest.distance)>=0?'+':''}${Number(r.distance)-Number(latest.distance)}m${target!=null?'＋近似距離実績':''}`;
  }else details.distance='距離データ不足';

  const sameSurface=recent.filter(x=>x.surface&&r.surface&&x.surface===r.surface);
  let surface=5;
  if(r.surface){
    if(sameSurface.length)surface=weighted(sameSurface.map(racePerformance))??5;
    else if(latest?.surface)surface=latest.surface===r.surface?5.8:4.2;
    details.surface=sameSurface.length?`${r.surface}の実績 ${sameSurface.length}走`:(latest?.surface?`前走${latest.surface}→今回${r.surface}`:'芝ダート実績不足');
  }else details.surface='今回の芝ダート不明';

  let going=5;
  if(r.going){
    const gv=recent.map((x,i)=>({v:racePerformance(x),w:goingSimilarity(x.going,r.going)*Math.pow(.82,i)})).filter(x=>x.w>0);
    going=weightedCustom(gv)??5;
    details.going=gv.length?`${r.going}に近い馬場 ${gv.length}走を評価`:'近い馬場の実績不足';
  }else details.going='今回の馬場状態未発表';

  const normJ=s=>String(s||'').replace(/\s/g,'').replace(/^[★▲△☆◇]/,'');
  const sameJ=recent.filter(x=>h.jockey&&x.jockey&&(normJ(x.jockey).includes(normJ(h.jockey))||normJ(h.jockey).includes(normJ(x.jockey))));
  let jockey=5;
  if(sameJ.length)jockey=weighted(sameJ.map(racePerformance))??5;
  else if(h.jockey&&latest?.jockey&&normJ(h.jockey)===normJ(latest.jockey))jockey=5.6;
  details.jockey=sameJ.length?`${h.jockey}との近走 ${sameJ.length}走`:(h.jockey?'同騎手の近走実績が少ない':'騎手不明');

  let frame=5;
  if(h.frame){
    const pos=(Number(h.frame)-1)/7;
    if(r.surface==='ダ'||Number(r.distance)<=1400)frame=clamp(6.25-1.45*pos,4.7,6.25);
    else if(r.surface==='芝'&&Number(r.distance)>=1800)frame=clamp(5.7-Math.abs(pos-.5)*1.15,5.05,5.7);
    else frame=clamp(5.55-Math.abs(pos-.45)*.8,5.0,5.55);
    details.frame=`${h.frame}枠（汎用的な軽い補正）`;
  }else details.frame='枠順を取得できず中立';

  let weight=5,weightDelta=null;
  const rw=recent.map(x=>x.weight).filter(x=>Number.isFinite(Number(x)));
  if(Number.isFinite(Number(h.weight))&&rw.length){
    const base=weighted(rw.map(Number));
    weightDelta=Number(h.weight)-Number(base);
    weight=clamp(5.4-weightDelta*.48,3.1,7.3);
    details.weight=`近走平均${base.toFixed(1)}kg → 今回${Number(h.weight).toFixed(1)}kg (${weightDelta>=0?'+':''}${weightDelta.toFixed(1)}kg)`;
  }else details.weight=Number.isFinite(Number(h.weight))?`今回${Number(h.weight).toFixed(1)}kg・比較材料不足`:'斤量不明';

  const trend=trendScore(recent);
  details.trend=recent.length>=2?`直近${Math.min(4,recent.length)}走のパフォーマンス推移`:'推移データ不足';

  const featureVals={margin,popularity,field,distance,surface,going,jockey,frame,weight,trend};
  const observed=[
    marginVals.some(v=>v!=null),popVals.some(v=>v!=null),fieldVals.some(v=>v!=null),
    !!(r.distance&&latest?.distance),sameSurface.length>0,!!(r.going&&recent.some(x=>x.going)),
    sameJ.length>0,!!h.frame,!!(Number.isFinite(Number(h.weight))&&rw.length),recent.length>=3
  ].filter(Boolean).length;
  const evidence=recent.length;
  const confidence=clamp(.16+.052*observed+.025*Math.min(evidence,10),.18,.93);
  return {...Object.fromEntries(Object.entries(featureVals).map(([k,v])=>[k,clamp(v,1,10)])),confidence,evidence,details,weightDelta}
}
function rank(r,overrides={}){
  let rows=r.horses.map(h=>{
    const auto=autoFactors(h,r),v={...auto,...(overrides[h.number]||{})};
    const rating=Object.entries(FEATURE_WEIGHTS).reduce((sum,[k,w])=>sum+(Number(v[k])||5)*w,0);
    const j=judgement(v);
    return {h,auto,v,rating,score:j.score,grade:j.grade,odds:h.odds||null}
  });
  const temp=1.55,ex=rows.map(x=>Math.exp(x.rating/temp)),sum=ex.reduce((a,b)=>a+b,0);
  const avgConf=rows.reduce((z,x)=>z+x.auto.confidence,0)/Math.max(1,rows.length),alpha=.28+.58*avgConf;
  rows=rows.map((x,i)=>{const raw=ex[i]/sum,p=alpha*raw+(1-alpha)/rows.length;return {...x,prob:p,ev:x.odds?p*x.odds:null}});
  return rows.sort((a,b)=>b.rating-a.rating)
}
function orderProb(order,by){let rem=1,p=1;for(const no of order){const q=by[no]||0;if(q<=0||rem<=0)return 0;p*=q/rem;rem-=q}return p}
function perms(a){if(a.length<=1)return [a.slice()];const out=[];a.forEach((x,i)=>{for(const tail of perms(a.slice(0,i).concat(a.slice(i+1))))out.push([x,...tail])});return out}
function quinellaProb(a,b,by){return clamp(orderProb([a,b],by)+orderProb([b,a],by),0,1)}
function trioProb(a,b,c,by){return clamp(perms([a,b,c]).reduce((s,o)=>s+orderProb(o,by),0),0,1)}
function wideProb(a,b,by){let s=0;for(const k of Object.keys(by).map(Number))if(k!==a&&k!==b)s+=trioProb(a,b,k,by);return clamp(s,0,1)}
function combinationAdvice(rows,comboOdds={},threshold=1.10){const by={};rows.forEach(x=>by[x.h.number]=x.prob);const nos=rows.map(x=>x.h.number);const q=[],w=[],t=[];
for(let i=0;i<nos.length;i++)for(let j=i+1;j<nos.length;j++){const a=nos[i],b=nos[j],key=comboKey([a,b]);const qp=quinellaProb(a,b,by),wp=wideProb(a,b,by),qo=comboOdds.quinella?.[key]??null,wo=comboOdds.wide?.[key]??null;q.push({type:'馬連',key,numbers:[a,b],prob:qp,odds:qo,ev:qo?qp*qo:null,need:threshold/Math.max(qp,1e-9)});w.push({type:'ワイド',key,numbers:[a,b],prob:wp,odds:wo,ev:wo?wp*wo:null,need:threshold/Math.max(wp,1e-9)})}
for(let i=0;i<nos.length;i++)for(let j=i+1;j<nos.length;j++)for(let k=j+1;k<nos.length;k++){const a=nos[i],b=nos[j],c=nos[k],key=comboKey([a,b,c]),p=trioProb(a,b,c,by),o=comboOdds.trio?.[key]??null;t.push({type:'三連複',key,numbers:[a,b,c],prob:p,odds:o,ev:o?p*o:null,need:threshold/Math.max(p,1e-9)})}
const sort=x=>x.sort((a,b)=>(b.ev??-1)-(a.ev??-1)||b.prob-a.prob);return {quinella:sort(q),wide:sort(w),trio:sort(t),threshold}}
function realisticBets(rows,comboOdds={},opts={}){
  const budget=Math.max(100,Math.floor((Number(opts.budget)||1000)/100)*100);
  const baseEv=Number(opts.threshold)||1.08;
  const avgConf=rows.reduce((z,x)=>z+(x.auto?.confidence||0),0)/Math.max(1,rows.length);
  const extra=avgConf<.45?.08:avgConf<.60?.04:0;
  const maxTickets=Math.max(1,Math.min(Math.floor(budget/100),avgConf<.45?2:avgConf<.60?3:5));
  const top=rows.slice(0,4),anchor=top[0]?.h.number,topNos=new Set(top.slice(0,3).map(x=>x.h.number));
  const ba=combinationAdvice(rows,comboOdds,baseEv+extra);
  const candidates=[];

  for(const x of rows.slice(0,3)){
    if(x.odds!=null&&x.ev!=null&&x.ev>=baseEv+extra&&x.prob>=.09){
      candidates.push({type:'単勝',key:String(x.h.number),numbers:[x.h.number],prob:x.prob,odds:x.odds,ev:x.ev,
        utility:(x.ev-1)*Math.sqrt(x.prob)*.95,reason:'上位評価＋単勝期待値'})
    }
  }
  for(const x of ba.wide){
    if(x.odds!=null&&x.ev!=null&&x.ev>=1.05+extra&&x.prob>=.22&&(x.numbers.includes(anchor)||x.numbers.every(n=>topNos.has(n)))){
      candidates.push({...x,utility:(x.ev-1)*Math.sqrt(x.prob)*1.18,reason:'軸中心のワイド'})
    }
  }
  for(const x of ba.quinella){
    if(x.odds!=null&&x.ev!=null&&x.ev>=1.08+extra&&x.prob>=.10&&(x.numbers.includes(anchor)||x.numbers.every(n=>topNos.has(n)))){
      candidates.push({...x,utility:(x.ev-1)*Math.sqrt(x.prob),reason:'上位同士の馬連'})
    }
  }
  for(const x of ba.trio){
    const inTop=x.numbers.filter(n=>topNos.has(n)).length;
    if(x.odds!=null&&x.ev!=null&&x.ev>=1.12+extra&&x.prob>=.045&&inTop>=2&&x.numbers.includes(anchor)){
      candidates.push({...x,utility:(x.ev-1)*Math.sqrt(x.prob)*.72,reason:'軸＋上位中心の三連複'})
    }
  }

  candidates.sort((a,b)=>b.utility-a.utility||b.ev-a.ev||b.prob-a.prob);
  const chosen=[],typeCount={},usedTypes=new Set();
  for(const c of candidates){
    const cap=c.type==='単勝'?1:c.type==='三連複'?1:2;
    if((typeCount[c.type]||0)>=cap)continue;
    if(usedTypes.size>=2&&!usedTypes.has(c.type))continue;
    chosen.push(c);typeCount[c.type]=(typeCount[c.type]||0)+1;usedTypes.add(c.type);
    if(chosen.length>=maxTickets)break
  }
  // If the strongest two ticket types are weakly represented, allow one more type only in high-confidence races.
  if(avgConf>=.72&&chosen.length<maxTickets&&usedTypes.size<3){
    for(const c of candidates){
      if(chosen.includes(c))continue;
      const cap=c.type==='単勝'?1:c.type==='三連複'?1:2;
      if((typeCount[c.type]||0)>=cap)continue;
      chosen.push(c);typeCount[c.type]=(typeCount[c.type]||0)+1;usedTypes.add(c.type);break
    }
  }

  const final=chosen.slice(0,maxTickets);
  if(final.length){
    const typeCap={単勝:.35,ワイド:.45,馬連:.35,三連複:.20};
    const q=final.map(x=>Math.max(.01,x.utility)),sumQ=q.reduce((a,b)=>a+b,0);
    const minStake=100,baseStake=minStake*final.length,remain=Math.max(0,budget-baseStake);
    final.forEach((x,i)=>{
      const raw=minStake+Math.floor((remain*q[i]/sumQ)/100)*100;
      const cap=Math.max(100,Math.floor((budget*(typeCap[x.type]??.30))/100)*100);
      x.amount=Math.min(raw,cap)
    });
    // 予算は上限。高リスク券種の上限に引っかかった余剰は無理に使い切らない。
    let total=final.reduce((z,x)=>z+x.amount,0);
    if(total>budget){
      for(const x of final.slice().sort((a,b)=>a.utility-b.utility)){
        while(total>budget&&x.amount>100){x.amount-=100;total-=100}
      }
    }
  }

  const watches=[];
  const addWatch=(arr,type,minProb)=>{for(const x of arr){if(x.odds==null&&x.prob>=minProb&&(x.numbers.includes(anchor)||x.numbers.every(n=>topNos.has(n)))){watches.push({...x,type});if(watches.length>=4)return}}};
  addWatch(ba.wide,'ワイド',.25);if(watches.length<4)addWatch(ba.quinella,'馬連',.12);if(watches.length<4)addWatch(ba.trio,'三連複',.06);

  const stance=!final.length?'見送り':final.length<=2?'絞って勝負':final.length<=4?'標準':'分散';
  return {tickets:final,watches:watches.slice(0,4),budget,confidence:avgConf,stance,anchor,maxTickets,threshold:baseEv+extra}
}
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
const api={parsePayload,parse,parseJRA,parseNAR,parseJraPast,autoFactors,rank,FEATURE_WEIGHTS,FEATURE_LABELS,overallScore,overallGrade,judgement,marginScoreOne,popularityScoreOne,racePerformance,trendScore,parseOddsText,parseOddsTables,parseNarPastCell,parseComboOddsText,parseComboOddsTables,quinellaProb,wideProb,trioProb,combinationAdvice,realisticBets,ticketNumbers,historyResult,historyTickets,ticketGrade,typeAccuracy,allTypeAccuracy,normalizeStoredTicket,backtestTickets,distanceBand,evBand,raceMeta,backtestRows,summarizeBacktest,groupBacktest,walkForward};if(typeof module!=='undefined'&&module.exports)module.exports=api;g.UmaCore=api})(typeof globalThis!=='undefined'?globalThis:this);