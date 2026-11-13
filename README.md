# Kiptum Household Budget (v2)

Private household budget app — income, expenses, bills, loans — for the Kiptum household.

- **Frontend:** static glass UI in `public/` (installable PWA)
- **Backend:** Vercel Functions in `api/`, data stored as one private JSON file in **Vercel Blob** (never pauses)
- **Privacy:** passcode lock (`APP_PIN`) with a signed, HttpOnly session cookie (`SESSION_SECRET`)
- **Backups:** nightly cron (`/api/backup`, 21:00 UTC = midnight Nairobi) keeps 60 daily snapshots; restore from Settings
- **Deploys:** every push to `main` auto-deploys on Vercel

## Environment variables (Vercel → Project → Settings → Environment Variables)
| Key | Purpose |
| --- | --- |
| `APP_PIN` | The passcode to unlock the app. Change it here and redeploy. |
| `SESSION_SECRET` | Random string used to sign login sessions. Changing it logs everyone out. |
| `CRON_SECRET` | Lets the nightly backup cron call `/api/backup`. |
| `BLOB_READ_WRITE_TOKEN` | Added automatically by the linked Blob store. |

## Importing data from the old Supabase app
Restore the paused Supabase project, export each table (transactions, bills, balances, categories) as CSV, then use **Settings → Import old data** and pick all the CSV files at once.
