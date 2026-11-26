# 会員登録おてつだい

インターネットに不慣れな方が、**高島屋オンラインストアの会員登録を一人でできる**ようにお手伝いする Web アプリです（スマートフォン向け・大きな文字とボタン）。

> **ご注意**：このアプリは個人が作った非公式のものです。株式会社高島屋とは関係ありません。
> 高島屋のサイトの作りが変わると、自動入力や商品の読み取りが動かなくなることがあります。

- 公開中の例：https://kaiin-support.vercel.app （AIとスイーツは合言葉が必要です）
- 使っている技術：Next.js（App Router）/ React / TypeScript、Gemini（Vertex AI または Google AI Studio）、Vercel

## できること

1. **登録する情報を準備する**（`/prepare`）
   名前・住所・電話・メール・性別・生年月日・メルマガ希望を、ブラウザ（localStorage）に保存します。各項目に「コピー」ボタンがあります。
   パスワードは保存しません（登録時に iPhone やパソコンの「強力なパスワード」機能で作り、端末に覚えてもらいます）。
2. **高島屋で会員登録する**（`/register`）
   7つのステップで手順を案内します。自動入力は「ブックマークレット」（ブックマークに登録して使う小さなプログラム）で行います。
   高島屋のページでブックマーク「高島屋おてつだい」を押すと、「自動入力」と「AIに聞く」のボタンが出ます。
   「自動入力」では、入力欄をオレンジの枠で示しながら1項目ずつ、または「まとめて入力」で自動入力します。どの画面からも「メニュー」で最初の画面に戻れます。
3. **AIに聞く**（`/assistant` と、高島屋のページの上の案内）
   高島屋の新規会員登録の画面までの行き方と、ブックマークの使い方を手助けします。
   高島屋のページの上で聞くと、AIが「次に押す場所」をオレンジの枠で光らせます。
4. **今日のおすすめスイーツ**（`/sweets`）
   高島屋の洋菓子・和菓子・果物（「フルーツ・野菜」売り場の「フルーツ」）から、日替わりで3つおすすめします（商品名・種別・価格・URL）。
   - 「種類」「細かい種類」「予算」「苦手・ダメなもの」で絞り込めます。どれもいくつでも選べます。
     「種類」（例：洋菓子）を押すと、その細かい種類が全部選ばれます。「予算」「苦手」には、全部選ぶ「すべて」ボタンがあります。
   - 苦手・ダメなもの（りんご・いちご・メロン・マンゴー・もも・ナッツ・あんこ系・くり・乳製品・チョコ）は、商品名と種類から見分けて除きます（`lib/dislikes.ts`）。原材料までは分かりません。
5. **練習ページ**（`/practice.html`）
   本物ではない練習用の登録フォームです。自動入力を試すのに使います。

### 個人情報の守り方

- 保存した情報は、使っている端末のブラウザの中だけにあります（サーバーには保存しません）。
- AIには、保存した名前・住所などを送りません。質問の文章に入っていたら、送る前に伏せ字にします。
- 高島屋のページの上からAIに聞くときは、**ボタン・リンク・見出し・欄の名前の文字だけ**を送り、入力欄の中身は送りません。
- 画面の写真は「個人情報が写っていない」チェックが必要で、自動入力のあとの段階では送れません。
- 会話の中身はサーバーのログに残しません。

---

## 手元で動かす（git clone から）

### 1. 必要なもの

