// Universal Serverless Admin Bot & Approval Engine (api/bot.js)
const TELEGRAM_TOKEN = "8767174145:AAEvhVjTx0wKNxMs2J613oiOdp4XTVThJ0A";
const ADMIN_ID = 2031314339;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot is online.");
  }

  try {
    const payload = req.body;
    
    // 1. Inline Buttons (Approval/Rejection) Callbacks हैंडलर
    if (payload.callback_query) {
      await handleCallback(payload.callback_query);
    } 
    // 2. एडमिन मैसेज हैंडलर
    else if (payload.message) {
      await handleMessage(payload.message);
    }
  } catch (err) {
    console.error("Vercel Error:", err.toString());
  }

  return res.status(200).send("OK");
};

async function handleMessage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text || "";

  // केवल ओनर (Admin) ही इस बॉट का उपयोग कर सकता है
  if (userId !== ADMIN_ID) {
    await sendTelegramMessage(chatId, "⚠️ **Access Denied!** This bot is private.");
    return;
  }

  if (text === "/start") {
    await sendTelegramMessage(chatId, "⚡ **Viral Hub Admin Core Active**\n\nभेजे गए वीडियो अब सिंक होंगे.");
    return;
  }

  // Admin Video Forward (No-Limit Bypass)
  if (message.forward_from_chat && message.forward_from_chat.username && (message.video || message.document)) {
    const channelUsername = message.forward_from_chat.username;
    const messageId = message.forward_from_message_id;
    const directPublicLink = `https://t.me/${channelUsername}/${messageId}`;
    const title = sanitizeTitle(message.caption || "Untitled Highlight");

    const newEntry = {
      id: `vid-${Date.now()}`,
      title: title,
      videoUrl: directPublicLink,
      thumbnailUrl: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=1200&auto=format&fit=crop",
      timestamp: Date.now(),
      duration: "HQ Stream"
    };

    await commitToGitHub(newEntry);
    await sendTelegramMessage(chatId, `✅ **Approved & Live**: *${title}*`);
  }
}

async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  // अप्रूवल लॉजिक
  if (data.startsWith("approve_")) {
    const base64Data = data.replace("approve_", "");
    const decodedVideo = JSON.parse(Buffer.from(base64Data, "base64").toString("utf-8"));

    try {
      await commitToGitHub(decodedVideo);
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: `✅ **APPROVED & LIVE**\n\n🎬 *Title:* ${decodedVideo.title}\n🔗 *Url:* ${decodedVideo.videoUrl}`,
          parse_mode: "Markdown"
        })
      });
    } catch (e) {
      await sendTelegramMessage(chatId, `❌ **Error**: ${e.message}`);
    }
  }

  // रिजेक्शन लॉजिक
  if (data.startsWith("reject_")) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: `❌ **SUBMISSION REJECTED & DELETED**`,
        parse_mode: "Markdown"
      })
    });
  }
}

async function sendTelegramMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
  });
}

async function commitToGitHub(newVideo) {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/videos.json`;
  const headers = { "Authorization": `token ${token}`, "User-Agent": "Vercel-Bot" };

  const getResponse = await fetch(url, { headers });
  let sha = null;
  let currentDatabase = [];

  if (getResponse.status === 200) {
    const data = await getResponse.json();
    sha = data.sha;
    const decoded = Buffer.from(data.content, "base64").toString("utf-8");
    currentDatabase = JSON.parse(decoded);
  }

  currentDatabase.unshift(newVideo);
  const updatedContentBase64 = Buffer.from(JSON.stringify(currentDatabase, null, 2)).toString("base64");

  await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `🤖 Vercel Auto-Sync: ${newVideo.title}`,
      content: updatedContentBase64,
      sha
    })
  });
}

function sanitizeTitle(rawTitle) {
  if (!rawTitle) return `VID_${Date.now()}.mp4`;
  let clean = rawTitle.replace(/https?:\/\/[^\s]+/gi, "");
  clean = clean.replace(/t\.me\/[^\s]+/gi, "");
  clean = clean.replace(/@\w+/g, "").replace(/#\w+/g, "");
  return clean.trim();
}
