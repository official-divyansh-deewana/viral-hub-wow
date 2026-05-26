// Universal Serverless Admin Bot & Metadata Parser Engine (api/bot.js)
const TELEGRAM_TOKEN = "8767174145:AAEvhVjTx0wKNxMs2J613oiOdp4XTVThJ0A";
const ADMIN_ID = 2031314339;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot is online.");
  }

  try {
    const payload = req.body;
    
    // 1. Handling Button Callbacks (Approve / Reject Action)
    if (payload.callback_query) {
      await handleCallback(payload.callback_query);
    } 
    // 2. Handling Commands or Messages
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

  // Only Owner is authorized
  if (userId !== ADMIN_ID) {
    await sendTelegramMessage(chatId, "⚠️ **Access Denied!** This bot is completely private.");
    return;
  }

  if (text === "/start") {
    await sendTelegramMessage(chatId, "⚡ **Viral Hub Admin Core v3.0 Active**\n\nसफलतापूर्वक सिंक मोड ऑन है.");
    return;
  }

  // Admin Direct Video Forward (No-Limit Bypass)
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
  const messageText = query.message.text || "";
  const data = query.data;

  // 1. Approve Callback - Extract from secure text wrappers to bypass 64-byte Telegram limit
  if (data === "approve_user_sub") {
    try {
      const title = messageText.split("[TITLE]")[1].split("[/TITLE]")[0].trim();
      const thumb = messageText.split("[THUMB]")[1].split("[/THUMB]")[0].trim();
      const videoUrl = messageText.split("[URL]")[1].split("[/URL]")[0].trim();

      const newVideo = {
        id: `vid-${Date.now()}`,
        title: title,
        videoUrl: videoUrl,
        thumbnailUrl: thumb,
        timestamp: Date.now(),
        duration: "User Upload"
      };

      await commitToGitHub(newVideo);
      
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: `✅ **APPROVED & GO LIVE**\n\n🎬 *Title:* ${title}\n🔗 *Url:* [Video Stream](${videoUrl})`,
          parse_mode: "Markdown"
        })
      });
    } catch (e) {
      await sendTelegramMessage(chatId, `❌ **Error Parsing Metadata**: ${e.message}`);
    }
  }

  // 2. Reject Callback
  if (data === "reject_user_sub") {
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
  let clean = rawTitle
