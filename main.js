import Anthropic from "@anthropic-ai/sdk";
import RSSParser from "rss-parser";
import nodemailer from "nodemailer";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEN_FILE = path.join(__dirname, "seen_articles.json");

const {
  ANTHROPIC_API_KEY,
  GMAIL_ADDRESS,
  GMAIL_APP_PASSWORD,
  EMAIL_TO,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  RSS_URL,
} = process.env;

function loadSeen() {
  if (fs.existsSync(SEEN_FILE)) {
    return new Set(JSON.parse(fs.readFileSync(SEEN_FILE, "utf8")));
  }
  return new Set();
}

function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen]));
}

async function summarize(title, content) {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `你是一個懂科技產業的聰明朋友，同時也是有深度投資視野的人。

任務：把以下 Stratechery 文章整理成繁體中文筆記，讓一個聰明但不是專業投資人的朋友能完全理解。

寫作原則：
- 分析要深入、有洞察力，但語言要像在跟朋友解釋，不是在寫報告
- 遇到專業術語時，直接用白話解釋，括號補充術語就好（例如：「股價是否已反映這個消息（price in）」）
- 不用表格，用自然的段落或條列敘述
- 避免：NRR、ARR、EBITDA 等縮寫直接出現而不解釋
- 目標：讀者看完後不需要點原文，而且能跟別人講清楚這篇在說什麼

文章標題：${title}

文章內容：
${content.slice(0, 6000)}

請依以下格式輸出：

## 這篇在說什麼
（用 2-3 句話說清楚。就像你轉述給朋友聽一樣）

## 為什麼現在討論這個
（發生了什麼事，為什麼這個時間點重要）

## 作者怎麼推論的
（這是最重要的部分。一步一步還原作者的思路：他看到什麼事實，怎麼連結到他的結論。每個推論步驟都要寫，不要跳過）

## 最值得記住的觀點
（2-3 個作者最有洞察力的想法，說明為什麼這不是顯而易見的）

---

## 用投資的眼光來看

### 這對哪些公司是好事、哪些是壞事？
（說明受益或受損的理由，用白話解釋，不要只列公司名稱）

### 市場知道這件事了嗎？
（這個趨勢已經反映在股價裡了嗎？還是大多數人還沒意識到？用「股價是否已反映（price in）」這個概念來解釋）

### 這個論點的前提是什麼？
（作者的結論成立，需要哪些假設是真的？如果其中一個假設是錯的，結論會怎麼變？）

### 接下來要觀察什麼？
（哪些新聞或數據出現時，可以幫你判斷這個論點是對是錯）`,
      },
    ],
  });
  return msg.content[0].text;
}

async function sendEmail(title, summary, link) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_ADDRESS, pass: GMAIL_APP_PASSWORD },
  });

  const html = `
<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333;">${title}</h2>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; white-space: pre-wrap; line-height: 1.8;">
${summary}
  </div>
  <p style="margin-top: 20px;">
    <a href="${link}" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
      閱讀原文
    </a>
  </p>
  <p style="color: #999; font-size: 12px;">Stratechery Digest · ${new Date().toISOString().slice(0, 10)}</p>
</body></html>`;

  await transporter.sendMail({
    from: GMAIL_ADDRESS,
    to: EMAIL_TO,
    subject: `[Stratechery] ${title}`,
    html,
  });
  console.log("  ✉ Email 已送出");
}

async function telegramPost(payload) {
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.telegram.org",
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: "POST",
        family: 4,
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        timeout: 15000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          const json = JSON.parse(data);
          if (!json.ok) console.warn("  Telegram warning:", json.description);
          resolve();
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Telegram timeout")); });
    req.write(body);
    req.end();
  });
}

async function sendTelegram(title, summary, link) {
  const LIMIT = 3800;
  const full = `📰 ${title}\n\n${summary}\n\n🔗 ${link}`;

  if (full.length <= LIMIT) {
    await telegramPost({ chat_id: TELEGRAM_CHAT_ID, text: full, disable_web_page_preview: true });
  } else {
    // 按段落切分，每段不超過 LIMIT
    const sections = full.split(/\n(?=## |# )/);
    let chunk = "";
    let partNum = 1;
    for (const section of sections) {
      if ((chunk + "\n" + section).length > LIMIT) {
        if (chunk) await telegramPost({ chat_id: TELEGRAM_CHAT_ID, text: chunk.trim(), disable_web_page_preview: true });
        chunk = section;
        partNum++;
      } else {
        chunk = chunk ? chunk + "\n" + section : section;
      }
    }
    if (chunk) await telegramPost({ chat_id: TELEGRAM_CHAT_ID, text: chunk.trim(), disable_web_page_preview: true });
  }

  console.log("  ✈ Telegram 已送出");
}

async function main() {
  const now = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  console.log(`[${now}] 檢查 RSS feed...`);

  const seen = loadSeen();
  const parser = new RSSParser();
  const feed = await parser.parseURL(RSS_URL);

  const newArticles = feed.items.filter((item) => !seen.has(item.link));

  if (newArticles.length === 0) {
    console.log("  沒有新文章。");
    return;
  }

  console.log(`  發現 ${newArticles.length} 篇新文章`);

  for (const entry of newArticles.reverse()) {
    const title = entry.title;
    const link = entry.link;
    const content = entry.contentSnippet || entry.content || entry.summary || "";

    console.log(`  處理：${title}`);
    const summary = await summarize(title, content);

    await sendEmail(title, summary, link);
    await sendTelegram(title, summary, link);

    seen.add(link);
    saveSeen(seen);
  }

  console.log("完成！");
}

main().catch(console.error);