- [Node.js](https://nodejs.org/) 20 以上（`node -v` で確認）
- [Git](https://git-scm.com/)
- AIを使う場合は、次のどちらか
  - **Google AI Studio の APIキー**（いちばん簡単）：https://aistudio.google.com/apikey
  - **Google Cloud の Vertex AI**：[gcloud CLI](https://cloud.google.com/sdk/docs/install) と、Vertex AI API を有効にしたプロジェクト

AIを使わなくても、情報の準備・自動入力・スイーツは動きます。

### 2. ダウンロードして部品を入れる

```bash
git clone https://github.com/bakazikara21/kaiin-support.git
cd kaiin-support
npm install
```

### 3. 設定ファイルを作る

見本をコピーして `.env.local` を作り、中身を書きかえます（`.env.local` は Git に入りません）。

```bash
cp .env.example .env.local
```

| 設定 | 意味 |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio の APIキー（AI Studio を使う場合） |
| `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION` | Vertex AI を使う場合のプロジェクトIDと場所（例：`global`）。書いてあると APIキーより優先されます |
| `GEMINI_MODEL` | 使うモデル（初期値 `gemini-3.8-flash`） |
| `ACCESS_CODE` | 合言葉。書くと、AIとスイーツの読み込みは合言葉を知っている人だけが使えます（手元だけで使うなら空でもかまいません） |

Vertex AI を使う場合は、次のコマンドでログインしておきます。

```bash
gcloud auth application-default login
```

### 4. 起動する

```bash
npm run dev -- -H 0.0.0.0
```

- パソコン：http://localhost:3000
- 同じ Wi-Fi のスマートフォン：`http://（パソコンのIPアドレス）:3000`（IPアドレスは Mac なら `ipconfig getifaddr en0` で分かります）

> 高島屋のページの上で「AIに聞く」を使うには、アプリが `https://` で公開されている必要があります（`https://` のページから `http://` のサーバーへは、ブラウザの安全のルールで通信できないため）。手元では練習ページ（`/practice.html`）で試せます。

### 5. チェック

```bash
npx tsc --noEmit   # 型のチェック
npm run lint       # コードのチェック
npm run build      # 本番用のビルド
```

---

## Vercel に公開する（任意）

```bash
npx vercel login
npx vercel link            # プロジェクトを作ってつなぐ
npx vercel env add ACCESS_CODE production
npx vercel env add GEMINI_MODEL production
npx vercel env add GEMINI_API_KEY production   # AI Studio を使う場合
npx vercel deploy --prod
```

- 公開先のサーバーの場所は `vercel.json` で東京（`hnd1`）にしています。
- `.vercelignore` で `.env*` を送らないようにしています。

### 公開先で Vertex AI を使う場合（キーを使わない方法）

Vercel と Google Cloud を **Workload Identity 連携**でつなぎます。Vercel が発行する「このアプリの公開版です」という証明書を Google Cloud が信用して、Vertex AI を使わせるしくみです（くわしくは [Vercel の説明](https://vercel.com/docs/oidc/gcp)）。

```bash
PROJECT_ID=<GCPのプロジェクトID>
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
TEAM=<Vercelのチーム名（URLの部分）>
SUBJECT="owner:$TEAM:project:kaiin-support:environment:production"
SA=kaiin-support-ai@$PROJECT_ID.iam.gserviceaccount.com

gcloud services enable aiplatform.googleapis.com sts.googleapis.com iamcredentials.googleapis.com --project=$PROJECT_ID
gcloud iam service-accounts create kaiin-support-ai --project=$PROJECT_ID
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA" --role="roles/aiplatform.user"
gcloud iam workload-identity-pools create vercel --project=$PROJECT_ID --location=global
gcloud iam workload-identity-pools providers create-oidc vercel --project=$PROJECT_ID --location=global \
  --workload-identity-pool=vercel --issuer-uri="https://oidc.vercel.com/$TEAM" \
  --allowed-audiences="https://vercel.com/$TEAM" --attribute-mapping="google.subject=assertion.sub" \
  --attribute-condition="assertion.sub == '$SUBJECT'"
gcloud iam service-accounts add-iam-policy-binding $SA --project=$PROJECT_ID --role=roles/iam.workloadIdentityUser \
  --member="principal://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/vercel/subject/$SUBJECT"
```

Vercel に次の環境変数（production）を登録します：
`GCP_PROJECT_ID` `GCP_PROJECT_NUMBER` `GCP_SERVICE_ACCOUNT_EMAIL` `GCP_WORKLOAD_IDENTITY_POOL_ID`（`vercel`） `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`（`vercel`） `GOOGLE_CLOUD_LOCATION`（`global`）

AIのつなぎ方は、`lib/gemini.ts` で次の順に選ばれます。
1. Workload Identity 連携（`GCP_*` がそろっているとき）
2. gcloud のログイン情報で Vertex AI（`GOOGLE_CLOUD_PROJECT`）
3. Google AI Studio の APIキー（`GEMINI_API_KEY`）

---

## ファイルの場所

| ファイル | 役割 |
|---|---|
| `app/page.tsx` | ホーム画面 |
| `app/prepare/PrepareForm.tsx` | 情報の準備画面 |
| `app/register/RegisterGuide.tsx` | 会員登録の案内画面（ブックマークの作り方） |
| `lib/bookmarklet.ts` | 高島屋のページで動く自動入力・AI案内のプログラム |
| `app/assistant/AssistantChat.tsx` | AIに聞く画面 |
| `lib/gemini.ts` / `app/api/assistant/route.ts` | AI（Gemini）とやりとりするサーバー側の処理 |
| `app/sweets/SweetsFinder.tsx` / `lib/dislikes.ts` | おすすめスイーツ画面と、苦手なものの見分け方 |
| `lib/takashimaya.ts` / `app/api/sweets/route.ts` | 高島屋から商品情報を読み取るサーバー側の処理（6時間使い回し） |
| `lib/access.ts` / `lib/accessCode.ts` | 合言葉のチェック |
| `public/practice.html` | 練習用の登録フォーム |

## 注意

- 名前や住所などの情報は、ブラウザとブックマークの中に保存されます。端末には必ず画面ロックをかけてください。
- 準備画面で情報を書きかえたら、ブックマークを登録し直してください。
- 高島屋のページが切りかわると、ブックマークの案内は消えます。新しいページでもう一度押してください。
- 商品情報の読み取りは、高島屋のサイトに負担をかけないよう、結果を6時間使い回し、ページの間に少し間をあけています。
