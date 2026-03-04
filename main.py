import os
import json
import smtplib
import feedparser
import requests
import anthropic
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GMAIL_ADDRESS = os.getenv("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
EMAIL_TO = os.getenv("EMAIL_TO")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
RSS_URL = os.getenv("RSS_URL")

SEEN_FILE = "seen_articles.json"


def load_seen():
    if os.path.exists(SEEN_FILE):
        with open(SEEN_FILE, "r") as f:
            return set(json.load(f))
    return set()


def save_seen(seen):
    with open(SEEN_FILE, "w") as f:
        json.dump(list(seen), f)


def summarize(title, content):
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": f"""請用繁體中文整理以下 Stratechery 文章的重點筆記。

文章標題：{title}

文章內容：
{content[:4000]}

請提供：
1. **核心論點**（1-2 句話）
2. **重點摘要**（3-5 個 bullet points）
3. **值得關注**（1 個最值得思考的觀點）

格式簡潔，適合快速閱讀。""",
            }
        ],
    )
    return message.content[0].text


def send_email(title, summary, link):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[Stratechery] {title}"
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = EMAIL_TO

    html = f"""
<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #333;">{title}</h2>
  <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; white-space: pre-wrap; line-height: 1.8;">
{summary}
  </div>
  <p style="margin-top: 20px;">
    <a href="{link}" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
      閱讀原文
    </a>
  </p>
  <p style="color: #999; font-size: 12px;">Stratechery Digest · {datetime.now().strftime('%Y-%m-%d')}</p>
</body></html>
"""
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        server.sendmail(GMAIL_ADDRESS, EMAIL_TO, msg.as_string())
    print(f"  ✉ Email 已送出")


def send_telegram(title, summary, link):
    text = f"📰 *{title}*\n\n{summary}\n\n[閱讀原文]({link})"
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    requests.post(url, json={
        "chat_id": TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "Markdown",
        "disable_web_page_preview": False,
    })
    print(f"  ✈ Telegram 已送出")


def main():
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] 檢查 RSS feed...")
    seen = load_seen()
    feed = feedparser.parse(RSS_URL)
    new_articles = [e for e in feed.entries if e.link not in seen]

    if not new_articles:
        print("  沒有新文章。")
        return

    print(f"  發現 {len(new_articles)} 篇新文章")
    for entry in reversed(new_articles):  # 舊的先送
        title = entry.title
        link = entry.link
        content = entry.get("summary", "") or entry.get("content", [{}])[0].get("value", "")
        print(f"  處理：{title}")

        summary = summarize(title, content)
        send_email(title, summary, link)
        send_telegram(title, summary, link)

        seen.add(link)
        save_seen(seen)

    print("完成！")


if __name__ == "__main__":
    main()
