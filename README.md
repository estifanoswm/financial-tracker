# Financial Tracker v2.0
**Estifanos.dev · Cloud-synced budget planner**

---

## 🗄️ Step 1 — Set up the database

1. Go to your Supabase dashboard → **SQL Editor**
2. Open the file `SUPABASE_SETUP.sql` from this folder
3. Paste the entire contents into the SQL editor
4. Click **Run**

You should see "Success. No rows returned." — your tables are ready.

---

## 🔐 Step 2 — Enable Email Auth

1. In Supabase dashboard → **Authentication → Providers**
2. Make sure **Email** is enabled
3. Optional: under **Auth → Email Templates**, customize the confirmation email

---

## 🚀 Step 3 — Deploy to Netlify (free)

### Option A — Drag & drop (easiest)
1. Go to [netlify.com](https://netlify.com) and create a free account
2. From your dashboard, drag the entire `financial-tracker` folder onto the page
3. Netlify gives you a live URL instantly (e.g. `https://your-app.netlify.app`)

### Option B — GitHub + auto-deploy
1. Push this folder to a GitHub repo
2. In Netlify → **Add new site → Import from Git**
3. Connect your repo — every push auto-deploys

---

## 📁 File Structure

```
financial-tracker/
├── index.html          ← Login / signup page
├── app.html            ← Main dashboard
├── css/
│   └── style.css       ← All styles + theme variables
├── js/
│   ├── supabase.js     ← Database connection
│   ├── auth.js         ← Login / logout / session
│   ├── charts.js       ← Chart.js setup & updates
│   └── app.js          ← All dashboard logic
├── SUPABASE_SETUP.sql  ← Run this in Supabase SQL Editor
└── README.md           ← This file
```

---

## ✨ Features

- **Cloud sync** — data saved to Supabase in real time
- **Multi-device** — log in from any browser
- **Theme picker** — 9 presets + custom color picker
- **Smart month carryover** — new months auto-seed from previous
- **Budget alerts** — color-coded pills for over/near/on-budget items
- **6-month trend chart** — savings & income history
- **CSV export** — download any month's data
- **Diff column** — see planned vs actual variance per row

---

## 🔒 Security

- Row Level Security (RLS) is enabled — users can only see their own data
- Anon key is safe to use in frontend code (it's public by design)
- Never share your Supabase **service role** key

---

## 🗺️ Roadmap (Pro features)

- [ ] Bank transaction import (CSV/Plaid)
- [ ] Multi-currency support
- [ ] Recurring bills auto-fill
- [ ] AI spending insights
- [ ] PDF report export
- [ ] Shared household budgets
# financial-tracker
