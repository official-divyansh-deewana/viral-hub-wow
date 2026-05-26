const TELEGRAM_TOKEN = "8767174145:AAEvhVjTx0wKNxMs2J613oiOdp4XTVThJ0A";
const ADMIN_ID = 2031314339;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { name, phone, message } = req.body;

  const text = `✉️ **NEW CONTACT US SUBMISSION** ✉️\n` +
               `─────────────────────────\n` +
               `👤 **Name:** ${name}\n` +
               `📞 **Phone:** \`${phone}\`\n` +
               `💬 **Message:** ${message}`;

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ADMIN_ID, text, parse_mode: "Markdown" })
    });
    return res.status(200).send("OK");
  } catch (e) {
    return res.status(500).send(e.toString());
  }
};
