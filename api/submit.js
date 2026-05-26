// Public Submission Approval Request Router (api/submit.js)
const TELEGRAM_TOKEN = "8767174145:AAEvhVjTx0wKNxMs2J613oiOdp4XTVThJ0A";
const ADMIN_ID = 2031314339;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { title, thumbnailUrl, videoUrl } = req.body;

  const videoObj = {
    id: `vid-${Date.now()}`,
    title: title,
    videoUrl: videoUrl,
    thumbnailUrl: thumbnailUrl,
    timestamp: Date.now(),
    duration: "User Upload"
  };

  // डेटा को बटन डेटा लिमिट के अंदर रखने के लिए एन्कोड करें
  const base64Data = Buffer.from(JSON.stringify(videoObj)).toString("base64");

  const text = `🚨 **NEW VIDEO APPROVAL REQUEST** 🚨\n` +
               `─────────────────────────\n` +
               `🎬 **Title:** ${title}\n` +
               `🖼️ **Thumbnail:** ${thumbnailUrl}\n` +
               `🔗 **Video Source:** [Click to Preview](${videoUrl})`;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_ID,
        text,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve & Go Live", callback_data: `approve_${base64Data}` },
              { text: "❌ Reject", callback_data: `reject_${base64Data}` }
            ]
          ]
        }
      })
    });
    return res.status(200).send("OK");
  } catch (e) {
    return res.status(500).send(e.toString());
  }
};
