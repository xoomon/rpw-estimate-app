function n(v){
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function storyMultiplier(stories, rates){
  if(n(stories) >= 3) return 1 + n(rates.r_story3Pct) / 100;
  return 1;
}

// Volume discount: every additional 1,000 sq ft prices at a lower rate.
// First 1,000 sq ft at full rate, next 1,000 at rate*(1-d), next at rate*(1-d)^2, etc.
function tieredSqftPrice(sqft, baseRate, rates){
  sqft = n(sqft);
  baseRate = n(baseRate);
  if(sqft <= 0 || baseRate <= 0) return 0;
  const tierSize = 1000;
  const discount = Math.min(0.9, Math.max(0, n(rates.r_tierDiscountPct) / 100));
  let remaining = sqft;
  let tier = 0;
  let total = 0;
  while(remaining > 0){
    const amountInTier = Math.min(tierSize, remaining);
    const tierRate = baseRate * Math.pow(1 - discount, tier);
    total += amountInTier * tierRate;
    remaining -= amountInTier;
    tier++;
  }
  return total;
}

function computeSiding(f, rates){
  const sqft = n(f.sqft);
  if(sqft <= 0) return {total:0, label:null};
  const stories = n(f.stories) || 1;
  const condition = n(f.condition) || 1;
  const softwash = n(f.softwash);
  let total = tieredSqftPrice(sqft, rates.r_sidingPerSqft, rates) * condition * storyMultiplier(stories, rates);
  if(softwash) total += n(rates.r_softwashFlat);
  return {total, label:`House / siding wash — ${sqft} sq ft`};
}

function computeConcrete(f, rates){
  const sqft = n(f.sqft);
  if(sqft <= 0) return {total:0, label:null};
  const condition = n(f.condition) || 1;
  const rust = n(f.rust);
  let total = tieredSqftPrice(sqft, rates.r_concretePerSqft, rates) * condition;
  if(rust) total += n(rates.r_stainFlat);
  return {total, label:`Driveway / walkway / patio — ${sqft} sq ft`};
}

function computeDeck(f, rates){
  const sqft = n(f.sqft);
  if(sqft <= 0) return {total:0, label:null};
  const material = n(f.material) || 1;
  const brighten = n(f.brighten);
  let total = tieredSqftPrice(sqft, rates.r_deckPerSqft, rates) * material;
  if(brighten) total += n(rates.r_brightenFlat);
  return {total, label:`Deck wash — ${sqft} sq ft`};
}

function computeFence(f, rates){
  const linft = n(f.linft);
  if(linft <= 0) return {total:0, label:null};
  const material = n(f.material) || 1;
  const brighten = n(f.brighten);
  let total = linft * n(rates.r_fencePerLinft) * material;
  if(brighten) total += n(rates.r_brightenFlat);
  return {total, label:`Fence wash — ${linft} lin ft`};
}

function computeRoof(f, rates){
  const sqft = n(f.sqft);
  if(sqft <= 0) return {total:0, label:null};
  const pitch = n(f.pitch) || 1;
  const total = tieredSqftPrice(sqft, rates.r_roofPerSqft, rates) * pitch;
  return {total, label:`Roof soft wash — ${sqft} sq ft`};
}

function computeWindows(f, rates){
  const sqft = n(f.sqft);
  const screens = n(f.screens);
  if(sqft <= 0 && screens <= 0) return {total:0, label:null};
  const stories = n(f.stories) || 1;
  const includesInterior = f.scope === 'both';
  const frenchPane = n(f.frenchPane);
  const stormWindows = n(f.stormWindows);

  const baseSqftPrice = tieredSqftPrice(sqft, rates.r_windowPerSqft, rates);
  const exteriorCost = baseSqftPrice * storyMultiplier(stories, rates);

  let interiorCost = 0;
  if(includesInterior){
    interiorCost = baseSqftPrice * (n(rates.r_windowInteriorPct) / 100);
    let interiorSurchargePct = 0;
    if(frenchPane) interiorSurchargePct += n(rates.r_frenchPanePct);
    if(stormWindows) interiorSurchargePct += n(rates.r_stormWindowPct);
    interiorCost *= (1 + interiorSurchargePct / 100);
  }

  let total = exteriorCost + interiorCost;
  if(screens > 0) total += screens * n(rates.r_screenPerScreen);

  const parts = [];
  if(sqft > 0) parts.push(`${sqft} sq ft glass`);
  parts.push(includesInterior ? 'interior + exterior' : 'exterior only');
  if(includesInterior && frenchPane) parts.push('french pane');
  if(includesInterior && stormWindows) parts.push('storm windows');
  if(screens > 0) parts.push(`${screens} screens`);
  return {total, label:`Window cleaning — ${parts.join(', ')}`};
}

function computeGutters(f, rates){
  const sqft = n(f.sqft);
  if(sqft <= 0) return {total:0, label:null};
  const stories = n(f.stories) || 1;
  const debris = n(f.debris) || 1;
  const downspouts = n(f.downspouts);
  const guards = n(f.guards);
  const brighten = n(f.brighten);
  let total = tieredSqftPrice(sqft, rates.r_gutterPerSqft, rates) * debris * storyMultiplier(stories, rates);
  if(downspouts) total += n(rates.r_downspoutFlat);
  if(guards) total += sqft * n(rates.r_guardPerSqft);
  if(brighten) total += sqft * n(rates.r_gutterBrightenPerSqft);
  return {total, label:`Gutter cleaning — ${sqft} sq ft`};
}

const COMPUTERS = {
  siding: computeSiding,
  concrete: computeConcrete,
  deck: computeDeck,
  fence: computeFence,
  roof: computeRoof,
  windows: computeWindows,
  gutters: computeGutters
};

function computeEstimate(payload, rates){
  const services = (payload && payload.services) || {};
  const serviceTotals = {};
  const lineItems = [];
  let subtotal = 0;
  let activeCount = 0;

  for(const key of Object.keys(COMPUTERS)){
    const f = services[key];
    if(!f || !f.active){
      serviceTotals[key] = 0;
      continue;
    }
    const result = COMPUTERS[key](f, rates);
    const total = result.total || 0;
    serviceTotals[key] = total;
    if(total > 0){
      activeCount++;
      subtotal += total;
      lineItems.push({service:key, label:result.label, total});
    }
  }

  let discountPct = 0;
  if(activeCount >= 3) discountPct = n(rates.r_bundle3Pct);
  else if(activeCount === 2) discountPct = n(rates.r_bundle2Pct);
  const discountAmt = subtotal * (discountPct / 100);

  const tripOn = !!(payload && payload.global && payload.global.tripfee);
  const tripAmt = tripOn ? n(rates.r_tripFlat) : 0;

  const rushOn = !!(payload && payload.global && payload.global.rush);
  const rushAmt = rushOn ? (subtotal - discountAmt) * (n(rates.r_rushPct) / 100) : 0;

  let grand = subtotal - discountAmt + tripAmt + rushAmt;
  const minJob = n(rates.r_minJob);
  let minApplied = false;
  if(activeCount > 0 && grand < minJob){
    grand = minJob;
    minApplied = true;
  }

  return {serviceTotals, lineItems, subtotal, discountPct, discountAmt, tripAmt, rushAmt, grand, minApplied, minJob, activeCount};
}

module.exports = {computeEstimate};
