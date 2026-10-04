# UmaScope 1.22.3 — オッズ取込ブックマーク表示修正
設定画面に「UmaScopeオッズ取込ブックマーク」を追加しました。
トップ画面のコピーと設定画面のコピーは同じコードです。
オッズ取込コードをアプリに内蔵したため、TXTの取得に失敗してもコピーできます。
Service Workerのキャッシュにodds_bookmarklet.txtを追加しました。

GitHubへindex.html、core.js、sw.js、manifest.webmanifestを上書き、
odds_bookmarklet.txtを必ず追加してください。
iPhoneで反映しない場合はSafariでGitHub PagesのURLを再読み込みしてください。
