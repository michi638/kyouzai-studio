# 教材スタジオ（iPad向けWebアプリ）

## 主な機能
- PDF読み込み・ページ移動
- Apple Pencil／指によるPDF上へのペン、蛍光、消しゴム注釈
- Safariの音声認識を使ったリアルタイム文字起こし
- キーボードによる文章編集
- ChatGPTによる要約、授業化、確認問題、入試分析
- IndexedDBによる教材アーカイブ自動保存
- 教材単位・アーカイブ全体のJSONバックアップ
- iPadの共有画面または保存画面を使ったiCloud Drive保存

## 公開方法（GitHub Pages）
1. GitHubで新しいPublicリポジトリを作ります。
2. このZIPのうち `worker` フォルダ以外をリポジトリ直下へアップロードします。
3. Settings → Pages → Deploy from a branch → main / root → Save。
4. 表示された `https://ユーザー名.github.io/リポジトリ名/` をiPadのSafariで開きます。

## AI要約の準備（Cloudflare Worker）
ブラウザへOpenAI APIキーを置くと第三者に読まれる危険があるため、AI部分だけWorkerを使います。

1. Cloudflareに無料登録し、Workers & PagesでWorkerを作成します。
2. `worker/worker.js` の内容をWorkerのコードへ貼り付け、Deployします。
3. Workerの Settings → Variables and Secrets で次を登録します。
   - `OPENAI_API_KEY`：OpenAI APIキー（Secret）
   - `OPENAI_MODEL`：例 `gpt-5-mini`（任意）
   - `ALLOWED_ORIGIN`：GitHub PagesのURL（例 `https://ユーザー名.github.io`）
4. Worker URLの末尾に `/api/summarize` を付けます。
   例：`https://xxxx.workers.dev/api/summarize`
5. 教材スタジオの「設定」にこのURLを入力して保存します。

OpenAI APIの利用料金はChatGPT Plusとは別です。APIキーを作成し、API側に支払い方法または利用枠を設定する必要があります。

## iCloud Driveについて
Webアプリが利用者の許可なくiCloud Driveへ自動書き込みすることはできません。
「iCloudに保存」を押すと、対応Safariでは保存画面、その他では共有画面が開きます。
共有画面の「ファイルに保存」からiCloud Drive内のフォルダを選択してください。

## データの扱い
- 通常の編集内容とPDFはSafari内のIndexedDBへ自動保存されます。
- SafariのWebサイトデータを消去すると消える可能性があります。
- 定期的に「アーカイブ全体をバックアップ」してiCloud Driveへ保存してください。
- AIボタンを押した時だけ、文字起こし本文が設定したWorkerとOpenAI APIへ送信されます。
- PDFファイルそのものはAIへ送信しません。

## 注意
- 音声認識はブラウザ機能に依存し、長時間では途切れることがあります。アプリは自動再開を試みます。
- PDFは大きいほどSafari内の保存容量を使います。
- PDFページへの注釈はページ別に保存されますが、注釈を埋め込んだPDFの再生成機能は今回の試作版には含めていません。
