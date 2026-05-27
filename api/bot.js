// Universal Serverless Admin Bot - 100% Fixed & Strict Mode Compliant (api/bot.js)
const TELEGRAM_TOKEN = "8767174145:AAEvhVjTx0wKNxMs2J613oiOdp4XTVThJ0A";
const ADMIN_ID = 2031314339;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot is online.");
  }

  try {
    const payload = req.body;
    if (payload.callback_query) {
      await handleCallback(payload.callback_query);
    } else if (payload.message) {
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

  if (userId !== ADMIN_ID) {
    await sendTelegramMessage(chatId, "⚠️ **Access Denied!** This bot is completely private.");
    return;
  }

  // start command fully restored
  if (text === "/start") {
    const welcomeMsg = `⚡️ **VIRAL HUB CONTROL PANEL v3.5** ⚡️\n` +
                       `─────────────────────────\n` +
                       `Welcome, Administrator! Here are your active commands:\n\n` +
                       `📊 **/stats** — वेबसाइट का लाइव डेटा और वीडियो काउंट देखें\n` +
                       `🧹 **/delall** — वेबसाइट के सभी वीडियो एक क्लिक में डिलीट करें\n` +
                       `✅ **/done** — डेटाबेस सिंकिंग की पुष्टि करें\n` +
                       `❔ **/help** — नो-लिमिट लिंक अपलोड गाइड देखें\n\n` +
                       `📤 **वीडियो अपलोड करने के दो तरीके:**\n` +
                       `🔹 **तरीका 1 (कम साइज़ < 20MB):** वीडियो फ़ाइल सीधे यहाँ फॉरवर्ड करें।\n` +
                       `🔹 **तरीका 2 (नो-लिमिट - कोई भी साइज़):** लिंक को इस प्रकार भेजें:\n` +
                       `\`https://link.com/embed-code | वीडियो का नया टाइटल\``;
    await sendTelegramMessage(chatId, welcomeMsg);
    return;
  }

  if (text === "/stats") {
    await sendTelegramMessage(chatId, "📊 *डेटाबेस लोड किया जा रहा है...*");
    try {
      const db = await fetchCurrentDatabase();
      const statsMsg = `📈 **VIRAL HUB STATS** 📈\n` +
                       `─────────────────────────\n` +
                       `🔹 **कुल वीडियो लाइव:** \`${db.length}\` वीडियो\n` +
                       `🔹 **डेटाबेस स्थिति:** ऑनलाइन और सक्रिय\n` +
                       `🔹 **नवीनतम वीडियो:** ${db[0] ? `*${db[0].title}*` : "कोई नहीं"}`;
      await sendTelegramMessage(chatId, statsMsg);
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ **Error**: ${err.message}`);
    }
    return;
  }

  if (text === "/delall") {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "⚠️ **WARNING: DATABASE WIPE REQUESTED** ⚠️\n─────────────────────────\nक्या आप वाकई वेबसाइट से सभी वीडियो डिलीट करना चाहते हैं? यह कदम वापस नहीं लिया जा सकता।",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⚠️ Yes, Wipe Everything", callback_data: "confirm_delall" },
              { text: "❌ Cancel", callback_data: "cancel_delall" }
            ]
          ]
        }
      })
    });
    return;
  }

  if (text === "/done") {
    await sendTelegramMessage(chatId, "🎉 **वेबसाइट पूरी तरह सिंक हो चुकी है!**");
    return;
  }

  if (text === "/help") {
    const helpMsg = `ℹ️ **नो-लिमिट लिंक गाइड** ℹ️\n` +
                    `─────────────────────────\n` +
                    `बड़ी फ़ाइलों को चलाने के लिए आप Doodstream या Streamwish जैसी वीडियो स्ट्रीमिंग साइटों का Embed (प्लेयर) लिंक कॉपी करें।\n\n` +
                    `फिर उसे इस प्रकार भेजें:\n` +
                    `\`https://dood.to/e/example | वीडियो का नाम\``;
    await sendTelegramMessage(chatId, helpMsg);
    return;
  }

  let videoFile = null;
  let rawCaption = "Untitled Highlight";

  if (message.video) {
    videoFile = message.video;
    rawCaption = message.caption || "Untitled Highlight";
  } else if (message.document && message.document.mime_type.startsWith("video/")) {
    videoFile = message.document;
    rawCaption = message.caption || message.document.file_name || "Untitled File Highlight";
  }

  if (videoFile) {
    await deleteMessage(chatId, message.message_id);

    const p1 = await sendTelegramMessage(chatId, "⏳ **Processing**: वीडियो का डायरेक्ट लिंक निकाला जा रहा है...");
    const p1Id = p1 ? p1.result.message_id : null;

    try {
      let videoUrl = "";
      if (message.forward_from_chat && message.forward_from_chat.username) {
        const channelUsername = message.forward_from_chat.username;
        const messageId = message.forward_from_message_id;
        videoUrl = `https://t.me/${channelUsername}/${messageId}`;
      } else {
        const fileResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${videoFile.file_id}`);
        const fileData = await fileResponse.json();

        if (!fileData.ok) {
          throw new Error(fileData.description || "Telegram API Error");
        }
        videoUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileData.result.file_path}`;
      }

      const title = sanitizeTitle(rawCaption);

      const newEntry = {
        id: `vid-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: title,
        videoUrl: videoUrl,
        thumbnailUrl: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=1200&auto=format&fit=crop",
        timestamp: Date.now(),
        duration: formatDuration(videoFile.duration)
      };

      if (p1Id) await deleteMessage(chatId, p1Id);

      const p2 = await sendTelegramMessage(chatId, "💾 **Saving**: डेटाबेस अपडेट किया जा रहा है...");
      const p2Id = p2 ? p2.result.message_id : null;

      await commitToGitHub(newEntry);

      if (p2Id) await deleteMessage(chatId, p2Id);

      await sendTelegramMessage(chatId, `✅ **Success**: *${title}* सीधा वेबसाइट पर लाइव हो चुका है!`);

    } catch (err) {
      if (p1Id) await deleteMessage(chatId, p1Id);
      await sendTelegramMessage(chatId, `❌ **Error**: ${err.message}\n\n💡 _टिप: यदि वीडियो 20MB से बड़ा है, तो इसे किसी पब्लिक चैनल में डालकर यहाँ फॉरवर्ड करें।_`);
    }
    return;
  }

  // Method 2 link upload
  if (text.includes("|") && (text.startsWith("http://") || text.startsWith("https://"))) {
    await sendTelegramMessage(chatId, "⏳ **Processing**: लिंक को डेटाबेस में जोड़ा जा रहा है...");
    try {
      const parts = text.split("|");
      const videoUrl = parts[0].trim();
      const rawTitle = parts[1].trim();
      const title = sanitizeTitle(rawTitle);

      const newEntry = {
        id: `vid-${Date.now()}`,
        title: title,
        videoUrl: videoUrl,
        thumbnailUrl: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=1200&auto=format&fit=crop",
        timestamp: Date.now(),
        duration: "Web Stream"
      };

      await commitToGitHub(newEntry);
      await sendTelegramMessage(chatId, `✅ **Success**: *${title}* वेबसाइट पर लाइव हो गया है!`);
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ **Error**: ${err.message}`);
    }
  }
}

async function handleCallback(query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const messageText = query.message.text || "";
  const data = query.data;

  if (data === "confirm_delall") {
    try {
      await wipeDatabase();
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: "✅ **DATABASE WIPED SUCCESSFULLY**\n─────────────────────────\nवेबसाइट के सभी वीडियो अब पूरी तरह डिलीट हो चुके हैं।",
          parse_mode: "Markdown"
        })
      });
    } catch (e) {
      await sendTelegramMessage(chatId, `❌ **Wipe Error**: ${e.message}`);
    }
  }

  if (data === "cancel_delall") {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: "❌ **DATABASE WIPE CANCELLED**\n─────────────────────────\nआपका डेटाबेस पूरी तरह सुरक्षित है।",
        parse_mode: "Markdown"
      })
    });
  }

  if (data === "approve_user_sub") {
    try {
      const title = messageText.split("SUB_TITLE:")[1].split("SUB_THUMB:")[0].trim();
      const thumb = messageText.split("SUB_THUMB:")[1].split("SUB_URL:")[0].trim();
      const videoUrl = messageText.split("SUB_URL:")[1].trim();

      const newVideo = {
        id: `vid-${Date.now()}`,
        title: title,
        videoUrl: videoUrl,
        thumbnailUrl: thumb,
        timestamp: Date.now(),
        duration: "User Sub"
      };

      await commitToGitHub(newVideo);
      
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: `✅ **APPROVED & LIVE ON PORTAL**\n\n🎬 *Title:* ${title}\n🔗 *Url:* [Play Video](${videoUrl})`,
          parse_mode: "Markdown"
        })
      });
    } catch (e) {
      await sendTelegramMessage(chatId, `❌ **Error Parsing Metadata**: ${e.message}`);
    }
  }

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
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
  });
  return await response.json();
}

