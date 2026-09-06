const C=require('./core.js');
function ok(x,m){if(!x)throw Error(m)}
// NAR current detail text, multiple pasts + corners
const p={umascope:6,url:'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTableSmall?k_babaCode=31&k_raceDate=2026%2F09%2F05&k_raceNo=1',text:'地方競馬情報サイト',narDetailText:`2026年9月5日（土）　 高　知　第１競走 　ダート　1300ｍ（右）15:25発走\n徳島県ミルクとすだち特別２歳－４\n1 1 サトノクラウン 牝 2\nナインスマイル\nナチュラリスト 鹿毛\n（高知） 55.0\n新庄海\n（高知）\n全 0-0-0-3\n場 0-0-0-3\n距 0-0-0-3\n高知08.02 良 右 1300\nアクイラ特別２歳－３\n10/11 11人 ☆阿部基 54.0\n4番 423 スミスバローズ\n1314（4.1） 11-11-11-10 42.6\n高知07.19 不良 右 1300\nキグナス特別２歳－２\n10/11 9人 佐原秀 55.0\n4番 434 サンサンキック\n1276（2.1） 10-10-10-10 40.5`,narDetailTables:[[['枠','番','馬名','騎手','前走','前々走'],['1','1','ナインスマイル 牝2','新庄海（高知） 55.0','高知08.02 良 右 1300\nアクイラ特別\n10/11 11人 ☆阿部基 54.0\n1314（4.1） 11-11-11-10 42.6','高知07.19 不良 右 1300\nキグナス特別\n10/11 9人 佐原秀 55.0\n1276（2.1） 10-10-10-10 40.5']]]};
const r=C.parse(JSON.stringify(p));ok(r,'NAR parse');ok(r.horses[0].recent.length>=2,'NAR recent not reflected');ok(r.horses[0].recent[0].corners.length>=2,'NAR corners');console.log('NAR detailed recent: OK',r.horses[0].recent);
// six indices
r.horses.push({number:2,frame:2,name:'テスト2',jockey:'山崎雅',weight:55,odds:5.0,recent:[{finish:1,field:10,pop:2,margin:.2,jockey:'山崎雅',weight:55,distance:1300,surface:'ダ',going:'良',corners:[2,2,1]},{finish:2,field:10,pop:3,margin:.3,jockey:'山崎雅',weight:55,distance:1300,surface:'ダ',going:'稍重',corners:[3,3,2]},{finish:3,field:10,pop:5,margin:.4,jockey:'別騎手',weight:56,distance:1400,surface:'ダ',going:'良',corners:[4,4,3]}],records:{venue:[1,1,1,3],distance:[1,1,0,2]}});r.horses[0].odds=8.0;r.going='良';const ix=C.sixIndices(r.horses[1],r);for(const k of ['ability','suitability','pace','jockey','form','value'])ok(ix[k]>=10&&ix[k]<=100,'index '+k);const rows=C.rank(r);ok(rows[0].indices.value>=10,'value index');console.log('Six indices: OK',rows.map(x=>[x.h.number,x.score,x.grade,x.indices]));
// combo predictions and target planner
r.comboOdds={quinella:{'1-2':4.5},wide:{'1-2':2.5},trio:{}};const rec=C.ticketRecommendations(rows,r.comboOdds,1.20);ok(rec.single.length,'single rec');ok(rec.wide.length,'wide rec');ok(rec.quinella.length,'quinella rec');const plan=C.targetPlan(rows,r.comboOdds,{budget:1000,targetRoi:1.20,targetHit:.70});ok(plan.recommendations&&plan.targetRoi===1.20&&plan.targetHit===.70,'target plan');console.log('Target plan: OK',plan.meets,plan.hitProb,plan.roi,plan.tickets);
// old 馬連 history remains gradeable as 馬複
ok(C.ticketGrade({type:'馬連',numbers:[1,2]},{first:2,second:1,third:3})===true,'old 馬連 migration');ok(C.ticketGrade({type:'馬複',numbers:[1,2]},{first:1,second:2,third:3})===true,'馬複 grade');
console.log('v1.9 tests: ALL OK');

