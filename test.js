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

// v1.3 backtest / grouping / walk-forward tests
{
  const hist=[];
  for(let i=0;i<10;i++){
    const hit=i%2===0;
    hist.push({
      id:i+1,createdAt:`2026-09-${String(i+1).padStart(2,'0')}T10:00:00+09:00`,date:`2026-09-${String(i+1).padStart(2,'0')}`,
      market:i<5?'central':'local',type:i<5?'central':'local',course:i<5?'東京':'大井',surface:i<5?'芝':'ダ',distance:i<5?1600:1200,going:'良',race:'T'+i,
      backtestTickets:[{t:'単勝',k:'1',n:[1],e:1.2,p:.25,o:5.0},{t:'馬連',k:'1-2',n:[1,2],e:1.1,p:.15,o:8.0}],
      result:{first:hit?1:3,second:hit?2:4,third:5}
    });
  }
  const s=C.summarizeBacktest(hist,{type:'単勝'});
  if(s.total!==10||s.hits!==5||Math.abs(s.roi-2.5)>1e-9)throw Error('v1.3 summary '+JSON.stringify(s));
  const g=C.groupBacktest(hist,'market',{});
  if(g.length!==2)throw Error('v1.3 market groups');
  if(C.distanceBand(1200)!=='～1200m'||C.distanceBand(1800)!=='1700～2000m')throw Error('distance bands');
  if(C.evBand(1.25)!=='1.20～1.29')throw Error('ev band');
  const wf=C.walkForward(hist,{type:'単勝'});
  if(!wf.enough||wf.testRaces<1)throw Error('walk forward '+JSON.stringify(wf));
  console.log('v1.3 backtest/group/walk-forward: OK', {roi:s.roi, wf: {threshold:wf.threshold, validation:wf.validation.roi}});
}


// v1.4 real NAR DebaTableSmall-style text regression
{
 const detail={umascope:4,url:'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTableSmall?k_babaCode=31&k_raceDate=2026%2F09%2F05&k_raceNo=2',title:'2R 出馬表',text:'地方競馬情報サイト',narDetailText:`2026年9月5日（土）　 高　知　第２競走 　ダート　1300ｍ（右）16:00発走
Ｃ３－７
（サラブレッド系　一般 定量 ）
2Ｒ　出　馬　表
1 1 ナダル   牡 4
ヒデノブルースカイ
ブロンシェダーム   鹿毛
（ディープインパクト）
（同）ＪＰＮ技研   ヒサイファーム 田中譲
（高知） 57.0
郷間勇
（高知）
1-2-0-10   3-2-0-21
0-0-0-1
2-2-0-15
全 3-2-0-21
場 2-2-0-12
距 1-2-0-10
高知07.26 良 右 1600
Ｃ２－４
9/11 4人 郷間勇 57.0
6番 435 ミステリオ
1503（3.0） 4-4-5-6 43.5
高知07.11 重 右 1300
小暑特別Ｃ２－１選抜馬
5/11 11人 郷間勇 57.0
1番 438 プレジール
1249（0.7） 1-1-1-1 41.2
2 2 デクラレーションオブウォー   牝 4
ディクシーヴォーグ
レッドヴォーグ   栗毛
（シンボリクリスエス）
ウエスト．フォレスト 高村伸一 細川忠
（高知） 55.0
宮川実
（高知）
全 4-0-1-7
場 1-0-0-0
距 0-0-0-0
高知08.02 良 右 1400
Ｃ３－８
1/12 7人 加藤翔 55.0
2番 453 エクストラノート
1315（1.1） 2-2-3-2 39.0
Ｊ東京06.21 重 左 1400
３歳上１勝クラス
16/16 14人 ▲佐藤翔 53.0
2番 448 タイキブリッツェン
1254（2.6） 13-13 36.2`};
 const r14=C.parse(JSON.stringify(detail));
 if(!r14)throw Error('v1.4 NAR detail parse failed');
 if(r14.horses.length!==2)throw Error('v1.4 horse count '+r14.horses.length);
 if(r14.horses[0].name!=='ヒデノブルースカイ'||r14.horses[0].jockey!=='郷間勇')throw Error('v1.4 horse/jockey '+JSON.stringify(r14.horses[0]));
 if(r14.horses[0].recent.length!==2)throw Error('v1.4 recent count '+r14.horses[0].recent.length);
 if(r14.horses[0].recent[0].date!=='2026-07-26')throw Error('v1.4 recent date '+r14.horses[0].recent[0].date);
 if(r14.courseName!=='高知'||r14.raceNo!==2||r14.distance!==1300)throw Error('v1.4 header '+JSON.stringify(r14));
 console.log('v1.4 NAR detailed card regression: OK',r14.horses.map(h=>[h.number,h.name,h.jockey,h.recent.length]));
}


