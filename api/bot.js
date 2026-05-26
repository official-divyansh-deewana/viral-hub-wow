const TELEGRAM_TOKEN = "8767174145:AAEvhVjTx0wKNxMs2J613oiOdp4XTVThJ0A";
const ADMIN_ID = 2031314339;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot is active.");
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
}

async function handleMessage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;

  if (userId !== ADMIN_ID) return;

  const text = message.text || "";

  if (text === "/start") {
    await sendTelegramMessage(chatId, "👋 **Viral Hub Webhook Engine Online!**\n\nभेजे गए वीडियो अब बिना किसी सर्वर के सीधा वेबसाइट पर अपलोड होंगे।");
    return;
  }

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
    await sendTelegramMessage(chatId, "⏳ **Processing**: वीडियो का सोर्स लिंक जनरेट हो रहा है...");

    try {
      const fileResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${videoFile.file_id}`);
      const fileData = await fileResponse.json();

      if (!fileData.ok) throw new Error("Telegram API Error");

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
      await sendTelegramMessage(chatId, `✅ **Success**: *${title}* सीधा वेबसाइट पर अपडेट हो चुका है!`);

    } catch (err) {
      await sendTelegramMessage(chatId, `❌ **Error**: ${err.message}`);
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