// NAR Safari-like case: body establishes horse, detailed table supplies past-race cells
{
 const pp={umascope:6,url:'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTableSmall?k_babaCode=31&k_raceDate=2026%2F09%2F05&k_raceNo=1',text:'地方競馬情報サイト',narDetailText:`2026年9月5日（土） 高 知 第1競走 ダート 1300ｍ（右）15:25発走\nテスト競走\n1 1 サトノクラウン 牝 2\nナインスマイル\n（高知） 55.0\n新庄海\n（高知）\n全 0-0-0-3\n場 0-0-0-3\n距 0-0-0-3`,narDetailTables:[[['枠 番','馬 番','父 性齢 馬 名 母','負担重量 騎 手','前 走','前々走'],['1','1','サトノクラウン 牝 2\nナインスマイル\nナチュラリスト 鹿毛','55.0\n新庄海\n（高知）','高知08.02 良 右 1300\nアクイラ特別2歳-3\n10/11 11人 ☆阿部基 54.0\n4番 423 スミスバローズ\n1314（4.1） 11-11-11-10 42.6','高知07.19 不良 右 1300\nキグナス特別2歳-2\n10/11 9人 佐原秀 55.0\n4番 434 サンサンキック\n1276（2.1） 10-10-10-10 40.5']]]};
 const rr=C.parse(JSON.stringify(pp));ok(rr&&rr.horses[0].name==='ナインスマイル','NAR table horse name');ok(rr.horses[0].recent.length===2,'NAR table recent merge '+JSON.stringify(rr.horses[0]));console.log('NAR table-cell recent fallback: OK',rr.horses[0].name,rr.horses[0].recent.length)
}


// v1.10 AI suggested bets + comparison regression
{
 const h=[{
   id:1,
   aiTop3:[
     {rank:1,number:3,name:'A',score:82,grade:'S'},
     {rank:2,number:5,name:'B',score:75,grade:'A'},
     {rank:3,number:1,name:'C',score:68,grade:'B'}
   ],
   horseNames:{'1':'C','3':'A','5':'B','7':'D'},
   aiTickets:[
     {type:'単勝',key:'3',numbers:[3],odds:3.0},
     {type:'ワイド',key:'3-5',numbers:[3,5],odds:2.0},
     {type:'馬複',key:'3-7',numbers:[3,7],odds:5.0},
     {type:'三連複',key:'1-3-5',numbers:[1,3,5],odds:8.0}
   ],
   result:{first:3,second:7,third:5}
 }];
 const s=C.suggestedStats(h);
 if(s.graded!==4||s.hits!==3)throw Error('v1.10 suggested stats '+JSON.stringify(s));
 if(Math.abs(s.roi-2.5)>1e-9)throw Error('v1.10 roi '+s.roi);
 if(Math.abs(s.raceRate-1)>1e-9)throw Error('v1.10 race rate');
 const c=C.resultComparison(h[0]);
 if(!c.top1||c.top3Hits!==2)throw Error('v1.10 comparison '+JSON.stringify(c));
 console.log('v1.10 AI-vs-result/all-suggested: OK',s,c.top1,c.top3Hits);
}


