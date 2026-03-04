# RSS Digest 自動摘要推送

這個工具會每天早上 8:00 自動幫你做以下幾件事：
1. 抓取你訂閱的 RSS feed，檢查有沒有新文章
2. 用 Claude AI 閱讀每篇新文章，整理成繁體中文筆記（包含作者論點還原 + 投資視角分析）
3. 同時推送到你的 Email 和 Telegram

---

## 目錄

- [部署到雲端（電腦關機也能跑）](#部署到雲端github-actions)
- [檔案結構說明](#檔案結構說明)
- [系統如何運作](#系統如何運作)
- [日常使用：手動執行與測試](#日常使用手動執行與測試)
- [修改摘要的內容風格](#修改摘要的內容風格)
- [新增 RSS 訂閱來源](#新增-rss-訂閱來源)
- [修改自動執行時間](#修改自動執行時間)
- [更換憑證（API Key、密碼）](#更換憑證)
- [更換推送對象（Email 或 Telegram）](#更換推送對象)
- [重置推送記錄](#重置推送記錄)
- [查看執行記錄](#查看執行記錄)
- [常見問題](#常見問題)

---

## 部署到雲端（GitHub Actions）

把程式放到 GitHub 上，讓 GitHub 的伺服器每天定時幫你執行，**不需要電腦開機**。完全免費，設定一次就永久運作。

> **GitHub Actions 是什麼？**
> GitHub 是全球最大的程式碼託管平台。GitHub Actions 是它提供的「自動化排程服務」，你可以告訴它「每天早上幾點幫我跑這個程式」，它就會自動執行，跟你的電腦完全無關。

---

### 步驟一：建立 GitHub 帳號

1. 前往 https://github.com，點右上角「Sign up」
2. 輸入 Email、密碼、用戶名，完成驗證
3. 選免費方案（Free）

---

### 步驟二：建立一個私人 Repository（程式碼倉庫）

> Repository 就像一個雲端資料夾，專門存放這個專案的所有程式碼。設定為「私人（Private）」讓只有你能看到。

1. 登入 GitHub 後，點右上角的 `+` → `New repository`
2. 填寫設定：
   - **Repository name**：`rss-digest`（或任何你喜歡的名稱）
   - **Visibility**：選 **Private**（私人，重要！）
   - 其他選項保持預設，不要勾選任何 Initialize 選項
3. 點 **Create repository**

---

### 步驟三：安裝 Git 並上傳程式碼

> Git 是一個版本控制工具，用來把你電腦上的程式碼同步到 GitHub。

**安裝 Git（如果還沒安裝）：**
1. 前往 https://git-scm.com/download/win，下載 Windows 版安裝檔
2. 執行安裝，全部選預設值，一直按 Next 就好

**上傳程式碼：**

打開命令提示字元（`Win + R` → `cmd`），輸入以下指令：

```
cd C:\Users\tsung\rss-digest
git init
git add .
git commit -m "first commit"
```

接著到 GitHub 剛建立的 repository 頁面，複製它顯示的指令（類似下面這樣，但網址是你自己的）：

```
git remote add origin https://github.com/你的帳號/rss-digest.git
git branch -M main
git push -u origin main
```

> 第一次 push 時，瀏覽器可能會跳出 GitHub 登入視窗，正常登入即可。

上傳完成後，重新整理 GitHub 的 repository 頁面，你應該能看到所有程式碼檔案（`.env` 不會出現，因為 `.gitignore` 已排除它，這是正確的）。

---

### 步驟四：把所有密碼和 API Key 存到 GitHub Secrets

> `.env` 檔案不會上傳到 GitHub（為了安全），所以需要把裡面的內容另外存到 GitHub 的「Secrets（機密變數）」功能。GitHub Actions 執行時會自動讀取這些 Secrets。

1. 在你的 repository 頁面，點上方的 **Settings** 標籤
2. 左側選單找到 **Secrets and variables** → 點 **Actions**
3. 點右上角的 **New repository secret**
4. 依序新增以下 7 個 Secret（Name 和 Secret 要完全一致）：

| Name | Secret 的值（從你的 .env 複製） |
|------|-------------------------------|
| `ANTHROPIC_API_KEY` | 你的 Claude API key |
| `GMAIL_ADDRESS` | `tsungta.wu@gmail.com` |
| `GMAIL_APP_PASSWORD` | 你的 Gmail 應用程式密碼（16碼） |
| `EMAIL_TO` | 收件人 Email |
| `TELEGRAM_BOT_TOKEN` | 你的 Telegram Bot Token |
| `TELEGRAM_CHAT_ID` | `650566516` |
| `RSS_URL` | 你的 RSS feed 網址 |

每個都要分開新增，點「New repository secret」→ 填 Name 和 Secret → 點「Add secret」。

---

### 步驟五：確認 Workflow 已啟用

1. 在 repository 頁面點 **Actions** 標籤
2. 第一次進去可能會看到一個提示「I understand my workflows...」，點綠色按鈕啟用
3. 左側應該看到「RSS Digest 每日推送」這個 workflow

---

### 步驟六：手動測試一次

不要等到明天早上，現在就手動觸發確認有沒有問題：

1. 在 **Actions** 頁面，點左側的「RSS Digest 每日推送」
2. 點右側的 **Run workflow** 按鈕
3. 點綠色的 **Run workflow** 確認
4. 頁面會出現一個執行記錄，點進去可以看到即時 log
5. 全部打勾（✅）代表成功，去確認 Email 和 Telegram 是否收到推送

如果出現紅色叉叉（❌），點進去看錯誤訊息，最常見的問題是某個 Secret 填錯了。

---

### 完成！之後的運作方式

- 每天台灣時間早上 **8:00**，GitHub 的伺服器會自動執行 `main.js`
- 執行完後，`seen_articles.json` 會自動更新並存回 GitHub（不需要你的電腦參與）
- 你的電腦完全不需要開機
- 可以隨時在 GitHub 的 Actions 頁面查看每次執行的記錄

---

### 之後修改程式碼怎麼更新到 GitHub？

每次修改 `main.js`（例如調整 prompt）之後，需要重新上傳到 GitHub：

```
cd C:\Users\tsung\rss-digest
git add .
git commit -m "更新 prompt"
git push
```

這樣下次 GitHub Actions 執行時就會用新的版本。

---

## 檔案結構說明

```
C:\Users\tsung\rss-digest\
│
├── main.js              主程式。每天排程會執行這個檔案。
│                        它會抓新文章、呼叫 Claude API 整理、發送到 Email 和 Telegram。
│
├── test.js              測試用程式。只處理最新一篇文章，不會記錄「已發送」。
│                        修改 prompt 或設定後，用這個來確認效果，不影響正式運作。
│
├── .env                 所有的帳號、密碼、API Key 都存在這裡。
│                        這個檔案不要傳給別人、不要上傳到網路。
│
├── seen_articles.json   程式自動維護的記錄檔。
│                        裡面存著「已經推送過的文章網址」，避免同一篇文章重複推送。
│                        不需要手動修改，程式會自己更新。
│
├── log.txt              每次執行的運作記錄。
│                        如果某天沒收到推送，可以打開這個檔案看是否有錯誤訊息。
│
├── run.bat              Windows 排程用的啟動腳本。
│                        排程器每天定時執行這個檔案，它再去呼叫 main.js。
│
├── package.json         Node.js 專案設定檔，記錄這個程式用到哪些套件。
│                        通常不需要手動修改。
│
└── node_modules/        套件的實際程式碼。自動安裝，不需要動。
```

---

## 系統如何運作

整個流程如下：

```
每天 8:00
    ↓
Windows 工作排程器 呼叫 run.bat
    ↓
run.bat 執行 node main.js
    ↓
main.js 讀取 .env 裡的設定
    ↓
抓取 RSS feed，和 seen_articles.json 比對，找出「新文章」
    ↓
對每篇新文章：
  → 呼叫 Claude API（用 .env 裡的 ANTHROPIC_API_KEY）
  → Claude 根據 prompt 產出繁體中文筆記
    ↓
同時發送：
  → Gmail（用 GMAIL_ADDRESS + GMAIL_APP_PASSWORD）
  → Telegram Bot（用 TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID）
    ↓
把這篇文章的網址存進 seen_articles.json，下次不會重複推送
    ↓
執行結果寫入 log.txt
```

---

## 日常使用：手動執行與測試

### 開啟終端機

按 `Win + R`，輸入 `cmd`，按 Enter，開啟命令提示字元。

### 切換到專案資料夾

```
cd C:\Users\tsung\rss-digest
```

### 手動執行一次（正式）

```
node main.js
```

這會正常執行：抓新文章、整理、推送、並更新已推送記錄。
如果今天排程沒跑到（例如電腦關機），可以手動補跑。

### 測試最新一篇（不影響正式記錄）

```
node test.js
```

這只會處理 RSS feed 中最新的一篇文章，**不會**更新 `seen_articles.json`。
適合在你修改 prompt 之後，確認輸出效果是否符合預期，可以反覆執行。

---

## 修改摘要的內容風格

摘要的風格和格式是由 **prompt（指令）** 決定的。Prompt 就是你給 Claude AI 的指示，告訴它要怎麼整理文章。

### 找到 prompt 的位置

用任何文字編輯器（記事本、VS Code 都可以）打開 `main.js`。

跳到第 **44 行**左右，找到這段文字：

```js
content: `你是一個懂科技產業的聰明朋友，同時也是有深度投資視野的人。

任務：把以下 Stratechery 文章整理成繁體中文筆記...
```

這一整段用反引號（`` ` ``）包住的文字，就是你可以自由修改的 prompt。

### 修改範例

**想要更簡短的摘要？**
在 prompt 裡加上：`每個段落不超過 3 句話，整體不超過 500 字。`

**想改成英文輸出？**
把 `繁體中文` 改成 `English`。

**想拿掉投資分析的部分？**
把 `## 用投資的眼光來看` 那整個段落的指示刪掉。

**想新增「一句話摘要」在最前面？**
在格式說明最前面加上：
```
## 一句話總結
（用一句話讓人知道這篇在講什麼）
```

### 改完怎麼確認效果

存檔後，執行：

```
node test.js
```

你會在終端機看到 Claude 產出的完整筆記內容，也會同時收到 Email 和 Telegram 推送。
確認滿意後，下一次 `main.js` 正式執行就會用新的 prompt。

---

## 新增 RSS 訂閱來源

### 步驟一：找到新的 RSS 網址

大多數部落格或新聞網站都有 RSS feed。常見的網址格式：
- `https://example.com/feed`
- `https://example.com/rss`
- `https://example.com/feed.xml`

你也可以直接在 Google 搜尋「[網站名稱] RSS feed」。

### 步驟二：修改 .env 檔案

用記事本打開 `C:\Users\tsung\rss-digest\.env`。

目前長這樣：
```
RSS_URL=https://stratechery.passport.online/feed/rss/xxxxx
```

改成（多條 URL 用逗號分隔，中間不要有空格）：
```
RSS_URL=https://stratechery.passport.online/feed/rss/xxxxx,https://第二個rss網址,https://第三個rss網址
```

### 步驟三：修改 main.js 讀取多個 URL

用文字編輯器打開 `main.js`，找到最上面讀取環境變數的地方（約第 12 行）：

```js
const RSS_URL = process.env.RSS_URL;
```

改成：

```js
const RSS_URLS = process.env.RSS_URL.split(",").map(s => s.trim());
```

然後找到 `main()` 函式裡的這一行（約第 130 行）：

```js
const feed = await parser.parseURL(RSS_URL);
const newArticles = feed.items.filter((item) => !seen.has(item.link));
```

改成：

```js
for (const url of RSS_URLS) {
  const feed = await parser.parseURL(url);
  const newArticles = feed.items.filter((item) => !seen.has(item.link));
  // 底下的 if (!newArticles.length)... 到 saveSeen(seen) 這段維持不變，整體包在這個 for 迴圈裡
}
```

### 改完測試

```
node test.js
```

test.js 只會跑第一個 RSS 來源的最新文章，確認流程沒壞就好。
正式執行時 `main.js` 會處理所有來源。

---

## 修改自動執行時間

目前設定為每天早上 **8:00**。

### 方法一：用 Windows 工作排程器（圖形介面，比較直覺）

1. 按 `Win` 鍵，搜尋「工作排程器」，點開它
2. 在左側找到「工作排程器程式庫」
3. 在右側清單找到 **StratecheryDigest**，雙擊它
4. 點上方的「觸發程序」標籤
5. 選到那條觸發程序，點下方的「編輯」
6. 修改「開始時間」欄位，改成你要的時間
7. 點確定儲存

### 方法二：用指令重新建立排程

打開命令提示字元（`Win + R` → `cmd`），輸入以下指令（把 `07:30` 換成你要的時間）：

```
schtasks /create /tn "StratecheryDigest" /tr "C:\Users\tsung\rss-digest\run.bat" /sc daily /st 07:30 /f
```

`/f` 的意思是「若已存在就覆蓋」，所以不用先刪除舊的排程。

### 注意事項

- 電腦必須是開機狀態才能觸發排程
- 如果設定的時間電腦是睡眠狀態，該次執行會跳過
- 可以在工作排程器裡設定「若錯過，請在電腦重新開機後盡快執行」

---

## 更換憑證

所有帳號和密碼都存在 `.env` 檔案裡。用記事本打開 `C:\Users\tsung\rss-digest\.env` 就能修改。

### 各欄位說明

**`ANTHROPIC_API_KEY`**
Claude AI 的 API 金鑰。用來呼叫 Claude 整理文章。
- 取得方式：登入 https://console.anthropic.com → API Keys → Create Key
- 格式：`sk-ant-api03-xxxxxx...`
- 注意：這個 key 按使用量計費，不要分享給別人

**`GMAIL_ADDRESS`**
寄信用的 Gmail 帳號。填完整的 Gmail 地址，例如 `yourname@gmail.com`。

**`GMAIL_APP_PASSWORD`**
Gmail 的「應用程式密碼」，不是你平常登入 Gmail 的密碼。
- 取得方式：
  1. 登入 https://myaccount.google.com/security
  2. 確認「兩步驟驗證」已開啟
  3. 前往 https://myaccount.google.com/apppasswords
  4. 輸入名稱（例如 RSS Bot），點「建立」
  5. 複製產生的 16 位密碼（格式像 `xxxx xxxx xxxx xxxx`）
- 注意：產生後只顯示一次，記得立刻複製

**`EMAIL_TO`**
要收信的 Email 地址。可以和寄件人 `GMAIL_ADDRESS` 相同（自己寄給自己），也可以填別的地址。

**`TELEGRAM_BOT_TOKEN`**
Telegram Bot 的身份金鑰。
- 取得方式：在 Telegram 搜尋 @BotFather → `/mybots` → 選你的 bot → API Token
- 格式：`1234567890:ABCDEFxxxxxx`
- 注意：這個 token 等同於 bot 的控制權，不要分享給別人

**`TELEGRAM_CHAT_ID`**
你的 Telegram 個人 ID（數字）。程式用這個數字知道要把訊息推送給誰。
- 目前設定：`650566516`
- 如果要推送給不同的人：對方要先去找 @userinfobot，發送 `/start`，它會回傳對方的 Chat ID

**`RSS_URL`**
要訂閱的 RSS feed 網址。

---

## 更換推送對象

### 更換收件 Email

打開 `.env`，修改 `EMAIL_TO` 欄位，改成新的 Email 地址。

### 更換 Telegram 推送對象

1. 請對方在 Telegram 搜尋 **@userinfobot**，發送 `/start`，取得他們的 Chat ID（一串數字）
2. 請對方在 Telegram 搜尋你的 bot（`@Strachery_Digest_TTW_bot`），按 Start 啟動它
3. 打開 `.env`，把 `TELEGRAM_CHAT_ID` 改成對方的數字

### 新增多個 Telegram 推送對象

打開 `main.js`，找到 `sendTelegram` 函式（約第 118 行），
在函式最上方把單一 Chat ID 改成陣列：

```js
async function sendTelegram(title, summary, link) {
  const chatIds = [TELEGRAM_CHAT_ID, "另一個人的ChatID", "第三個人的ChatID"];

  for (const chatId of chatIds) {
    // 把底下所有 TELEGRAM_CHAT_ID 換成 chatId
  }
}
```

---

## 重置推送記錄

`seen_articles.json` 記錄著「哪些文章已經推送過」。如果你想重新推送某些文章，可以修改這個檔案。

### 全部重推（重送所有文章）

**警告：RSS feed 裡有多少篇文章，就會推送多少次。目前 Stratechery 的 feed 有約 50 篇，會一次收到 50 封 Email + 50 組 Telegram 訊息。**

如果確定要這樣做：
用檔案總管找到 `C:\Users\tsung\rss-digest\seen_articles.json`，直接刪除這個檔案。
下次執行 `main.js` 時，程式會把所有文章都視為「新文章」。

### 只重推特定幾篇

用記事本打開 `seen_articles.json`，裡面是這樣的格式：

```json
[
  "https://stratechery.com/2026/article-one/",
  "https://stratechery.com/2026/article-two/",
  "https://stratechery.com/2026/article-three/"
]
```

找到你想重新推送的那篇文章網址，把那行刪掉（注意 JSON 格式：除了最後一項，每行結尾要有逗號），存檔。
下次執行時，程式會把那篇文章視為新文章重新處理。

---

## 查看執行記錄

每次 `main.js` 執行後，結果會寫入 `log.txt`。

用記事本打開 `C:\Users\tsung\rss-digest\log.txt`，可以看到每次執行的時間和狀況。

正常的 log 長這樣：
```
[2026/3/5 上午8:00:01] 檢查 RSS feed...
  發現 1 篇新文章
  處理：Anthropic's Skyrocketing Revenue...
  ✉ Email 已送出
  ✈ Telegram 已送出
完成！
```

沒有新文章時：
```
[2026/3/5 上午8:00:01] 檢查 RSS feed...
  沒有新文章。
```

如果有錯誤，log 裡會有 `Error:` 開頭的訊息，可以根據訊息內容判斷問題所在。

---

## 常見問題

**Q：今天沒收到推送，怎麼辦？**

1. 先確認電腦在 8:00 是開機狀態（不是睡眠）
2. 打開 `log.txt` 看看有沒有執行記錄，以及是否有錯誤訊息
3. 手動執行 `node main.js` 補跑一次
4. 如果有錯誤訊息，根據訊息判斷（例如 `401` 代表 API key 失效，`535` 代表 Gmail 密碼有問題）

**Q：RSS feed 沒有新文章，為什麼還是收到了？**

你可能刪除了 `seen_articles.json`，或者是 `test.js` 被當成 `main.js` 執行了。
`test.js` 每次都會推送最新一篇，不管有沒有推過。

**Q：想把摘要同時發給多人，可以嗎？**

可以。參考上方「新增多個 Telegram 推送對象」或直接修改 `EMAIL_TO` 欄位，多個 Email 地址用逗號分隔：
```
EMAIL_TO=a@gmail.com,b@gmail.com
```

**Q：Claude API 的費用大概多少？**

每篇文章大約消耗 1,000–3,000 tokens（取決於文章長度和 prompt 長度）。
以 claude-sonnet-4-6 的定價，每篇文章的費用約 **$0.01–0.03 美元**。
一個月 30 篇文章大約 **$0.3–$1 美元**。

**Q：想換一個 AI 模型（例如用更便宜的），怎麼改？**

打開 `main.js`，找到這行（約第 37 行）：
```js
model: "claude-sonnet-4-6",
```
可以改成其他 Claude 模型，例如更便宜的 `claude-haiku-4-5-20251001`。
品質會略降，但速度更快、費用更低。
