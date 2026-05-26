// Upgraded Serverless Bot Engine with Auto Title-Sanitization & Iframe support (api/bot.js)
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
    await sendTelegramMessage(chatId, `⚠️ **Access Denied!**\nYour ID: \`${userId}\` is not registered.`);
    return;
  }

  let text = message.text || "";

  // 1. /start Command
  if (text === "/start") {
    const welcomeMsg = `⚡️ **VIRAL HUB CONTROL PANEL v2.0** ⚡️\n` +
                       `─────────────────────────\n` +
                       `Welcome, Administrator! Access your tools below:\n\n` +
                       `📊 **/stats** — वेबसाइट का कुल स्टेटस देखें\n` +
                       `✅ **/done** — डेटाबेस सिंकिंग की पुष्टि करें\n` +
                       `❔ **/help** — नो-लिमिट लिंक अपलोड गाइड\n\n` +
                       `📤 **वीडियो अपलोड करने के दो तरीके:**\n` +
                       `🔹 **तरीका 1:** वीडियो फ़ाइल को सीधे यहाँ फॉरवर्ड करें.\n` +
                       `🔹 **तरीका 2:** किसी भी साइट (जैसे Doodstream) का प्लेयर लिंक ऐसे भेजें:\n` +
                       `\`https://link.com/embed-code | वीडियो टाइटल\``;
    await sendTelegramMessage(chatId, welcomeMsg);
    return;
  }

  // 2. /stats Command
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

  // 3. /done Command
  if (text === "/done") {
    await sendTelegramMessage(chatId, "🎉 **वेबसाइट सिंक हो चुकी है!**");
    return;
  }

  // 4. /help Command
  if (text === "/help") {
    const helpMsg = `ℹ️ **नो-लिमिट लिंक गाइड** ℹ️\n` +
                    `─────────────────────────\n` +
                    `बड़ी फ़ाइलों को चलाने के लिए आप Doodstream या Streamwish जैसी वीडियो स्ट्रीमिंग साइटों का Embed (प्लेयर) लिंक कॉपी करें.\n\n` +
                    `फिर उसे इस प्रकार भेजें:\n` +
                    `\`https://dood.to/e/example | वीडियो का नाम\``;
    await sendTelegramMessage(chatId, helpMsg);
    return;
  }

  // टेलीग्राम शेयरिंग लिंक को असली लिंक में बदलने की सुविधा
  if (text.startsWith("https://t.me/share/url?url=")) {
    try {
      const decodedUrl = decodeURIComponent(text.split("url=")[1].split("&")[0]);
      text = `${decodedUrl} | ${generateCameraTitle()}`;
    } catch(e) {
      // Ignore if decoding fails
    }
  }

  // 5. Method 2 Handler (URL | Title Format with Auto Title Sanitizer)
  if (text.includes("|") && (text.startsWith("http://") || text.startsWith("https://"))) {
    await sendTelegramMessage(chatId, "⏳ **Processing**: प्लेयर लिंक को डेटाबेस में जोड़ा जा रहा है...");
    try {
      const parts = text.split("|");
      const videoUrl = parts[0].trim();
      const rawTitle = parts[1].trim();
      const title = sanitizeTitle(rawTitle); // टाइटल साफ़ करने का फंक्शन

      const placeholderThumb = "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=1200&auto=format&fit=crop";

      const newEntry = {
        id: `vid-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        title: title,
        videoUrl: videoUrl,
        thumbnailUrl: placeholderThumb,
        timestamp: Date.now(),
        duration: "Web Stream"
      };

      await commitToGitHub(newEntry);
      await sendTelegramMessage(chatId, `✅ **Success**: *${title}* वेबसाइट पर लाइव हो गया है!`);
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ **Error**: ${err.message}`);
    }
    return;
  }

  // 6. Method 1 Handler (Direct Video < 20MB with Auto Title Sanitizer)
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
      const placeholderThumb = "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=1200&auto=format&fit=crop";

      const title = sanitizeTitle(rawCaption); // टाइटल साफ़ करने का फंक्शन

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
      await sendTelegramMessage(chatId, `❌ **Error**: ${err.message}\n\n💡 _टिप: यदि वीडियो 20MB से बड़ा है, तो /help कमांड का उपयोग करें._`);
    }
  }
}

// 🧽 Title Cleaner & Random Camera Titled Generator
function sanitizeTitle(rawTitle) {
  if (!rawTitle) return generateCameraTitle();

  // 1. सभी URLs (http, https, t.me, ww1.) को हटाएं
  let clean = rawTitle.replace(/https?:\/\/[^\s]+/gi, "");
  clean = clean.replace(/t\.me\/[^\s]+/gi, "");
  clean = clean.replace(/www\.[^\s]+/gi, "");

  // 2. टेलीग्राम यूजरनेम (@username) और हैशटैग्स हटाएं
  clean = clean.replace(/@\w+/g, "");
  clean = clean.replace(/#\w+/g, "");

  // 3. अनचाहे सिंबल और मार्कडाउन हटाएं
  clean = clean.replace(/[*_`\[\]()\-]/g, "");

  // 4. प्रमोशनल और विज्ञापन वाले सामान्य शब्दों को साफ करें
  const promoKeywords = [
    /join/gi, /subscribe/gi, /channel/gi, /telegram/gi, /bot/gi, 
    /link/gi, /click/gi, /unqid/gi, /free/gi, /unzip/gi, /watch/gi
  ];
  promoKeywords.forEach(word => {
    clean = clean.replace(word, "");
  });

  // 5. एक्स्ट्रा स्पेसेस हटाएं
  clean = clean.replace(/\s+/g, " ").trim();

  // यदि टाइटल खाली हो गया या 5 अक्षरों से छोटा है, तो रैंडम कैमरा नाम दें
  if (clean.length < 5) {
    return generateCameraTitle();
  }
  return clean;
}

// 📷 रैंडम कैमरा फ़ाइल नाम जेनरेटर (बिल्कुल असली वीडियो रिकॉर्डिंग जैसा लुक)
function generateCameraTitle() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());

  const randomNumber = Math.floor(1000 + Math.random() * 9000);
  const randomSuffix = Math.floor(10 + Math.random() * 90);

  const templates = [
    `VID_${yyyy}${mm}${dd}_${hh}${min}${ss}.mp4`,
    `IMG_${randomNumber}_CLIP.mov`,
    `CCTV_REC_H264_${hh}${min}_CAM0${Math.floor(1 + Math.random() * 4)}.mp4`,
    `DCIM_CAMERA_${yyyy}_SH_${randomSuffix}.mov`
  ];

  return templates[Math.floor(Math.random() * templates.length)];
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
    throw new Error("Failed to write to GitHub.");
  }
}

function formatDuration(sec) {
  if (!sec) return "Video";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