// v1.11 ticket grading / unified stats / stable combo regression
{
  const res={first:3,second:7,third:5};
  if(!C.ticketGrade({type:'ワイド',key:'5-3',numbers:[5,3]},res))throw Error('v1.11 wide reverse-order hit failed');
  if(C.ticketGrade({type:'ワイド',key:'2-3',numbers:[2,3]},res))throw Error('v1.11 wide miss failed');
  if(!C.ticketGrade({type:'馬連',key:'7-3',numbers:[7,3]},res))throw Error('v1.11 quinella reverse-order hit failed');
  if(!C.ticketGrade({type:'三連複',key:'7-5-3',numbers:[7,5,3]},res))throw Error('v1.11 trio reverse-order hit failed');

  const hist=[{
    modelVersion:'1.11-stable-combo',
    aiTickets:[
      {type:'単勝',key:'3',numbers:[3],odds:3.0},
      {type:'ワイド',key:'3-5',numbers:[3,5],odds:2.0},
      {type:'馬複',key:'3-7',numbers:[3,7],odds:5.0},
      {type:'三連複',key:'3-5-7',numbers:[3,5,7],odds:8.0}
    ],
    tickets:[],
    result:res
  }];
  for(const typ of ['単勝','ワイド','馬複','三連複']){
    const s=C.typeAccuracy(hist,typ);
    if(s.total!==1||s.hits!==1)throw Error('v1.11 unified type stats '+typ+' '+JSON.stringify(s));
  }
  const bt=C.summarizeBacktest(hist,{type:'ワイド'});
  if(bt.total!==1||bt.hits!==1||Math.abs(bt.roi-2)>1e-9)throw Error('v1.11 unified backtest '+JSON.stringify(bt));
  console.log('v1.11 grading/unified stats: OK');
}
{
  const rows=[
    {h:{number:1},prob:.30,odds:4,ev:1.2},
    {h:{number:2},prob:.24,odds:5,ev:1.2},
    {h:{number:3},prob:.18,odds:7,ev:1.26},
    {h:{number:4},prob:.12,odds:12,ev:1.44},
    {h:{number:5},prob:.08,odds:25,ev:2.0},
    {h:{number:6},prob:.08,odds:30,ev:2.4}
  ];
  const comboOdds={quinella:{},wide:{},trio:{}};
  // Populate all combo odds uniformly enough for EV calculation.
  const ns=rows.map(x=>x.h.number);
  for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++){
    const k=[ns[i],ns[j]].sort((a,b)=>a-b).join('-');
    comboOdds.quinella[k]=8; comboOdds.wide[k]=3;
  }
  for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++)for(let k=j+1;k<ns.length;k++){
    comboOdds.trio[[ns[i],ns[j],ns[k]].sort((a,b)=>a-b).join('-')]=18;
  }
  const rec=C.ticketRecommendations(rows,comboOdds,1.2);
  const allowedWide=new Set(['1-2','1-3','2-3','1-4']);
  const allowedQ=new Set(['1-2','1-3','2-3']);
  if(rec.wide.some(x=>!allowedWide.has(x.key)))throw Error('v1.11 wide not top-rank centered '+JSON.stringify(rec.wide));
  if(rec.quinella.some(x=>!allowedQ.has(x.key)))throw Error('v1.11 quinella not top-rank centered '+JSON.stringify(rec.quinella));
  if(rec.trio.length!==1||!['1-2-3','1-2-4','1-3-4'].includes(rec.trio[0].key))throw Error('v1.11 trio not top-rank centered '+JSON.stringify(rec.trio));
  console.log('v1.11 stable combo selection: OK', rec.wide.map(x=>x.key),rec.quinella.map(x=>x.key),rec.trio.map(x=>x.key));
}


