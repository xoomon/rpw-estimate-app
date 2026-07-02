const DEFAULT_RATES = require('../lib/defaultRates');

let kv = null;
try {
  kv = require('@vercel/kv').kv;
} catch (e) {
  kv = null;
}

function isAuthorized(req){
  const passcode = req.headers['x-admin-passcode'];
  return Boolean(passcode) && Boolean(process.env.ADMIN_PASSCODE) && passcode === process.env.ADMIN_PASSCODE;
}

module.exports = async (req, res) => {
  if(!isAuthorized(req)){
    res.status(401).json({error: 'Unauthorized'});
    return;
  }

  if(req.method === 'GET'){
    if(!kv){
      res.status(200).json(DEFAULT_RATES);
      return;
    }
    try{
      const stored = await kv.get('rpw_rates');
      res.status(200).json(stored ? Object.assign({}, DEFAULT_RATES, stored) : DEFAULT_RATES);
    } catch(err){
      console.error('Failed to read rates:', err);
      res.status(200).json(DEFAULT_RATES);
    }
    return;
  }

  if(req.method === 'POST'){
    if(!kv){
      res.status(500).json({error: 'Rate storage is not configured yet — set up Vercel KV first (see README).'});
      return;
    }
    const body = req.body || {};
    const cleaned = {};
    for(const [key, value] of Object.entries(body)){
      const num = Number(value);
      if(!Number.isFinite(num)){
        res.status(400).json({error: `Invalid value for ${key}`});
        return;
      }
      cleaned[key] = num;
    }
    try{
      await kv.set('rpw_rates', cleaned);
      res.status(200).json({success: true});
    } catch(err){
      console.error('Failed to save rates:', err);
      res.status(500).json({error: 'Failed to save rates'});
    }
    return;
  }

  res.status(405).json({error: 'Method not allowed'});
};
