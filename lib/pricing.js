function n(v){
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function fmt(num){
  return Number(num || 0).toLocaleString('en-US');
}

function yn(v){
  return n(v) ? 'Yes' : 'No';
}

function storyMultiplier(stories, rates){
  if(n(stories) >= 3) return 1 + n(rates.r_story3Pct) / 100;
  return 1;
}

function storyLabel(stories){
  const s = n(stories) || 1;
  return `${s} ${s === 1 ? 'story' : 'stories'}`;
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

// Lookup tables: map the semantic key sent from the form to a price multiplier + a readable label.
const CONDITIONS = {
  light: {mult: 1, label: 'Light'},
  moderate: {mult: 1.2, label: 'Moderate'},
  heavy: {mult: 1.4, label: 'Heavy'}
};

const DECK_MATERIALS = {
  raw: {mult: 1.15, label: 'Raw wood'},
  stained: {mult: 1.20, label: 'Stained wood'},
  painted: {mult: 1, label: 'Painted wood'},
  trex: {mult: 1, label: 'Trex / composite'},
  other: {mult: 1, label: 'Other'}
};

const FENCE_MATERIALS = {
  vinyl: {mult: 0.70, label: 'Vinyl'},
  raw: {mult: 1.15, label: 'Raw wood'},
  stained: {mult: 1.20, label: 'Stained wood'},
  painted: {mult: 1, label: 'Painted wood'},
  other: {mult: 1, label: 'Other'}
};

const ROOF_PITCHES = {
  low: {mult: 1, label: 'Low pitch'},
  medium: {mult: 1.25, label: 'Medium pitch'},
  steep: {mult: 1.5, label: 'Steep pitch'}
};

const DEBRIS_LOADS = {
  light: {mult: 1, label: 'Light'},
  moderate: {mult: 1.25, label: 'Moderate'},
  heavy: {mult: 1.6, label: 'Heavy — full of buildup'}
};

function lookup(table, key, fallbackKey){
  return table[key] || table[fallbackKey] || {mult: 1, label: key || 'Unspecified'};
}

function computeSiding(f, rates){
  const sqft = n(f.sqft);
  if(sqft <= 0) return {total: 0, label: null, details: []};
  const stories = n(f.stories) || 1;
  const condition = lookup(CONDITIONS, f.condition, 'moderate');
  const softwash = n(f.softwash);
  let total = tieredSqftPrice(sqft, rates.r_sidingPerSqft, rates) * condition.mult * storyMultiplier(stories, rates);
  if(softwash) total += n(rates.r_softwashFlat);
  return {
    total,
    label: `House / siding wash — ${fmt(sqft)} sq ft`,
    details: [
      `${fmt(sqft)} sq ft`,
      storyLabel(stories),
      `Condition: ${condition.label}`,
      `Soft-wash chemical treatment: ${yn(softwash)}`
    ]
  };
}

function computeConcrete(f, rates){
  const sqft = n(f.sqft);
  if(sqft <= 0) return {total: 0, label: null, details: []};
  const condition = lookup(CONDITIONS, f.condition, 'moderate');
  const rust = n(f.rust);
  let total = tieredSqftPrice(sqft, rates.r_concretePerSqft, rates) * condition.mult;
  if(rust) total += n(rates.r_stainFlat);
  return {
    total,
    label: `Driveway / walkway / patio — ${fmt(sqft)} sq ft`,
    details: [
      `${fmt(sqft)} sq ft`,
      `Surface condition: ${condition.label}`,
      `Rust / oil stain treatment: ${yn(rust)}`
    ]
  };
}

function computeDeck(f, rates){
  const sqft = n(f.sqft);
  if(sqft <= 0) return {total: 0, label: null, details: []};
  const material = lookup(DECK_MATERIALS, f.material, 'painted');
  const brighten = n(f.brighten);
  let total = tieredSqftPrice(sqft, rates.r_deckPerSqft, rates) * material.mult;
  if(brighten) total += n(rates.r_brightenFlat);
  return {
    total,
    label: `Deck wash — ${fmt(sqft)} sq ft`,
    details: [
      `${fmt(sqft)} sq ft`,
      `Material: ${material.label}`,
      `Wood brightening / sealant prep: ${yn(brighten)}`
    ]
  };
}

function computeFence(f, rates){
  const linft = n(f.linft);
  if(linft <= 0) return {total: 0, label: null, details: []};
  const material = lookup(FENCE_MATERIALS, f.material, 'painted');
  const brighten = n(f.brighten);
  let total = linft * n(rates.r_fencePerLinft) * material.mult;
  if(brighten) total += n(rates.r_brightenFlat);
  return {
    total,
    label: `Fence wash — ${fmt(linft)} lin ft`,
    details: [
      `${fmt(linft)} linear ft`,
      `Material: ${material.label}`,
      `Wood brightening / sealant prep: ${yn(brighten)}`
    ]
  };
}

function computeRoof(f, rates){
  const sqft = n(f.sqft);
  if(sqft <= 0) return {total: 0, label: null, details: []};
  const pitch = lookup(ROOF_PITCHES, f.pitch, 'medium');
  const total = tieredSqftPrice(sqft, rates.r_roofPerSqft, rates) * pitch.mult;
  return {
    total,
    label: `Roof soft wash — ${fmt(sqft)} sq ft`,
    details: [
      `${fmt(sqft)} sq ft`,
      `Roof pitch: ${pitch.label}`
    ]
  };
}

function computeWindows(f, rates){
  const sqft = n(f.sqft);
  const screens = n(f.screens);
  if(sqft <= 0 && screens <= 0) return {total: 0, label: null, details: []};
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
  if(sqft > 0) parts.push(`${fmt(sqft)} sq ft glass`);
  parts.push(includesInterior ? 'interior + exterior' : 'exterior only');
  if(includesInterior && frenchPane) parts.push('french pane');
  if(includesInterior && stormWindows) parts.push('storm windows');
  if(screens > 0) parts.push(`${screens} screens`);

  return {
    total,
    label: `Window cleaning — ${parts.join(', ')}`,
    details: [
      `${fmt(sqft)} sq ft glass`,
      storyLabel(stories),
      `Cleaning scope: ${includesInterior ? 'Interior + exterior' : 'Exterior only'}`,
      `French pane glass: ${yn(frenchPane)}`,
      `Storm windows: ${yn(stormWindows)}`,
      `Screens cleaned: ${screens > 0 ? screens : 'None'}`
    ]
  };
}

function computeGutters(f, rates){
  const sqft = n(f.sqft);
  if(sqft <= 0) return {total: 0, label: null, details: []};
  const stories = n(f.stories) || 1;
  const debris = lookup(DEBRIS_LOADS, f.debris, 'moderate');
  const downspouts = n(f.downspouts);
  const guards = n(f.guards);
  const brighten = n(f.brighten);
  let total = tieredSqftPrice(sqft, rates.r_gutterPerSqft, rates) * debris.mult * storyMultiplier(stories, rates);
  if(downspouts) total += n(rates.r_downspoutFlat);
  if(guards) total += sqft * n(rates.r_guardPerSqft);
  if(brighten) total += sqft * n(rates.r_gutterBrightenPerSqft);
  return {
    total,
    label: `Gutter cleaning — ${fmt(sqft)} sq ft`,
    details: [
      `${fmt(sqft)} sq ft`,
      storyLabel(stories),
      `Debris load: ${debris.label}`,
      `Downspout flush: ${yn(downspouts)}`,
      `Gutter guard install: ${yn(guards)}`,
      `Gutter brightening (outside clean): ${yn(brighten)}`
    ]
  };
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
      lineItems.push({service: key, label: result.label, total, details: result.details || []});
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
