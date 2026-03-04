// 只測試最新一篇文章
import RSSParser from "rss-parser";
import Anthropic from "@anthropic-ai/sdk";
import nodemailer from "nodemailer";
import * as https from "https";
import dotenv from "dotenv";
dotenv.config();

const { ANTHROPIC_API_KEY, GMAIL_ADDRESS, GMAIL_APP_PASSWORD, EMAIL_TO, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, RSS_URL } = process.env;

async function summarize(title, content) {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: `你是一個懂科技產業的聰明朋友，同時也是有深度投資視野的人。\n\n任務：把以下 Stratechery 文章整理成繁體中文筆記，讓一個聰明但不是專業投資人的朋友能完全理解。\n\n寫作原則：\n- 分析要深入、有洞察力，但語言要像在跟朋友解釋，不是在寫報告\n- 遇到專業術語時，直接用白話解釋，括號補充術語就好（例如：「股價是否已反映這個消息（price in）」）\n- 不用表格，用自然的段落或條列敘述\n- 避免：NRR、ARR、EBITDA 等縮寫直接出現而不解釋\n- 目標：讀者看完後不需要點原文，而且能跟別人講清楚這篇在說什麼\n\n文章標題：${title}\n\n文章內容：\n${content.slice(0, 6000)}\n\n請依以下格式輸出：\n\n## 這篇在說什麼\n（用 2-3 句話說清楚。就像你轉述給朋友聽一樣）\n\n## 為什麼現在討論這個\n（發生了什麼事，為什麼這個時間點重要）\n\n## 作者怎麼推論的\n（這是最重要的部分。一步一步還原作者的思路：他看到什麼事實，怎麼連結到他的結論。每個推論步驟都要寫，不要跳過）\n\n## 最值得記住的觀點\n（2-3 個作者最有洞察力的想法，說明為什麼這不是顯而易見的）\n\n---\n\n## 用投資的眼光來看\n\n### 這對哪些公司是好事、哪些是壞事？\n（說明受益或受損的理由，用白話解釋，不要只列公司名稱）\n\n### 市場知道這件事了嗎？\n（這個趨勢已經反映在股價裡了嗎？還是大多數人還沒意識到？用「股價是否已反映（price in）」這個概念來解釋）\n\n### 這個論點的前提是什麼？\n（作者的結論成立，需要哪些假設是真的？如果其中一個假設是錯的，結論會怎麼變？）\n\n### 接下來要觀察什麼？\n（哪些新聞或數據出現時，可以幫你判斷這個論點是對是錯）` }],
  });
  return msg.content[0].text;
}

async function telegramPost(payload) {
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: "POST", family: 4,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      timeout: 15000,
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => { const j = JSON.parse(data); if (!j.ok) console.warn("  Telegram:", j.description); resolve(); });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.write(body); req.end();
  });
}

async function sendTelegram(title, summary, link) {
  const LIMIT = 3800;
  const full = `📰 ${title}\n\n${summary}\n\n🔗 ${link}`;
  if (full.length <= LIMIT) {
    await telegramPost({ chat_id: TELEGRAM_CHAT_ID, text: full, disable_web_page_preview: true });
  } else {
    const sections = full.split(/\n(?=## |# )/);
    let chunk = "";
    for (const section of sections) {
      if ((chunk + "\n" + section).length > LIMIT) {
        if (chunk) await telegramPost({ chat_id: TELEGRAM_CHAT_ID, text: chunk.trim(), disable_web_page_preview: true });
        chunk = section;
      } else {
        chunk = chunk ? chunk + "\n" + section : section;
      }
    }
    if (chunk) await telegramPost({ chat_id: TELEGRAM_CHAT_ID, text: chunk.trim(), disable_web_page_preview: true });
  }
  console.log("  ✈ Telegram 已送出");
}

async function sendEmail(title, summary, link) {
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_ADDRESS, pass: GMAIL_APP_PASSWORD } });
  const html = `<html><body style="font-family:Arial;max-width:600px;margin:0 auto;padding:20px"><h2>${title}</h2><div style="background:#f5f5f5;padding:15px;border-radius:8px;white-space:pre-wrap;line-height:1.8">${summary}</div><p><a href="${link}" style="background:#0066cc;color:white;padding:10px 20px;text-decoration:none;border-radius:5px">閱讀原文</a></p></body></html>`;
  await transporter.sendMail({ from: GMAIL_ADDRESS, to: EMAIL_TO, subject: `[Stratechery] ${title}`, html });
  console.log("  ✉ Email OK");
}

const parser = new RSSParser();
const feed = await parser.parseURL(RSS_URL);
const latest = feed.items[0];
console.log("測試文章:", latest.title);
const content = latest.contentSnippet || latest.content || latest.summary || "";
const summary = await summarize(latest.title, content);
console.log("\n--- 摘要 ---\n" + summary + "\n");
await sendEmail(latest.title, summary, latest.link);
await sendTelegram(latest.title, summary, latest.link);
console.log("測試完成！");
