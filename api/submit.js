// Public Submission Router with Security Wrappers (api/submit.js)
const TELEGRAM_TOKEN = "8767174145:AAEvhVjTx0wKNxMs2J613oiOdp4XTVThJ0A";
const ADMIN_ID = 2031314339;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { title, thumbnailUrl, videoUrl } = req.body;

  // Wrapping metadata inside easily parseable markdown tags to bypass callback 64-byte limit!
  const text = `🚨 **NEW VIDEO APPROVAL REQUEST** 🚨\n` +
               `─────────────────────────\n` +
               `🎬 **Title:** ${title}\n` +
               `🖼️ **Thumbnail:** ${thumbnailUrl}\n` +
               `🔗 **Video Source:** [Click to Preview](${videoUrl})\n\n` +
               `--- RAW DATA FOR ENGINE ---\n` +
               `[TITLE]${title}[/TITLE]\n` +
               `[THUMB]${thumbnailUrl}[/THUMB]\n` +
               `[URL]${videoUrl}[/URL]`;

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
              { text: "✅ Approve", callback_data: "approve_user_sub" },
              { text: "❌ Reject", callback_data: "reject_user_sub" }
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
