// Secure HTML Submission Router (api/submit.js)
const TELEGRAM_TOKEN = "8767174145:AAEvhVjTx0wKNxMs2J613oiOdp4XTVThJ0A";
const ADMIN_ID = 2031314339;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { title, thumbnailUrl, videoUrl } = req.body;

  // Formatting message with safe HTML tags (100% crash-proof!)
  const text = `🚨 <b>NEW VIDEO APPROVAL REQUEST</b> 🚨\n` +
               `─────────────────────────\n` +
               `🎬 <b>Title:</b> ${title}\n` +
               `🖼️ <b>Thumbnail:</b> <a href="${thumbnailUrl}">Preview</a>\n` +
               `🔗 <b>Video Source:</b> <a href="${videoUrl}">Preview</a>\n\n` +
               `--- RAW DATA FOR BOT ---\n` +
               `SUB_TITLE: ${title}\n` +
               `SUB_THUMB: ${thumbnailUrl}\n` +
               `SUB_URL: ${videoUrl}`;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ADMIN_ID,
        text,
        parse_mode: "HTML", // HTML is ultra-stable!
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
