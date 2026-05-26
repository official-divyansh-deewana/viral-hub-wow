// Upgraded Diagnostic Serverless Bot Engine (api/bot.js)
const TELEGRAM_TOKEN = "8767174145:AAEvhVjTx0wKNxMs2J613oiOdp4XTVThJ0A";
const ADMIN_ID = 2031314339;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot is online.");
  }

  try {
    const payload = req.body;
    if (payload && payload.message) {
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

  // एडमिन वेरिफिकेशन
  if (userId !== ADMIN_ID) {
    await sendTelegramMessage(chatId, `⚠️ **Access Denied!**\nYour ID: \`${userId}\` is not registered as Admin.`);
    return;
  }

  const text = message.text || "";

  // 1. /start Command
  if (text === "/start") {
    const welcomeMsg = `⚡️ **VIRAL HUB CONTROL PANEL** ⚡️\n` +
                       `─────────────────────────\n` +
                       `Welcome back, Administrator!\n\n` +
                       `📊 **/stats** — वेबसाइट के कुल वीडियो देखें\n` +
                       `✅ **/done** — डेटाबेस सिंक होने की पुष्टि करें\n` +
                       `❔ **/help** — नो-लिमिट अपलोड करने का गाइड\n\n` +
                       `📤 **वीडियो अपलोड करने के तरीके:**\n` +
                       `🔹 **तरीका 1 (< 20MB):** सीधा कोई भी वीडियो यहाँ फॉरवर्ड करें.\n` +
                       `🔹 **तरीका 2 (नो-लिमिट):** लिंक को इस फॉर्मेट में भेजें:\n` +
                       `\`https://link.com/video.mp4 | वीडियो का नाम\``;
    await sendTelegramMessage(chatId, welcomeMsg);
    return;
  }

  // 2. /stats Command
  if (text === "/stats") {
    await sendTelegramMessage(chatId, "📊 *डेटाबेस से संपर्क किया जा रहा है...*");
    try {
      const db = await fetchCurrentDatabase();
      const statsMsg = `📈 **VIRAL HUB STATS** 📈\n` +
                       `─────────────────────────\n` +
                       `🔹 **कुल वीडियो लाइव:** \`${db.length}\` वीडियो\n` +
                       `🔹 **डेटाबेस स्थिति:** ऑनलाइन और सक्रिय\n` +
                       `🔹 **नवीनतम वीडियो:** ${db[0] ? `*${db[0].title}*` : "कोई नहीं"}`;
      await sendTelegramMessage(chatId, statsMsg);
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ **Error**: सांख्यिकी लोड करने में विफल: ${err.message}`);
    }
    return;
  }

  // 3. /done Command
  if (text === "/done") {
    await sendTelegramMessage(chatId, "🎉 **वेबसाइट सिंक हो चुकी है!**");
    return;
  }

  // 4. /help Command
  if (text === "/help") {
    const helpMsg = `ℹ️ **नो-लिमिट वीडियो अपलोड गाइड** ℹ️\n` +
                    `─────────────────────────\n` +
                    `1️⃣ किसी भी Direct Link Generator Bot का उपयोग करके वीडियो का \`.mp4\` लिंक निकालें.\n` +
                    `2️⃣ उस लिंक को कॉपी करके हमारे बॉट को इस प्रकार भेजें:\n` +
                    `\`https://yourdomain.com/movie.mp4 | My Beautiful Video\``;
    await sendTelegramMessage(chatId, helpMsg);
    return;
  }

  // 5. Method 2 Handler (URL | Title format)
  if (text.includes("|") && (text.startsWith("http://") || text.startsWith("https://"))) {
    await sendTelegramMessage(chatId, "⏳ **Processing**: डायरेक्ट लिंक को डेटाबेस में जोड़ा जा रहा है...");
    try {
      const parts = text.split("|");
      const videoUrl = parts[0].trim();
      const title = parts[1].trim();
      const placeholderThumb = "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=1200&auto=format&fit=crop";

      const newEntry = {
        id: `vid-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: title,
        videoUrl: videoUrl,
        thumbnailUrl: placeholderThumb,
        timestamp: Date.now(),
        duration: "Direct Stream"
      };

      await commitToGitHub(newEntry);
      await sendTelegramMessage(chatId, `✅ **Success**: *${title}* बिना किसी साइज लिमिट के वेबसाइट पर लाइव हो गया है!`);
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ **Error**: ${err.message}`);
    }
    return;
  }

  // 6. Method 1 Handler (Direct Video < 20MB)
  let videoFile = null;
  let title = "Untitled Highlight";

  if (message.video) {
    videoFile = message.video;
    title = message.caption || "Untitled Highlight";
  } else if (message.document && message.document.mime_type.startsWith("video/")) {
    videoFile = message.document;
    title = message.caption || message.document.file_name || "Untitled File Highlight";
  }

  if (videoFile) {
    await sendTelegramMessage(chatId, "⏳ **Processing**: वीडियो का डायरेक्ट लिंक निकाला जा रहा है...");

    try {
      const fileResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${videoFile.file_id}`);
      const fileData = await fileResponse.json();

      if (!fileData.ok) {
        throw new Error(fileData.description || "Telegram API Error");
      }

      const directVideoUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileData.result.file_path}`;
      const placeholderThumb = "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=1200&auto=format&fit=crop";

      const newEntry = {
        id: `vid-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: title,
        videoUrl: directVideoUrl,
        thumbnailUrl: placeholderThumb,
        timestamp: Date.now(),
        duration: formatDuration(videoFile.duration)
      };

      await sendTelegramMessage(chatId, "💾 **Saving**: डेटाबेस अपडेट किया जा रहा है...");
      await commitToGitHub(newEntry);
      await sendTelegramMessage(chatId, `✅ **Success**: *${title}* सीधा वेबसाइट पर लाइव हो चुका है!`);

    } catch (err) {
      await sendTelegramMessage(chatId, `❌ **Error**: ${err.message}\n\n💡 _टिप: यदि वीडियो 20MB से बड़ा है, तो /help का उपयोग करें._`);
    }
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
  const path = "videos.json";

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    "Authorization": `token ${token}`,
    "User-Agent": "Vercel-Bot",
    "Accept": "application/vnd.github.v3+json"
  };

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
  const path = "videos.json";

  if (!owner || !repo || !token) {
    throw new Error("Missing GITHUB Environment Variables in Vercel.");
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers = {
    "Authorization": `token ${token}`,
    "User-Agent": "Vercel-Bot",
    "Accept": "application/vnd.github.v3+json"
  };

  const getResponse = await fetch(url, { headers });
  let sha = null;
  let currentDatabase = [];

  if (getResponse.status === 200) {
    const data = await getResponse.json();
    sha = data.sha;
    const decoded = Buffer.from(data.content, "base64").toString("utf-8");
    currentDatabase = JSON.parse(decoded);
  } else if (getResponse.status !== 404) {
    const errBody = await getResponse.json().catch(() => ({}));
    throw new Error(`GitHub Database Read Failed: ${getResponse.status} - ${errBody.message || "Unknown error"}`);
  }

  currentDatabase.unshift(newVideo);
  const updatedContentBase64 = Buffer.from(JSON.stringify(currentDatabase, null, 2)).toString("base64");

  const putResponse = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `🤖 Vercel Auto-Sync: ${newVideo.title}`,
      content: updatedContentBase64,
      sha
    })
  });

  if (!putResponse.ok) {
    const errBody = await putResponse.json().catch(() => ({}));
    throw new Error(`GitHub Write Blocked: ${putResponse.status} - ${errBody.message || "Unknown write error"}`);
  }
}

function formatDuration(sec) {
  if (!sec) return "Video";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
