const C=require('./core.js');
const nar={umascope:2,text:'地方競馬情報サイト',narDetailText:`2026年9月4日（金）　 大　井　第４競走 　ダート　1200ｍ（外コース・右）16:26発走\n２歳一 二\n1 1 サンダースノー 牡 2\nサーブルエース\n母 栗毛\n調教師\n（大井） 54.0\n町田直\n（川崎）\n全 0-1-0-1\n場 0-1-0-1\n距 0-1-0-1\n大井08.16 重 ナ 右 1200\n２歳三 四\n2/7 2人 和田譲 54.0\n7番 475 ラッキー\n1160（1.6） 1-2 39.3\n大井07.21 良 右 1200\n２歳新馬\n4/9 2人 和田譲 54.0\n1番 477 タカラ\n1173（2.8） 3-3 39.6\n2 2 ロジャーバローズ 牝 2\nモンサンマナオラナ\n母 栗毛\n調教師\n（大井） 51.0\n小野俊\n（大井）\n全 1-0-0-0\n場 1-0-0-0\n距 1-0-0-0\n大井08.15 重 右 1200\n２歳新馬\n1/8 1人 笹川翼 54.0\n3番 470 サンプル\n1150（0.0） 1-1 38.0`,oddsText:'',tables:[],oddsTables:[[['馬番','馬名','オッズ'],['1','サーブルエース','7.7'],['2','モンサンマナオラナ','6.5']]]};
const r=C.parse(JSON.stringify(nar));if(!r)throw Error('NAR parse failed');if(r.horses.length!==2)throw Error('horse count '+r.horses.length);if(r.horses[0].recent.length<2)throw Error('recent parse');if(r.horses[0].odds!==7.7)throw Error('odds parse');const rows=C.rank(r);if(rows.length!==2||!rows[0].prob)throw Error('rank');console.log('NAR parser/ranking: OK',r.horses.map(h=>[h.number,h.name,h.recent.length,h.odds]));
const past=C.parseJraPast('2026年8月22日 中京 未勝利 5着 18頭7番14番人気 国分 恭介 57.0 kg 2000芝 1:59.3 良 492 kg 3F 34.3 アスク(0.4)');if(!past||past.finish!==5||past.distance!==2000||past.jockey!=='国分 恭介')throw Error('JRA past');console.log('JRA past parser: OK',past);const jp={umascope:2,text:`JRA\n出馬表\n2026年9月6日（日曜） 4回阪神2日 発走時刻：11時30分 4レース\n3歳未勝利\n3歳 未勝利 [指定] 馬齢 コース：2,000メートル（芝・右）`,tables:[[
 ['枠','馬番','馬名\n調教師名\n血統','性齢/毛色\n負担重量\n騎手名','前走','前々走','3走前','4走前'],
 ['1','1','インヴァイト 杉山 晴紀(栗東)\n父：キズナ\n母：メイショウイザナミ','牝3/黒鹿 55.0 kg 加藤 祥太','2026年7月25日 中京 牝未勝利 16着 16頭1番14番人気 加藤 祥太 55.0 kg 1600芝 1:34.6 良 458 kg 3F 34.3 ファルカータ(2.1)','','',''],
 ['2','2','ウィスピア 小林 真也(栗東)\n父：サンプル','牡3/黒鹿 57.0 kg 国分 恭介','2026年8月22日 中京 未勝利 5着 18頭7番14番人気 国分 恭介 57.0 kg 2000芝 1:59.3 良 492 kg 3F 34.3 アスク(0.4)','2026年7月26日 中京 未勝利 11着 15頭15番12番人気 角田 大和 57.0 kg 1800ダ 1:57.8 良 486 kg 3F 43.1 エア(3.9)','','']
]],oddsText:'',oddsTables:[]};
const jr=C.parse(JSON.stringify(jp));if(!jr)throw Error('JRA parse failed');if(jr.horses.length!==2)throw Error('JRA horses '+jr.horses.length);if(jr.horses[1].recent.length!==2)throw Error('JRA recent '+jr.horses[1].recent.length);console.log('JRA race parser/ranking: OK',jr.horses.map(h=>[h.number,h.name,h.jockey,h.recent.length]));

const odds=C.parseComboOddsTables([[['組合せ','オッズ','人気'],['1-2','4.8','1'],['1-3','10.5','2']]],2);if(odds['1-2']!==4.8)throw Error('combo odds');
const wide=C.parseComboOddsTables([[['組合せ','オッズ'],['1-2','2.3-2.8']]],2,true);if(wide['1-2']!==2.3)throw Error('wide lower odds');
const synthetic={horses:[1,2,3,4].map(n=>({number:n,name:'H'+n,odds:null,recent:[],records:{}}))};
const rr=[{h:synthetic.horses[0],prob:.4},{h:synthetic.horses[1],prob:.3},{h:synthetic.horses[2],prob:.2},{h:synthetic.horses[3],prob:.1}];
let qsum=0,tsum=0,wsum=0;for(let i=1;i<=4;i++)for(let j=i+1;j<=4;j++){qsum+=C.quinellaProb(i,j,{1:.4,2:.3,3:.2,4:.1});wsum+=C.wideProb(i,j,{1:.4,2:.3,3:.2,4:.1});for(let k=j+1;k<=4;k++)tsum+=C.trioProb(i,j,k,{1:.4,2:.3,3:.2,4:.1})}
if(Math.abs(qsum-1)>1e-9)throw Error('quinella probs sum '+qsum);if(Math.abs(tsum-1)>1e-9)throw Error('trio probs sum '+tsum);if(Math.abs(wsum-3)>1e-9)throw Error('wide probs sum '+wsum);
const adv=C.combinationAdvice(rr,{quinella:{'1-2':3.5},wide:{'1-2':1.8},trio:{'1-2-3':3.0}},1.1);if(!adv.quinella.length||adv.quinella.find(x=>x.key==='1-2').odds!==3.5)throw Error('advice');
console.log('Combination probability/odds: OK');

// v1.2 history grading tests
{
  const hist=[
    {pick:3,tickets:[{type:'馬連',key:'3-5'},{type:'ワイド',key:'3-7'},{type:'三連複',key:'3-5-7'}],result:{first:3,second:5,third:7}},
    {pick:2,tickets:[{type:'馬連',key:'2-4'},{type:'ワイド',key:'2-6'},{type:'三連複',key:'2-4-6'}],result:{first:4,second:2,third:8}}
  ];
  const a=C.allTypeAccuracy(hist);
  const by=Object.fromEntries(a.map(x=>[x.type,x]));
  if(by['単勝'].hits!==1||by['単勝'].total!==2)throw Error('single history stats');
  if(by['馬連'].hits!==2)throw Error('quinella history stats');
  if(by['ワイド'].hits!==1)throw Error('wide history stats');
  if(by['三連複'].hits!==1)throw Error('trio history stats');
  console.log('History ticket grading: OK',a);
}
