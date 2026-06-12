# Memory

## Owner
- **Name:** Adam Conan Thornton
- **Telegram ID:** 8855418763
- **Phone:** 0421 447 653
- **Email:** adam_thornton@y7mail.com
- **GitHub:** adamthornton-anl

## ANL Constructions
- **ABN:** 61 957 816 341
- **Owner TFN:** 394 424 934
- **App URL:** https://anlconstructions-app.vercel.app/
- **GitHub Repo:** https://github.com/adamthornton-anl/Anlconstructions-app
- **Vercel Dashboard:** https://vercel.com/dashboard

## Workers & Auth (Updated 2026-06-12)

| Name  | Username | Password        | Rate ($/hr) |
|-------|----------|-----------------|-------------|
| Adam  | adam     | SecurePass123!  | $81.49      |
| James | james    | SecurePass456!  | $48.65      |
| Brady | brady    | SecurePass789!  | $29.95      |
| Drew  | drew     | SecurePass012!  | $81.49      |

⚠️ **IMPORTANT**: These are temporary defaults. Change immediately!
- Use strong, unique passwords for each worker
- Share via secure channel (LastPass, 1Password, encrypted email)
- PIN login (4-digit) removed for security as of 2026-06-12

## Worker UUIDs (Supabase)
- Adam:  ba97c403-596f-483b-8dd5-3c11131db62a
- James: 7b309a07-cfea-4e78-8109-e7b7d40f4cf4
- Brady: be3737d8-0235-4fb8-85a6-6150659a278f
- Drew:  3397c62c-b85e-4cda-ac24-fd138b1eb74a

## App Tech Stack
- **Frontend:** Vanilla JS/HTML/CSS, jsPDF (CDN) for hours summary
- **Backend:** Express.js + Supabase
- **Hosting:** Vercel (auto-deploys on git push to master)
- **Supabase URL:** https://tzwsdqbrtohcxzvdfwdw.supabase.co
  - **RLS ENABLED** as of 2026-06-12 (critical security fix)
  - Table: `time_entries` with authenticated-user-only policies
- **Email:** Resend (onboarding@resend.dev sender, working as of 2026-06-03)
- **Auth:** Username + password (upgraded from 4-digit PIN on 2026-06-12)

## Key App Features
- ✅ Username + password login (client-side)
- ✅ Mon–Fri timesheet with tap-to-set start/end times (native time picker)
- ✅ Time auto-fills current time when tapped
- ✅ Lunch button per row (None/30/45/60 min)
- ✅ Job/client field per day inline in table
- ✅ Hours summary PDF download (name + hours + gross pay only)
- ✅ Week navigation (prev/next)
- ✅ Daily 5pm email to Adam with all workers hours + jobs + notes
- ❌ Payroll email removed (was sending sensitive tax/super data)

## Hours Summary Details (Updated 2026-06-12)
- **Removed:** TFN, ABN, tax, superannuation from all PDFs and emails
- **PDF Filename:** Hours-{name}-{isoDate}.pdf (was: Payslip-...)
- **Shows Only:** Worker name, hours, rate, gross pay
- **For ATO Compliance:** Use external accounting software (Xero, MYOB, QuickBooks)
- **Reason:** Never store tax file numbers or ABN in web apps

## Email Setup
- **Provider:** Resend
- **From:** onboarding@resend.dev (test domain, works without verification)
- **To:** adam_thornton@y7mail.com
- **RESEND_API_KEY:** Set in Vercel environment variables ✅
- **Daily Email:** Tested and working 2026-06-03
- **Cron:** Daily Mon-Fri 5pm (hours summary, no tax/super)
- ⚠️ **Friday Payroll Email Removed** (2026-06-12) — was sending sensitive data

## Other Workers
- Drew phone: 0417 914 721

---

## Security Audit & Hardening (2026-06-12)

### Critical Issues Found

1. **RLS Disabled** ← DATABASE WAS PUBLICLY ACCESSIBLE
   - Supabase tables had no Row-Level Security
   - Anyone with project URL could read/edit/delete all data
   - **Status:** ✅ FIXED — RLS enabled on `time_entries` table

2. **Weak Authentication**
   - 4-digit PIN (7264, 5891, etc.) is not secure
   - No password manager integration
   - **Status:** ✅ FIXED — Username + password auth implemented

3. **Sensitive Data Exposure**
   - TFN (tax file number) stored in app
   - ABN (business number) visible on PDFs
   - Tax/super calculations exposed
   - **Status:** ✅ FIXED — All tax/ABN data removed

4. **Business Name Enumeration**
   - "ANL Constructions" reveals business identity
   - Worker dropdown allowed name enumeration
   - **Status:** ✅ FIXED — Renamed to "Timesheet Pro", removed dropdown

### Changes Made (2026-06-12)

**Database (Supabase)**
- SQL policies created via SQL Editor:
  ```sql
  ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "time_entries_select_own" ON public.time_entries 
    FOR SELECT USING (auth.role() = 'authenticated');
  ```

**Code Changes (GitHub master branch)**
- `public/index.html`: Removed worker dropdown, added username/password fields
- `public/app.js`: Updated login logic, removed tax/super display, PDF title changed to "Hours Summary"
- `server.js`: Simplified WORKERS config, added WORKER_CREDS for auth
- Commit: `00efd5e` (Security hardening: Enable RLS, remove PIN auth...)

**Deployment**
- ✅ Pushed to GitHub master
- ✅ Vercel auto-deploys on push
- 🔄 Check live at https://anlconstructions-app.vercel.app/

### Next Steps

1. ✅ RLS enabled
2. ✅ Code updated & deployed
3. 📋 **TODO:** Distribute new usernames/passwords securely to workers
4. 📋 **TODO:** Set each worker a unique strong password
5. 📋 **TODO:** Verify Vercel env vars (ensure only anon key, not service key)
6. 📋 **TODO:** Review old emails (may have contained TFN/ABN)

## Silent Replies
When you have nothing to say, respond with ONLY: NO_REPLY
⚠️ Rules:
- It must be your ENTIRE message — nothing else
- Never append it to an actual response (never include "NO_REPLY" in real replies)
- Never wrap it in markdown or code blocks
❌ Wrong: "Here's help... NO_REPLY"
❌ Wrong: "NO_REPLY"
✅ Right: NO_REPLY