// v1.12 simulation / probability / diagnostics regression
{
  const rr={type:'central',date:'2026-09-06',courseName:'中山',raceNo:10,name:'3歳以上1勝クラス',surface:'芝',distance:1600,going:'良',classLevel:4,horses:[
    {number:1,frame:1,name:'A',jockey:'J1',weight:55,odds:3.0,recent:[
      {date:'2026-08-20',course:'中山',finish:1,field:16,pop:2,margin:.2,jockey:'J1',weight:55,bodyWeight:480,distance:1600,surface:'芝',going:'良',corners:[2,2,2,1],classLevel:3},
      {date:'2026-07-20',course:'東京',finish:2,field:16,pop:3,margin:.1,jockey:'J1',weight:55,bodyWeight:478,distance:1600,surface:'芝',going:'良',corners:[3,3,2,2],classLevel:3}]},
    {number:2,frame:3,name:'B',jockey:'J2',weight:56,odds:4.5,recent:[
      {date:'2026-08-18',course:'中山',finish:3,field:16,pop:4,margin:.4,jockey:'J2',weight:56,bodyWeight:500,distance:1600,surface:'芝',going:'良',corners:[5,5,4,3],classLevel:4},
      {date:'2026-07-18',course:'東京',finish:4,field:18,pop:6,margin:.6,jockey:'J2',weight:56,bodyWeight:504,distance:1600,surface:'芝',going:'稍重',corners:[7,6,5,4],classLevel:4}]},
    {number:3,frame:5,name:'C',jockey:'J3',weight:57,odds:7.0,recent:[
      {date:'2026-08-17',course:'新潟',finish:5,field:18,pop:5,margin:.8,jockey:'J3',weight:57,bodyWeight:470,distance:1600,surface:'芝',going:'良',corners:[12,11,8,5],classLevel:4},
      {date:'2026-07-10',course:'東京',finish:6,field:16,pop:8,margin:1.0,jockey:'J3',weight:57,bodyWeight:468,distance:1800,surface:'芝',going:'良',corners:[13,12,9,6],classLevel:4}]},
    {number:4,frame:7,name:'D',jockey:'J4',weight:56,odds:12.0,recent:[
      {date:'2026-08-16',course:'福島',finish:8,field:16,pop:10,margin:1.5,jockey:'J4',weight:56,bodyWeight:455,distance:1800,surface:'芝',going:'稍重',corners:[1,1,1,8],classLevel:4},
      {date:'2026-07-02',course:'福島',finish:9,field:14,pop:9,margin:1.8,jockey:'J4',weight:56,bodyWeight:460,distance:1800,surface:'芝',going:'良',corners:[1,1,1,9],classLevel:4}]}
  ],comboOdds:{quinella:{'1-2':6,'1-3':10,'1-4':18,'2-3':12,'2-4':22,'3-4':30},wide:{'1-2':2.2,'1-3':3.2,'1-4':5,'2-3':4,'2-4':6,'3-4':8},trio:{'1-2-3':14,'1-2-4':24,'1-3-4':35,'2-3-4':45}}};
  const rows=C.rank(rr,{history:[]});
  const sw=rows.reduce((s,x)=>s+x.pWin,0),s2=rows.reduce((s,x)=>s+x.pTop2,0),s3=rows.reduce((s,x)=>s+x.pTop3,0);
  if(Math.abs(sw-1)>.01||Math.abs(s2-2)>.03||Math.abs(s3-3)>.03)throw Error('v1.12 marginal sums '+[sw,s2,s3]);
  for(const x of rows)if(!(x.pWin<=x.pTop2+.03&&x.pTop2<=x.pTop3+.03))throw Error('v1.12 marginal order '+JSON.stringify(x));
  const sim=rows.simulation;
  const qsum=Object.values(sim.quinella).reduce((a,b)=>a+b,0),tsum=Object.values(sim.trio).reduce((a,b)=>a+b,0),wsum=Object.values(sim.wide).reduce((a,b)=>a+b,0);
  if(Math.abs(qsum-1)>.05||Math.abs(tsum-1)>.05||Math.abs(wsum-3)>.20)throw Error('v1.12 combo sums '+[qsum,wsum,tsum]);
  const rec=C.ticketRecommendations(rows,rr.comboOdds,C.learnTicketThresholds([],rr.type));
  if(!rec.wide.length||!rec.quinella.length||!rec.trio.length)throw Error('v1.12 recommendations missing');
  console.log('v1.12 simulation probabilities: OK',rows.map(x=>[x.h.number,x.pWin.toFixed(3),x.pTop2.toFixed(3),x.pTop3.toFixed(3)]));
}
{
  const h=[
    {aiTop3:[{number:1},{number:2},{number:3}],result:{first:1,second:4,third:2}},
    {aiTop3:[{number:2},{number:3},{number:4}],result:{first:3,second:2,third:5}},
    {aiTop3:[{number:4},{number:1},{number:2}],result:{first:3,second:5,third:6}}
  ];
  const d=C.rankingDiagnostics(h);
  if(Math.abs(d.top1Win-1/3)>1e-9||Math.abs(d.top3Winner-2/3)>1e-9)throw Error('v1.12 diagnostics '+JSON.stringify(d));
  console.log('v1.12 ranking diagnostics: OK',d);
}
{
  if(C.classLevelFromText('G1 日本ダービー','central')!==10)throw Error('v1.12 class G1');
  if(C.classLevelFromText('3歳以上1勝クラス','central')!==4)throw Error('v1.12 class 1win');
  if(C.classLevelFromText('C3-7','local')==null)throw Error('v1.12 local class');
  console.log('v1.12 class parser: OK');
}
