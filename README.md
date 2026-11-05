# AYE Platform — Anything You Experience

> Zero-PII University Problem Tracking & Student Accountability Platform

**No college admin control. No real names. Just verified students, raw evidence, and community accountability.**

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand, Socket.io-client |
| Backend | Node.js + Express, TypeScript, Socket.io, JWT, Swagger/OpenAPI |
| Database | PostgreSQL + Prisma ORM |
| Auth | Custom Zero-PII (Ghost handles, hardware fingerprints, classmate OTP, campus GPS) |

---

## Quick Start

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+ running locally
- `npm` or `pnpm`

### 2. Backend

```bash
cd aye-platform/backend

# Copy env (edit DATABASE_URL to match your Postgres)
cp .env.example .env

# Install deps
npm install

# Generate Prisma client + run migrations
npx prisma generate
npx prisma migrate dev --name init

# Seed initial colleges + admin account
npm run prisma:seed

# Start dev server (port 4000)
npm run dev
```

Swagger UI → http://localhost:4000/api-docs  
Health check → http://localhost:4000/health

**Seeded admin credentials:**
- Ghost handle: `DevAdmin_AYE`
- Password: `AdminPass123!`

### 3. Frontend

```bash
cd aye-platform/frontend

# Copy env
cp .env.example .env.local

# Install deps
npm install

# Start dev server (port 3000)
npm run dev
```

Open → http://localhost:3000

---

## Architecture

```
aye-platform/
├── backend/
│   ├── src/
│   │   ├── index.ts          — Express server + Socket.io init
│   │   ├── routes/
│   │   │   ├── auth.ts       — Register, login, OTP, GPS verify, recover, /me
│   │   │   ├── experiences.ts— Campus Wall CRUD + AYE/junk/polls
│   │   │   ├── chat.ts       — Chat rooms + message history
│   │   │   ├── public.ts     — SEO scoreboard (no auth)
│   │   │   └── devAdmin.ts   — Super-admin management
│   │   ├── socket/index.ts   — Real-time chat + live AYE broadcasts
│   │   ├── middleware/
│   │   │   ├── auth.ts       — JWT verify, requireRole, requireActive
│   │   │   └── collegeSilo.ts— Multi-college data isolation
│   │   ├── services/
│   │   │   ├── antiTroll.ts  — Auto junk detection + strike/ban logic
│   │   │   ├── trending.ts   — Trending escalation + issue room creation
│   │   │   ├── grading.ts    — College Reality Grade calculation
│   │   │   ├── gps.ts        — Haversine geofence + JWT GPS proof tokens
│   │   │   └── fingerprint.ts— Hardware fingerprint ban registry
│   │   └── prisma/seed.ts    — Dev seed data
│   └── prisma/schema.prisma  — Full database schema
│
└── frontend/
    ├── app/
    │   ├── page.tsx          — Landing + college scoreboard
    │   ├── auth/page.tsx     — Login / Register / Recover
    │   ├── c/[slug]/page.tsx — Public college scoreboard (ISR, SEO)
    │   ├── campus/
    │   │   ├── wall/         — Campus Wall feed
    │   │   ├── lounge/       — AYE Lounge real-time chat
    │   │   └── profile/      — Ghost Profile + OTP generator
    │   └── dev-admin/        — Developer Super-Admin console
    ├── components/
    │   ├── cards/ExperienceCard.tsx
    │   ├── forms/            — Login, Register, Recover
    │   ├── layout/           — Navbar (desktop + mobile tab bar)
    │   ├── modals/           — DropExperience, RecoveryKeycard
    │   ├── sections/         — Page-level smart components
    │   └── ui/               — BruteCard, GradeDisplay, StatusBadge, Timer
    └── lib/
        ├── api.ts            — Typed fetch wrappers for all endpoints
        ├── store.ts          — Zustand auth store (persisted)
        ├── socket.ts         — Socket.io singleton
        └── utils.ts          — Hardware fingerprint, Haversine, ghost handle gen
```

---

## Core Features

### Zero-PII Authentication
- **Ghost handles only** — no real name, email, or phone ever collected
- **Classmate OTP** — 6-digit code valid for 120 seconds, locks to college
- **Campus GPS** — browser geolocation verified server-side against geofence (500m default)
- **AYE Recovery Keycard** — 12-char key shown once at signup, bcrypt-hashed server-side
- **Hardware fingerprint bans** — Canvas + WebGL + Audio SHA-256 fingerprint, persisted in `banned_fingerprints`

### Anti-Troll System
- `junk_flag_count >= 5` AND `aye_count < 5` → auto-hide post + 1 Strike + −30 Trust
- 2 Strikes → hardware ban + chain-reaction penalty on inviter (−30 Trust)
- Admin 1-click hardware ban from `/dev-admin`

### College Reality Grade
- Resolution rate = `(resolved / total) * 100`
- Penalty: −2 per overdue issue (>7 days, >25 AYEs), max −20
- Grades: A (85%+), B (70-84%), C (50-69%), D (35-49%), F (<35%)

### Real-Time
- Socket.io rooms per college silo
- Live AYE count broadcasts
- Issue chat rooms auto-created when a post hits 25 AYEs (TRENDING)

---

## API Reference

Swagger UI available at **http://localhost:4000/api-docs** when the backend is running.

Key endpoints:
```
GET  /api/v1/colleges                    Public college list
POST /api/v1/auth/register               Create ghost account
POST /api/v1/auth/login                  Login
GET  /api/v1/auth/me                     Current user profile
POST /api/v1/auth/generate-otp           Generate 2-min classmate OTP
POST /api/v1/auth/verify-gps             GPS geofence check
POST /api/v1/auth/recover                Password reset via keycard
GET  /api/v1/experiences                 Campus Wall feed
POST /api/v1/experiences                 Drop new experience
POST /api/v1/experiences/:id/aye         Toggle AYE upvote
POST /api/v1/experiences/:id/flag-junk   Flag as junk
POST /api/v1/experiences/:id/propose-fix Start resolution poll
POST /api/v1/experiences/:id/vote-fix    Vote on resolution poll
GET  /api/v1/chat/rooms                  Chat rooms for college
GET  /api/v1/chat/rooms/:id/messages     Message history
GET  /api/v1/public/scoreboard/:slug     Public college data (SEO)
POST /api/v1/dev-admin/colleges          Add college
POST /api/v1/dev-admin/ban-user          Hardware ban
POST /api/v1/dev-admin/seed-otp          Seed invite codes
GET  /api/v1/dev-admin/stats             Platform stats
GET  /api/v1/dev-admin/flagged-junk      Junk post queue
```

---

## Governance Rules

1. **Zero College Admin Control** — universities have no accounts, no moderation rights
2. **Strict College Silos** — students only see their own college's data (JWT-enforced)
3. **100% Zero-PII** — no real names, emails, phone numbers, or student IDs ever
4. **Developer Super-Admin only** — platform managed exclusively via `DEV_SUPER_ADMIN` role