// v1.5 JRA current card row regression (desktop/plain table)
{
 const p={umascope:5,url:'https://www.jra.go.jp/JRADB/accessD.html',title:'出馬表 JRA',
 text:`JRA
2026年9月5日（土曜） 2回札幌5日 発走時刻：12時40分 6レース
3歳未勝利
コース：2,000メートル（芝・右）
芝：重
ハヤブサブロー 26.5(12番人気) (0.0.0.4)59万円 武田 修 新冠橋本牧場 高橋 義忠 (栗東)
牝3/栗 55.0 kg 横山 琉人
2026年7月4日 函館 牝未勝利 11着 11頭12番10番人気 吉田 隼人 55.0 kg 1700ダ 1:53.3 良 432 kg 3F 43.9 ギンケイ(6.6)
2026年6月20日 函館 未勝利 13着 16頭6番10番人気 吉田 隼人 55.0 kg 2000芝 2:01.9 良 430 kg 3F 36.8 ジャケットポケット(2.4)
2026年4月11日 福島 牝未勝利 9着 16頭11番2番人気 吉田 隼人 55.0 kg 1800芝 1:48.3 良 426 kg 3F 36.1 サフランルージュ(0.7)
2026年3月15日 中京 牝未勝利 5着 16頭8番7番人気 吉田 隼人 55.0 kg 1600芝 1:35.4 良 436 kg 3F 34.3 スリラーナイト(0.5)`,
 jraTables:[[
 ['枠','馬番','馬名 / 単勝オッズ(人気) 戦績 / 総賞金 / 馬体重 馬主名 / 生産者名 / 調教師名 / 血統','性齢/毛色 負担重量 騎手名','前走','前々走','3走前','4走前'],
 ['1','1','ハヤブサブロー 26.5(12番人気) (0.0.0.4)59万円 武田 修 新冠橋本牧場 高橋 義忠 (栗東)','牝3/栗 55.0 kg 横山 琉人','2026年7月4日 函館 牝未勝利 11着 11頭12番10番人気 吉田 隼人 55.0 kg 1700ダ 1:53.3 良 432 kg 3F 43.9 ギンケイ(6.6)','2026年6月20日 函館 未勝利 13着 16頭6番10番人気 吉田 隼人 55.0 kg 2000芝 2:01.9 良 430 kg 3F 36.8 ジャケットポケット(2.4)','2026年4月11日 福島 牝未勝利 9着 16頭11番2番人気 吉田 隼人 55.0 kg 1800芝 1:48.3 良 426 kg 3F 36.1 サフランルージュ(0.7)','2026年3月15日 中京 牝未勝利 5着 16頭8番7番人気 吉田 隼人 55.0 kg 1600芝 1:35.4 良 436 kg 3F 34.3 スリラーナイト(0.5)']
 ]]};
 const r=C.parse(JSON.stringify(p));
 if(!r||r.horses.length!==1)throw Error('v1.5 JRA parse fail '+JSON.stringify(r));
 if(r.horses[0].recent.length!==4)throw Error('v1.5 JRA recent '+JSON.stringify(r.horses[0]));
 if(r.horses[0].recent[0].finish!==11||r.horses[0].recent[0].distance!==1700)throw Error('v1.5 first past '+JSON.stringify(r.horses[0].recent[0]));
 console.log('v1.5 JRA current-card regression: OK',r.horses[0].name,r.horses[0].jockey,r.horses[0].recent.length);
}
// v1.5 JRA body-text-only fallback
{
 const p={umascope:5,url:'https://www.jra.go.jp/JRADB/accessD.html',text:`JRA
2026年9月5日（土曜） 2回札幌5日 発走時刻：12時40分 6レース
3歳未勝利
コース：2,000メートル（芝・右）
1
ハヤブサブロー 26.5(12番人気) (0.0.0.4) 高橋 義忠 (栗東)
牝3/栗 55.0 kg 横山 琉人
2026年7月4日 函館 牝未勝利 11着 11頭12番10番人気 吉田 隼人 55.0 kg 1700ダ 1:53.3 良 432 kg ギンケイ(6.6)
2026年6月20日 函館 未勝利 13着 16頭6番10番人気 吉田 隼人 55.0 kg 2000芝 2:01.9 良 430 kg ジャケットポケット(2.4)`};
 const r=C.parse(JSON.stringify(p));
 if(!r||!r.horses[0]||r.horses[0].recent.length!==2)throw Error('v1.5 body fallback '+JSON.stringify(r));
 console.log('v1.5 JRA body fallback: OK',r.horses[0].recent.length);
}
