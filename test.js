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
