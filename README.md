f# Raleigh Power Wash — Instant Estimate Tool + Backend

This folder is a ready-to-deploy Vercel project:

- `public/index.html` — the estimate calculator (front end)
- `api/send-estimate.js` — a serverless function that emails submissions to `info@raleighpowerwash.com` using [Resend](https://resend.com)
- `package.json` — declares the `resend` dependency Vercel will install automatically

No server to manage, no SMTP setup — Vercel runs the function on demand and Resend handles delivery.

## 1. Create a Resend account and get an API key

1. Go to [resend.com](https://resend.com) and sign up (free tier covers this easily — 3,000 emails/month, 100/day).
2. **Verify your domain**: Settings → Domains → Add Domain → enter `raleighpowerwash.com`. Resend gives you a few DNS records (TXT/CNAME) to add wherever your domain's DNS is managed (GoDaddy, Cloudflare, Google Domains, etc.). This usually takes a few minutes to propagate, sometimes up to an hour.
   - You need this because Resend requires sending _from_ a domain you've proven you own — you can't send as `@raleighpowerwash.com` without it.
   - If you'd rather skip domain verification for now, Resend also gives you a shared `onboarding@resend.dev` address for testing — swap that in as `FROM_EMAIL` temporarily.
3. Go to API Keys → Create API Key. Copy it — you'll only see it once.

## 2. Deploy to Vercel

**Easiest path — Vercel CLI:**

```bash
npm install -g vercel   # one-time
cd rpw-estimate-app
vercel                  # follow the prompts, accept defaults
```

**Or via GitHub:**

1. Push this folder to a new GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo, click Deploy.

Either way, Vercel auto-detects `public/` as static files and `api/` as serverless functions — no config file needed.

## 3. Set environment variables

In the Vercel dashboard → your project → Settings → Environment Variables, add:

| Name             | Value                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY` | the key you copied in step 1                                                                                |
| `FROM_EMAIL`     | `Raleigh Power Wash Estimates <estimates@raleighpowerwash.com>` (must be on your verified domain)           |
| `TO_EMAIL`       | `info@raleighpowerwash.com`                                                                                 |
| `ADMIN_PASSCODE` | any passcode you choose — protects `/admin.html` and the rate-sheet API (see "Admin-only rate sheet" below) |

Then redeploy (Vercel → Deployments → ⋯ → Redeploy) so the function picks up the new variables.

## 4. Test it

Visit your deployed URL (something like `rpw-estimate-app.vercel.app`), fill out the contact info, pick a service, and hit **Submit estimate to Raleigh Power Wash**. You should see "Estimate sent ✓" and an email should land in your inbox within a few seconds.

If something goes wrong, check Vercel → your project → Deployments → click the latest → Functions → `api/send-estimate` for the error log.

## 5. Point your real domain at it (optional)

Vercel → your project → Settings → Domains → add a subdomain like `estimate.raleighpowerwash.com` and follow the DNS instructions there.

---

### Notes

- If a Resend send fails (bad key, unverified domain, etc.), the button falls back to opening the visitor's email app with the estimate pre-filled, so a submission is never silently lost.
- All pricing/rate logic still lives in the front end exactly as before — the backend's only job is delivering the email.
- Free tier limits: Resend's free plan is 100 emails/day / 3,000/month, which is generous for an estimate form. Vercel's free (Hobby) plan is also more than enough for this volume of traffic.

## Admin-only rate sheet (now a separate, unlinked page)

Pricing is no longer stored or edited on the customer-facing page at all. The architecture:

- **`/admin.html`** — a separate page, not linked from anywhere on the customer page, where you view and edit rates. It's gated by a passcode prompt.
- **`api/rates.js`** — a serverless function that reads/writes the rate sheet. Every request (GET and POST) must include a matching `x-admin-passcode` header, checked against the `ADMIN_PASSCODE` environment variable.
- **`api/estimate.js`** — the function the customer page actually calls. It takes the customer's raw measurements (square footage, linear footage, material, etc.), looks up the current rates itself, computes the total server-side, and returns only the calculated line items and totals. **The customer's browser never receives a single rate value** — open dev tools and inspect the network tab, and all you'll see are dollar totals, not your $/sq ft numbers. That's a meaningfully stronger guarantee than a client-side password gate.
- **Rate storage** uses [Vercel KV](https://vercel.com/docs/storage/vercel-kv) (a hosted Redis) so a rate change you make on `/admin.html` takes effect immediately for every visitor, with no redeploy. Set it up once:
  1. In your Vercel project → Storage tab → Create Database → KV. Follow the prompts to connect it to this project (this automatically injects the `KV_REST_API_URL` / `KV_REST_API_TOKEN` environment variables — you don't set those yourself).
  2. Redeploy so the function picks up the new environment variables.
  3. If you skip this step, both `/admin.html` and the customer page still work — `api/estimate.js` just falls back to the defaults baked into `lib/defaultRates.js`, and `/admin.html` will tell you rate storage isn't configured yet if you try to save.
- **Set your passcode:** add `ADMIN_PASSCODE` to your Vercel environment variables (see `.env.example`) — pick your own, don't use the placeholder. Redeploy after adding it.

Visit `yourdomain.com/admin.html`, enter the passcode, and edit away — the same rate fields as before (per-sq-ft rates, material multipliers baked into deck/fence math, bundle discounts, minimum job charge, the sq-ft volume discount percentage, etc.).

## Square footage volume discount

Siding, concrete, deck, roof, gutter, and window (glass) pricing use a tiered rate: the first 1,000 sq ft prices at the full rate, the next 1,000 sq ft at rate × (1 − discount), the next 1,000 at rate × (1 − discount)², and so on. The discount percentage itself (default 10%) is one of the editable fields on `/admin.html`.

Gutter cleaning switched from linear footage to home square footage — same basis as siding, roof, and windows. Downspout flush stays a flat fee per job; gutter guard install and gutter brightening scale with square footage too.

## Home square footage field

Below the street address in the contact card, customers see a **"Home square footage"** field. Typing a number there auto-fills the same value into the **siding, window, roof, and gutter** sq-ft fields (the closest available proxy for each — the customer can freely adjust any of them afterward, e.g. roof footprint is usually somewhat larger than living area, window glass is usually much smaller). No external API or account needed — this is a plain form field.

## Window cleaning: french pane glass & storm windows

The window cleaning card asks two yes/no questions: **French pane glass?** and **Storm windows?** Both only affect the _interior_ portion of the cleaning cost — exterior cleaning is untouched either way, since climbing outside to clean glass doesn't get harder because of interior pane style or storm windows.

- French pane glass adds a surcharge (default 20%) to the interior cleaning cost, since more individual panes take more time to detail.
- Storm windows add a surcharge (default 50%) to the interior cleaning cost, since each window effectively becomes two panes of glass to clean from indoors.
- Both surcharges stack additively if both apply (e.g. defaults would add 20% + 50% = 70% on top of the interior cleaning cost).
- All three related rates — the base interior-cleaning add-on percentage, the french pane surcharge, and the storm window surcharge — are editable on `/admin.html`.

## Estimate disclaimer

The estimate panel always shows a visible note: _"This is only an estimate. Raleigh Power Wash will follow up with you to confirm a final, accurate quote before any work is scheduled."_ The same line appears at the bottom of the copied estimate text and the emailed estimate, so it's consistent everywhere a customer sees pricing.

## Emailed estimate formatting

The email sent via `api/send-estimate.js` (built in `lib/emailFormat.js`) is generated fresh from the same structured line-item data the customer page displays — it only ever lists services that were actually selected (nothing with a $0 total, nothing inactive). Two versions are sent together:

- A clean **HTML** version with the Raleigh Power Wash header, a customer info block, a services table, a pricing summary, and the disclaimer — this is what most email clients will render.
- A plain **text** version with the same structure and content, as a fallback for clients that don't render HTML.

# rpw-estimate-app
