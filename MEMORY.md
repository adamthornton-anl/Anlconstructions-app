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

## Workers & PINs
| Name | PIN | Rate ($/hr) | Weekly Gross | Weekly Tax | Weekly Super |
|------|-----|-------------|--------------|------------|--------------|
| Adam | 7264 | $81.49 | $3015.04 | $692.00 | $323.04 |
| James | 5891 | $48.65 | $1800.00 | $400.00 | $216.00 |
| Brady | 3742 | $29.95 | $1108.00 | $178.00 | $132.96 |
| Drew | 8159 | $81.49 | $3015.04 | $692.00 | $323.04 |

All rates based on 37hr working week. Tax/super scaled proportionally by hours worked.
Net pay = Gross - Tax - Super

## Worker UUIDs (Supabase)
- Adam:  ba97c403-596f-483b-8dd5-3c11131db62a
- James: 7b309a07-cfea-4e78-8109-e7b7d40f4cf4
- Brady: be3737d8-0235-4fb8-85a6-6150659a278f
- Drew:  3397c62c-b85e-4cda-ac24-fd138b1eb74a

## App Tech Stack
- Frontend: Vanilla JS/HTML/CSS, jsPDF (CDN) for payslip
- Backend: Express.js + Supabase
- Hosting: Vercel (auto-deploys on git push to main)
- Supabase URL: https://tzwsdqbrtohcxzvdfwdw.supabase.co
- Email: Resend (onboarding@resend.dev sender, working as of 2026-06-03)

## Key App Features
- Worker PIN login (client-side)
- Mon–Fri timesheet with tap-to-set start/end times (native time picker)
- Time auto-fills current time when tapped
- Lunch button per row (None/30/45/60 min)
- Job/client field per day inline in table
- Payslip PDF download — includes name, ABN, TFN, hours table, tax/super/net
- Week navigation (prev/next)
- Daily 5pm email to Adam with all workers hours + jobs + notes
- Friday 5pm payroll email with full week breakdown per worker

## Payslip Details
- Employee full name: Adam Conan Thornton (for Adam's payslips)
- Employer ABN shown as: ANL Constructions 61 957 816 341
- Employee TFN shown on PDF only (not visible in app UI)
- PDF filename: Payslip-{name}-{isoDate}.pdf
- Net = Gross - Tax - Super

## Email Setup
- Provider: Resend
- From: onboarding@resend.dev (test domain, works without verification)
- To: adam_thornton@y7mail.com
- RESEND_API_KEY set in Vercel environment variables ✅
- Daily email tested and confirmed working 2026-06-03
- Cron: daily Mon-Fri 5pm, Friday payroll 5pm (UTC+10 AEST = 7am UTC)

## Other Workers
- Drew phone: 0417 914 721

## Silent Replies
When you have nothing to say, respond with ONLY: NO_REPLY
⚠️ Rules:
- It must be your ENTIRE message — nothing else
- Never append it to an actual response (never include "NO_REPLY" in real replies)
- Never wrap it in markdown or code blocks
❌ Wrong: "Here's help... NO_REPLY"
❌ Wrong: "NO_REPLY"
✅ Right: NO_REPLY
