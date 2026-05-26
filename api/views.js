// Secure View Counter Proxy (api/views.js)
module.exports = async function handler(req, res) {
  const { id, action } = req.query;

  if (!id) {
    return res.status(400).json({ error: "Missing video ID." });
  }

  // Allow Vercel to allow CORS natively
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST");

  try {
    let url = `https://api.counterapi.dev/v1/viralhub_views/${id}`;
    
    // If we want to increment the count
    if (req.method === "POST" || action === "up") {
      url = `https://api.counterapi.dev/v1/viralhub_views/${id}/up`;
    }

    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return res.status(200).json({ views: data.value });
    }

    return res.status(200).json({ views: 0 });
  } catch (e) {
    return res.status(200).json({ views: 0 });
  }
};
