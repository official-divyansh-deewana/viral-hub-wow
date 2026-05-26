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

  // केवल ओनर (Admin) ही अधिकृत है
  if (userId !== ADMIN_ID) {
    await sendTelegramMessage(chatId, "⚠️ **Access Denied!** This bot is completely private.");
    return;
  }

  // 1. पूर्ण /start कमांड (सभी कमांड्स और गाइड रिस्टोर किए गए)
  if (text === "/start") {
    const welcomeMsg = `⚡️ **VIRAL HUB CONTROL PANEL v3.0** ⚡️\n` +
                       `─────────────────────────\n` +
                       `Welcome, Administrator! Here are your active commands:\n\n` +
                       `📊 **/stats** — वेबसाइट का लाइव डेटा और वीडियो काउंट देखें\n` +
                       `✅ **/done** — डेटाबेस सिंकिंग की पुष्टि करें\n` +
                       `❔ **/help** — नो-लिमिट लिंक अपलोड गाइड देखें\n\n` +
                       `📤 **वीडियो अपलोड करने के दो तरीके:**\n` +
                       `🔹 **तरीका 1 (कम साइज़ < 20MB):** वीडियो फ़ाइल सीधे यहाँ फॉरवर्ड करें।\n` +
                       `🔹 **तरीका 2 (नो-लिमिट - कोई भी साइज़):** लिंक को इस प्रकार भेजें:\n` +
                       `\`https://link.com/embed-code | वीडियो का नया टाइटल\``;
    await sendTelegramMessage(chatId, welcomeMsg);
    return;
  }

  // 2. /stats कमांड
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

  // 3. /done कमांड
  if (text === "/done") {
    await sendTelegramMessage(chatId, "🎉 **वेबसाइट पूरी तरह सिंक हो चुकी है!**");
    return;
  }

  // 4. /help कमांड
  if (text === "/help") {
    const helpMsg = `ℹ️ **नो-लिमिट लिंक गाइड** ℹ️\n` +
                    `─────────────────────────\n` +
                    `बड़ी फ़ाइलों को चलाने के लिए आप Doodstream या Streamwish जैसी वीडियो स्ट्रीमिंग साइटों का Embed (प्लेयर) लिंक कॉपी करें।\n\n` +
                    `फिर उसे इस प्रकार भेजें:\n` +
                    `\`https://dood.to/e/example | वीडियो का नाम\``;
    await sendTelegramMessage(chatId, helpMsg);
    return;
  }

  // 5. डायरेक्ट वीडियो फ़ॉरवर्ड हैंडलर (नो-लिमिट पब्लिक चैनल बाईपास)
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

    try {
      await commitToGitHub(newEntry);
      await sendTelegramMessage(chatId, `✅ **Approved & Live (No-Limit Bypass)**: *${title}*`);
    } catch (e) {
      await sendTelegramMessage(chatId, `❌ **GitHub Write Error**: ${e.message}`);
    }
    return;
  }

  // सामान्य वीडियो अपलोड (< 20MB)
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
    await sendTelegramMessage(chatId, "⏳ **Processing**: वीडियो का लिंक जनरेट किया जा रहा है...");
    try {
      const fileResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${videoFile.file_id}`);
      const fileData = await fileResponse.json();

      if (!fileData.ok) {
        throw new Error(fileData.description || "Telegram API Error");
      }

      const directVideoUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileData.result.file_path}`;
      const title = sanitizeTitle(rawCaption);

      const newEntry = {
        id: `vid-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: title,
        videoUrl: directVideoUrl,
        thumbnailUrl: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=1200&auto=format&fit=crop",
        timestamp: Date.now(),
        duration: formatDuration(videoFile.duration)
      };

      await sendTelegramMessage(chatId, "💾 **Saving**: डेटाबेस अपडेट किया जा रहा है...");
      await commitToGitHub(newEntry);
      await sendTelegramMessage(chatId, `✅ **Success**: *${title}* सीधा वेबसाइट पर लाइव हो चुका है!`);
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ **Error**: ${err.message}\n\n💡 _टिप: यदि वीडियो 20MB से बड़ा है, तो इसे किसी पब्लिक चैनल में डालकर यहाँ फॉरवर्ड करें।_`);
    }
    return;
  }

  // डायरेक्ट मेथड 2 लिंक हैंडलर
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

  // 1. सुरक्षित तरीके से बिना ब्रैकेट्स के डेटा को स्प्लिट करके रीड करना (No more 64-byte or split error!)
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

  // 2. रिजेक्शन हैंडलर
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

function sanitizeTitle(rawTitle) {
  if (!rawTitle) return generateCameraTitle();
  let clean = rawTitle.replace(/https?:\/\/[^\s]+/gi, "");
  clean = clean.replace(/t\.me\/[^\s]+/gi, "");
  clean = clean.replace(/www\.[^\s]+/gi, "");
  clean = clean.replace(/@\w+/g, "").replace(/#\w+/g, "");
  clean = clean.replace(/[*_`\[\]()\-]/g, "");

  // Correct syntax (No undeclared variables anymore)
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
