const { Resend } = require("resend");
const {
  buildTextEmail,
  buildHtmlEmail,
  currency,
} = require("../lib/emailFormat.js.bak");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { contact, estimate } = req.body || {};

    if (!contact || !contact.firstName || !contact.lastName || !contact.email) {
      res.status(400).json({ error: "Missing required contact fields" });
      return;
    }
    if (!estimate || typeof estimate.grand !== "number") {
      res.status(400).json({ error: "Missing estimate data" });
      return;
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not set");
      res.status(500).json({ error: "Email service is not configured" });
      return;
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const subject = `New estimate request — ${contact.firstName} ${contact.lastName} — ${currency(estimate.grand)}`;

    const { data, error } = await resend.emails.send({
      // Must be an address on a domain you've verified in Resend.
      from:
        process.env.FROM_EMAIL ||
        "Raleigh Power Wash Estimates <estimates@raleighpowerwash.com>",
      to: process.env.TO_EMAIL || "info@raleighpowerwash.com",
      reply_to: contact.email,
      subject,
      text: buildTextEmail(contact, estimate),
      html: buildHtmlEmail(contact, estimate),
    });

    if (error) {
      console.error("Resend error:", error);
      res.status(502).json({ error: "Failed to send email" });
      return;
    }

    res.status(200).json({ success: true, id: data ? data.id : null });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
