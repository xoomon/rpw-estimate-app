function currency(n){
  n = Number(n) || 0;
  return '$' + n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function escapeHtml(str){
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const DISCLAIMER = 'This is only an estimate. Raleigh Power Wash will follow up to confirm a final, accurate quote before any work is scheduled.';

function buildTextEmail(contact, estimate){
  const out = [];
  out.push('RALEIGH POWER WASH — ESTIMATE REQUEST');
  out.push('Raleigh / Cary, NC');
  out.push('');
  out.push('CUSTOMER');
  out.push(`${contact.firstName || ''} ${contact.lastName || ''}`.trim());
  if(contact.address) out.push(contact.address);
  const cityLine = [contact.city, [contact.state, contact.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  if(cityLine) out.push(cityLine);
  if(contact.phone) out.push('Phone: ' + contact.phone);
  if(contact.email) out.push('Email: ' + contact.email);
  if(contact.source){
    let sourceLine = 'How they heard about us: ' + contact.source;
    if(contact.source === 'Referral' && contact.referralName){
      sourceLine += ' (' + contact.referralName + ')';
    }
    out.push(sourceLine);
  }
  out.push('');

  const lineItems = (estimate && estimate.lineItems) || [];
  out.push('SELECTED SERVICES');
  if(lineItems.length){
    lineItems.forEach(item => out.push(`• ${item.label}: ${currency(item.total)}`));
  } else {
    out.push('(none selected)');
  }
  out.push('');

  out.push('PRICING');
  out.push('Subtotal: ' + currency(estimate.subtotal));
  if(estimate.discountAmt > 0) out.push(`Bundle discount (${estimate.discountPct}%): –${currency(estimate.discountAmt)}`);
  if(estimate.tripAmt > 0) out.push('Trip fee: ' + currency(estimate.tripAmt));
  if(estimate.rushAmt > 0) out.push('Rush / weekend: ' + currency(estimate.rushAmt));
  if(estimate.minApplied) out.push(`(Minimum job charge of ${currency(estimate.minJob)} applied)`);
  out.push('ESTIMATE TOTAL: ' + currency(estimate.grand));
  out.push('');
  out.push(DISCLAIMER);

  return out.join('\n');
}

function buildHtmlEmail(contact, estimate){
  const lineItems = (estimate && estimate.lineItems) || [];
  const name = `${escapeHtml(contact.firstName)} ${escapeHtml(contact.lastName)}`.trim();
  const cityLine = [contact.city, [contact.state, contact.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  const rowsHtml = lineItems.length
    ? lineItems.map(item => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #E4E8EA;color:#182430;font-size:14px;">${escapeHtml(item.label)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #E4E8EA;color:#182430;font-size:14px;text-align:right;font-family:'Courier New',monospace;white-space:nowrap;">${currency(item.total)}</td>
        </tr>`).join('')
    : `<tr><td colspan="2" style="padding:8px 0;color:#54626E;font-size:14px;">No services selected</td></tr>`;

  const summaryRows = [];
  summaryRows.push(['Subtotal', currency(estimate.subtotal), false]);
  if(estimate.discountAmt > 0) summaryRows.push([`Bundle discount (${estimate.discountPct}%)`, '–' + currency(estimate.discountAmt), false]);
  if(estimate.tripAmt > 0) summaryRows.push(['Trip fee', currency(estimate.tripAmt), false]);
  if(estimate.rushAmt > 0) summaryRows.push(['Rush / weekend', currency(estimate.rushAmt), false]);
  const summaryRowsHtml = summaryRows.map(([label, value]) => `
    <tr>
      <td style="padding:3px 0;color:#54626E;font-size:13.5px;">${escapeHtml(label)}</td>
      <td style="padding:3px 0;color:#54626E;font-size:13.5px;text-align:right;font-family:'Courier New',monospace;">${value}</td>
    </tr>`).join('');

  const minNote = estimate.minApplied
    ? `<p style="margin:6px 0 0;font-size:12px;color:#8A97A1;">Minimum job charge of ${currency(estimate.minJob)} applied.</p>`
    : '';

  return `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#182430;">
  <div style="background:#12283F;padding:20px 24px;border-radius:10px 10px 0 0;">
    <p style="margin:0;color:#8FAAB8;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">Raleigh Power Wash</p>
    <h1 style="margin:4px 0 0;color:#ffffff;font-size:22px;">New Estimate Request</h1>
  </div>

  <div style="border:1px solid #E4E8EA;border-top:none;padding:24px;border-radius:0 0 10px 10px;">
    <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#54626E;margin:0 0 10px;">Customer</h2>
    <p style="margin:0 0 2px;font-size:15px;font-weight:bold;">${name}</p>
    ${contact.address ? `<p style="margin:0 0 2px;font-size:14px;color:#182430;">${escapeHtml(contact.address)}</p>` : ''}
    ${cityLine ? `<p style="margin:0 0 2px;font-size:14px;color:#182430;">${escapeHtml(cityLine)}</p>` : ''}
    ${contact.phone ? `<p style="margin:0 0 2px;font-size:14px;color:#182430;">Phone: ${escapeHtml(contact.phone)}</p>` : ''}
    ${contact.email ? `<p style="margin:0 0 2px;font-size:14px;color:#182430;">Email: ${escapeHtml(contact.email)}</p>` : ''}
    ${contact.source ? `<p style="margin:8px 0 0;font-size:13px;color:#54626E;">How they heard about us: ${escapeHtml(contact.source)}${contact.source === 'Referral' && contact.referralName ? ' (' + escapeHtml(contact.referralName) + ')' : ''}</p>` : ''}

    <h2 style="font-size:13px;text-transform:uppercase;letter-spacing:0.06em;color:#54626E;margin:22px 0 10px;">Selected Services</h2>
    <table style="width:100%;border-collapse:collapse;">
      ${rowsHtml}
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:14px;">
      ${summaryRowsHtml}
      <tr>
        <td style="padding:10px 0 0;border-top:1px solid #12283F;font-size:16px;font-weight:bold;color:#12283F;">Estimate Total</td>
        <td style="padding:10px 0 0;border-top:1px solid #12283F;font-size:16px;font-weight:bold;color:#12283F;text-align:right;font-family:'Courier New',monospace;">${currency(estimate.grand)}</td>
      </tr>
    </table>
    ${minNote}

    <div style="margin-top:20px;padding:12px 14px;background:#FBEBD3;border:1px solid #E8A33D;border-radius:8px;">
      <p style="margin:0;font-size:12.5px;color:#8A5A18;line-height:1.5;">${DISCLAIMER}</p>
    </div>
  </div>
</div>`.trim();
}

module.exports = {buildTextEmail, buildHtmlEmail, currency};
