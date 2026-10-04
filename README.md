# UmaScope 1.22.2 — オッズページから直接取り込み

1. 出馬表を従来のブックマークで取り込んでA/Bを保存。
2. UmaScope取込画面の「オッズ取込ブックマークのコードをコピー」で新しいSafariブックマークを別途作成し、URL欄を貼り替える。
3. 公式の馬連オッズページで新ブックマークを実行→UmaScope「オッズをクリップボードから追加」。
4. 公式のワイドオッズページで同様に実行→追加。ワイドの幅は下限を採用。
5. C再分析後「C最終判定を保存・更新」。

日付・競馬場・R番号の判定が不足する場合は確認ダイアログを出します。不一致が判明した場合は拒否します。公式ページの構造によっては解析できない場合があります。

GitHub上書き: index.html / core.js / sw.js / manifest.webmanifest。新規追加: odds_bookmarklet.txt。従来のbookmarklet.txtとresult_bookmarklet.txtは変更不要。
