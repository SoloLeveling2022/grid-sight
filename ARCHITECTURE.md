# GridSight Architecture

## Problem & Users

**Problem:** Roadside obstruction (illegal parking, breakdowns, water logging) causes congestion — not just detection, but *impact* on traffic flow.

**Primary user:** Bengaluru Traffic Police — prioritize enforcement, dispatch patrols, manage corridors.

**Secondary user:** Citizens — avoid disruption, get alternate routes, report obstructions.

## Folder Structure

```
gridsight-app/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Landing / pitch
│   │   ├── police/page.tsx     # Police control room (map-first)
│   │   ├── citizen/page.tsx    # Public advisory layer
│   │   └── api/
│   │       ├── voice/          # Voice agent contracts (session, command, transcript)
│   │       └── ml/             # ML service endpoints (hotspot, congestion, recommendations)
│   ├── components/
│   │   ├── map/                # GridSightMap (provider-agnostic)
│   │   ├── dashboard/          # Analytics, queues, alerts
│   │   ├── voice/              # VoiceAgent UI
│   │   ├── layout/             # AppShell
│   │   └── ui/                 # shadcn-style primitives
│   ├── data/                   # Processed JSON from Astram CSV
│   ├── services/
│   │   ├── map/                # IMapProvider → Mock / MapmyIndia stub
│   │   ├── ml/                 # IMLService → MockMLService
│   │   └── voice/              # IVoiceProvider → MockVoiceProvider
│   ├── store/                  # Zustand (police, citizen, voice)
│   └── types/                  # Shared TypeScript contracts
├── scripts/process-data.py     # CSV → processed-data.json
└── ...
```

## Data Pipeline

1. **Source:** `Astram event data_anonymized.csv` (8,173 incidents, Bengaluru geospatial)
2. **Processing:** `scripts/process-data.py` derives hotspots, severity, recommendations, alerts
3. **Runtime:** Frontend reads `src/data/processed-data.json` — no DB required

## Service Abstractions

| Layer | Interface | Current impl | Future |
|-------|-----------|--------------|--------|
| Map | `IMapProvider` | `MockMapProvider` | MapmyIndia SDK |
| ML | `IMLService` | `MockMLService` | XGBoost / FastAPI |
| Voice | `IVoiceProvider` | `MockVoiceProvider` | STT + LLM + TTS |

Replace mock services by swapping implementations — UI already consumes typed outputs.

## Demo Loop

1. Incident appears on map → 2. Impact score → 3. Priority queue → 4. Citizen advisory → 5. Voice query → 6. Enforcement recommendation

## Commands

```bash
cd gridsight-app
python ../scripts/process-data.py   # Regenerate mock data from CSV
npm run dev                          # http://localhost:3000
```
