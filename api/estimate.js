const { computeEstimate } = require("../lib/pricing.js");
const DEFAULT_RATES = require("../lib/defaultRates");

let kv = null;
try {
  kv = require("@vercel/kv").kv;
} catch (e) {
  kv = null; // Vercel KV not installed/configured — fall back to defaults
}

async function getRates() {
  if (!kv) return DEFAULT_RATES;
  try {
    const stored = await kv.get("rpw_rates");
    return stored ? Object.assign({}, DEFAULT_RATES, stored) : DEFAULT_RATES;
  } catch (e) {
    console.error("Failed to read rates from KV, using defaults:", e);
    return DEFAULT_RATES;
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const rates = await getRates();
    const result = computeEstimate(req.body || {}, rates);
    res.status(200).json(result);
  } catch (err) {
    console.error("Estimate error:", err);
    res.status(500).json({ error: "Failed to calculate estimate" });
  }
};