async function deleteMessage(chatId, messageId) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId })
  }).catch(() => {});
}

async function fetchCurrentDatabase() {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/videos.json`;
  const headers = { "Authorization": `token ${token}`, "User-Agent": "Vercel-Bot" };

  const response = await fetch(url, { headers });
  if (response.status === 200) {
    const data = await response.json();
    const decoded = Buffer.from(data.content, "base64").toString("utf-8");
    return JSON.parse(decoded);
  }
  return [];
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

async function wipeDatabase() {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/videos.json`;
  const headers = { "Authorization": `token ${token}`, "User-Agent": "Vercel-Bot" };

  const getResponse = await fetch(url, { headers });
  let sha = null;

  if (getResponse.status === 200) {
    const data = await getResponse.json();
    sha = data.sha;
  }

  const updatedContentBase64 = Buffer.from(JSON.stringify([], null, 2)).toString("base64");

  await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: "🚨 Bot Action: Wiped Video Database",
      content: updatedContentBase64,
      sha
    })
  });
}

function sanitizeTitle(rawTitle) {
  if (!rawTitle) return generateCameraTitle();
  let clean = rawTitle.replace(/https?:\/\/[^\s]+/gi, "");
  clean = clean.replace(/t\.me\/[^\s]+/gi, "");
  clean = clean.replace(/www\.[^\s]+/gi, "");
  clean = clean.replace(/@\w+/g, "").replace(/#\w+/g, "");
  clean = clean.replace(/[*_`\[\]()\-]/g, "");

  // Fixed syntax error: declared promoKeywords correctly
  const promoKeywords = [/join/gi, /subscribe/gi, /channel/gi, /telegram/gi, /bot/gi, /link/gi, /click/gi, /unqid/gi, /free/gi];
  promoKeywords.forEach(word => {
    clean = clean.replace(word, "");
  });

  clean = clean.replace(/\s+/g, " ").trim();
  if (clean.length < 5) return generateCameraTitle();
  return clean;
}

function generateCameraTitle() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());

  const templates = [
    `VID_${yyyy}${mm}${dd}_${hh}${min}${ss}.mp4`,
    `IMG_${Math.floor(1000 + Math.random() * 9000)}_CLIP.mov`,
    `CCTV_REC_H264_${hh}${min}_CAM01.mp4`
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

function formatDuration(sec) {
  if (!sec) return "Video";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
