# FeedFlow — Smart Feed Management

**feedflow.cloud** · Bendigo VIC, Australia

## Stack
- Next.js 14 (App Router)
- TypeScript
- Chart.js + react-chartjs-2
- Leaflet + react-leaflet (GPS map)

## Pages
| Route | Description |
|---|---|
| `/` | Redirects to `/home` |
| `/home` | Marketing site |
| `/login` | Login screen |
| `/dashboard` | Main silo dashboard |
| `/dashboard/silo/[id]` | Silo detail |
| `/dashboard/alerts` | Alerts & notifications |
| `/dashboard/analytics` | Consumption analytics |
| `/dashboard/map` | GPS map view |
| `/dashboard/forecast` | AI forecast (7/15/30d) |
| `/dashboard/costs` | Feed cost calculator |
| `/dashboard/animals` | Animal groups & rations |
| `/dashboard/sensors` | Sensor inventory |

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel
1. Push to GitHub
2. Import repo at vercel.com
3. Deploy (auto-detects Next.js)
4. Add domain feedflow.cloud in Settings → Domains

## Update real sensor data
Edit `src/lib/data.ts` — replace mock coordinates and values with real GPS coordinates from DigitPlan API once sensors are installed.

## Environment Variables
```
DIGITPLAN_API_TOKEN=your_token_here
NEXT_PUBLIC_APP_URL=https://feedflow.cloud
```
