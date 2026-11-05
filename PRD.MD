# MASTER PRODUCT REQUIREMENTS DOCUMENT (PRD)
# Project Name: AYE Platform (Anything You Experience)
# Platform Type: Full-Stack Responsive Web Application (Desktop + Mobile PWA)

## 1. EXECUTIVE SUMMARY & CORE PHILOSOPHY
Build "AYE Platform" (Anything You Experience), an independent, developer-owned, Zero-PII (Zero Personal Identifiable Information) university problem-tracking and student community web platform. 

### Strict Governance & Privacy Rules (DO NOT VIOLATE):
1. **Zero College Admin Control:** University administrations have NO accounts, NO moderation rights, and NO ability to delete or hide posts. The platform is controlled strictly by the Developer Super-Admin (`DEV_SUPER_ADMIN`) and driven by verified students (`STUDENT`).
2. **Strict Multi-College Silos:** Every student belongs to one `college_id` (e.g., Yenepoya University, Anupaya University). A student logged into College A can ONLY view and interact with the Campus Wall, Polls, and Chat Rooms of College A. (Only the College Reality Scoreboard is publicly viewable via SEO links).
3. **100% Zero-PII Identity:** NEVER ask for, collect, or store a student's Real Name, Email Address, Phone Number, Roll Number/USN, or Student ID Card photo. Users identify strictly via a `ghost_handle` (e.g., `@CyberWolf_99`), `course_branch` (e.g., `BCA Cyber Security`), and `study_year`.
4. **Self-Hosted Custom Authentication (No SMS/Email OTP):**
   - **Campus Verification:** New students unlock their college silo using EITHER:
     a) **Live 2-Minute Classmate OTP:** Generated inside the app by an already-verified classmate (`6-digit code`, valid for 120 seconds), OR
     b) **Campus GPS Geofence Check:** Browser geolocation verifying the user is physically within a 500m radius of the college coordinates.
   - **Account Credentials:** Login uses `ghost_handle` + `password/PIN`. At sign-up, auto-generate a downloadable **AYE Recovery Keycard** (`12-character secret recovery key`) for password resets.
5. **Strict Seriousness & Anti-Troll Ban System:**
   - This is a serious accountability platform, NOT a meme or gossip page.
   - Every post requires structured problem fields + media evidence.
   - Include a `Flag as Junk/Joke` button. If a post receives 5 Junk flags before 5 AYEs, auto-hide the post, apply a Strike to the author, and penalize the user who generated their invite OTP (Chain-Reaction Accountability).
   - Permanently block banned users using a `hardware_fingerprint_hash` (Canvas/WebGL/Audio fingerprint).

---

## 2. RECOMMENDED TECH STACK FOR AI GENERATION
- **Frontend:** Next.js (App Router) or React + Vite, TypeScript, Tailwind CSS, Shadcn UI, Lucide Icons, Socket.io-client.
- **Backend:** Node.js + Express (or Next.js API Routes + Custom WebSocket Server), TypeScript, JWT (`HttpOnly` cookies + Bearer token).
- **Database & ORM:** PostgreSQL with Prisma ORM (or Supabase / MongoDB).
- **API Documentation:** Swagger / OpenAPI 3.0 served interactively at `/api-docs` using `swagger-ui-express` and `swagger-jsdoc`.
- **Real-Time Engine:** Socket.io / WebSockets for AYE Lounge Chat and live upvote/poll counters.

---

## 3. COMPLETE DATABASE SCHEMA

### Table 1: `colleges`
- `college_id` (UUID, PK)
- `name` (String) — e.g., "Yenepoya University (Bengaluru Campus)"
- `slug` (String, Unique) — e.g., "yenepoya-blr"
- `city` (String)
- `gps_lat` (Float) — Campus center latitude
- `gps_lng` (Float) — Campus center longitude
- `geofence_radius_meters` (Int, default: 500)
- `resolution_rate` (Float, default: 0)
- `reality_grade` (String, default: "N/A") — A, B, C, D, F
- `total_experiences` (Int, default: 0)
- `total_resolved` (Int, default: 0)
- `created_at` (Timestamp)

### Table 2: `users` (Zero-PII Schema)
- `user_id` (UUID, PK)
- `college_id` (UUID, FK -> `colleges.college_id`, Indexed)
- `ghost_handle` (String, Unique) — e.g., "GhostTiger_404"
- `password_hash` (String) — bcrypt hash
- `recovery_key_hash` (String) — bcrypt hash of 12-char recovery key
- `course_branch` (String) — e.g., "BCA Cyber Security"
- `study_year` (Int) — 1, 2, 3, 4
- `verification_method` (Enum: `CLASSMATE_OTP`, `CAMPUS_GPS`, `DEV_SEED`)
- `invited_by_user_id` (UUID, Nullable, FK -> `users.user_id`) — For Chain-Reaction Accountability
- `trust_score` (Int, default: 50) — Starts at 50 (Probation), 80+ (Trusted), 0 (Banned)
- `strike_count` (Int, default: 0) — 2 strikes = Automatic Hardware Ban
- `account_status` (Enum: `ACTIVE`, `RESTRICTED`, `BANNED_TROLL`)
- `hardware_fingerprint_hash` (String, Indexed) — SHA-256 browser hardware signature
- `role` (Enum: `STUDENT`, `CAMPUS_MOD`, `DEV_SUPER_ADMIN`)
- `created_at` (Timestamp)

### Table 3: `campus_otps` (Self-Generated 2-Minute Classmate OTPs)
- `otp_id` (UUID, PK)
- `college_id` (UUID, FK -> `colleges.college_id`)
- `generated_by_user_id` (UUID, FK -> `users.user_id`)
- `otp_code` (String, 6 digits)
- `is_used` (Boolean, default: false)
- `used_by_user_id` (UUID, Nullable)
- `expires_at` (Timestamp) — CreatedAt + 120 seconds

### Table 4: `experiences` (Problem Posts)
- `post_id` (UUID, PK)
- `college_id` (UUID, FK -> `colleges.college_id`, Indexed)
- `author_id` (UUID, FK -> `users.user_id`)
- `hide_handle` (Boolean, default: false) — If true, masks `ghost_handle` as "Verified Campus Ghost"
- `title` (String, max 140 chars)
- `what_is_wrong` (Text, Required) — Structured serious description
- `exact_location` (String, Required) — e.g., "Block B, 3rd Floor Lab 2"
- `impact_scope` (String, Required) — e.g., "150+ BCA Students"
- `category` (Enum: `HOSTEL`, `MESS_FOOD`, `LABS_WIFI`, `FEES_ADMIN`, `FACULTY`, `INFRASTRUCTURE`, `SAFETY`)
- `severity` (Enum: `NORMAL`, `HIGH`, `CRITICAL`)
- `media_urls` (JSON Array of Strings) — EXIF-stripped image/video URLs
- `aye_count` (Int, default: 1) — Upvotes ("I experience this too")
- `junk_flag_count` (Int, default: 0) — Troll/Joke flags
- `status` (Enum: `UNRESOLVED`, `TRENDING`, `FIX_PROPOSED`, `RESOLVED`, `HIDDEN_JUNK`)
- `linked_chat_room_id` (UUID, Nullable)
- `created_at` (Timestamp)
- `resolved_at` (Timestamp, Nullable)

### Table 5: `post_interactions` (AYEs, Junk Flags, Crowd Proofs)
- `interaction_id` (UUID, PK)
- `post_id` (UUID, FK -> `experiences.post_id`)
- `user_id` (UUID, FK -> `users.user_id`)
- `type` (Enum: `AYE_VOTE`, `JUNK_FLAG`, `CROWD_PROOF`)
- `proof_media_url` (String, Nullable) — Used when `type == CROWD_PROOF`
- `comment_text` (Text, Nullable)
- `created_at` (Timestamp)
- *Unique Constraint:* `(post_id, user_id, type)` for `AYE_VOTE` and `JUNK_FLAG`.

### Table 6: `resolution_polls` (Community Truth Engine)
- `poll_id` (UUID, PK)
- `post_id` (UUID, FK -> `experiences.post_id`)
- `proposed_by_user_id` (UUID, FK -> `users.user_id`)
- `fix_proof_media_url` (String, Required) — Photo showing the issue is fixed
- `fix_note` (String)
- `yes_fixed_votes` (Int, default: 1)
- `no_broken_votes` (Int, default: 0)
- `poll_status` (Enum: `ACTIVE`, `APPROVED_RESOLVED`, `REJECTED_STILL_BROKEN`)
- `created_at` (Timestamp)
- `expires_at` (Timestamp)

### Table 7: `chat_rooms` & `chat_messages` (AYE Lounge)
- **`chat_rooms`:** `room_id` (PK), `college_id` (FK), `room_type` (`GLOBAL`, `BRANCH`, `ISSUE_ROOM`, `DM`), `name`, `linked_post_id` (Nullable), `created_at`.
- **`chat_messages`:** `msg_id` (PK), `room_id` (FK), `sender_id` (FK), `send_as_ghost` (Boolean), `content` (Text), `media_url` (Nullable), `created_at`.

### Table 8: `banned_fingerprints`
- `fingerprint_hash` (String, PK)
- `reason` (String)
- `banned_at` (Timestamp)

---

## 4. CORE BUSINESS LOGIC & ALGORITHMS

### 1. Live 2-Minute Classmate OTP & Chain Accountability
- Any `ACTIVE` user with `trust_score >= 50` can click **"Generate Classmate OTP"**.
- Backend creates a 6-digit code in `campus_otps` expiring in 120 seconds, locked to the generator's `college_id`.
- When a new user signs up with that OTP, `users.invited_by_user_id` is set to `generated_by_user_id`.
- **Penalty Rule:** If the new user is banned for trolling (`BANNED_TROLL`), automatically deduct `30` points from `invited_by_user_id`'s `trust_score`.

### 2. Automated Anti-Troll & Junk Takedown
- If `junk_flag_count >= 5` AND `aye_count < 5`:
  1. Set `experiences.status = 'HIDDEN_JUNK'`.
  2. Increment author's `strike_count` by 1 and deduct `30` from `trust_score`.
  3. If `strike_count >= 2`, set `account_status = 'BANNED_TROLL'` and insert `hardware_fingerprint_hash` into `banned_fingerprints`.

### 3. Trending Escalation & Issue Chat Creation
- When `experiences.aye_count` reaches `25`:
  1. Update `status` to `TRENDING` (if currently `UNRESOLVED`).
  2. Auto-create a `chat_rooms` record with `room_type = 'ISSUE_ROOM'` and link `linked_chat_room_id`.

### 4. Community Resolution Poll (No Admin Needed)
- Any student in that college can click **"Propose Resolved"** on an `UNRESOLVED` or `TRENDING` post by uploading a mandatory photo of the fix (`fix_proof_media_url`).
- Post status changes to `FIX_PROPOSED`.
- Students who previously voted `AYE_VOTE` on the post can vote `YES (Fixed)` or `NO (Still Broken)`.
- Once total votes reach `10` (or after 48 hours):
  - If `yes_fixed_votes >= 70%`, set `experiences.status = 'RESOLVED'`, record `resolved_at`, and recalculate the college's `resolution_rate`.
  - Otherwise, revert `experiences.status` to `UNRESOLVED` and mark poll `REJECTED_STILL_BROKEN`.

### 5. College Reality Grade Calculation
- Calculate `resolution_rate = (total_resolved / total_experiences) * 100`.
- Apply penalty for overdue issues (unresolved > 7 days with > 25 AYEs).
- Grade Mapping: `85%+ = A`, `70-84% = B`, `50-69% = C`, `35-49% = D`, `<35% = F`.

---

## 5. REST API & SWAGGER SPECIFICATION (`/api-docs`)
Configure `swagger-jsdoc` and `swagger-ui-express` at `/api-docs`. Include Bearer JWT authentication in Swagger UI.

### Auth & Zero-PII Verification Routes
- `GET /api/v1/colleges` — Public list of colleges + Reality Scores.
- `POST /api/v1/auth/generate-otp` — (Auth Required) Generate 2-min 6-digit Classmate OTP.
- `POST /api/v1/auth/verify-gps` — Validate lat/lng against college geofence.
- `POST /api/v1/auth/register` — Register with `college_id`, `ghost_handle`, `password`, `course_branch`, `study_year`, `hardware_fingerprint_hash`, and `otp_code` (or GPS token). Returns JWT + `secret_recovery_key`.
- `POST /api/v1/auth/login` — Login with `ghost_handle`, `password`, and `hardware_fingerprint_hash` (reject if fingerprint is in `banned_fingerprints`).
- `POST /api/v1/auth/recover` — Reset password using `ghost_handle` + `secret_recovery_key`.

### Campus Wall & Experience Routes (Auto-filtered by `req.user.college_id`)
- `GET /api/v1/experiences` — Query params: `status`, `category`, `sort` (`ayes`, `newest`, `oldest_unresolved`).
- `POST /api/v1/experiences` — Create structured problem post (strips EXIF data from images).
- `GET /api/v1/experiences/:id` — Get full post details, crowd proofs, comments, and active resolution poll.
- `POST /api/v1/experiences/:id/aye` — Toggle `AYE! (+1)` upvote.
- `POST /api/v1/experiences/:id/flag-junk` — Flag post as non-serious/joke.
- `POST /api/v1/experiences/:id/crowd-proof` — Attach additional student photo evidence.
- `POST /api/v1/experiences/:id/propose-fix` — Upload fix photo and start Resolution Poll.
- `POST /api/v1/experiences/:id/vote-fix` — Vote `YES` or `NO` on active Resolution Poll.

### AYE Lounge (Chat) & Scoreboard Routes
- `GET /api/v1/chat/rooms` — Get all rooms (`GLOBAL`, `BRANCH`, `ISSUE_ROOM`, `DM`) for `req.user.college_id`.
- `GET /api/v1/chat/rooms/:roomId/messages` — Get message history.
- `GET /api/v1/public/scoreboard/:collegeSlug` — Public college accountability data.

### Developer Super-Admin Routes (`role == DEV_SUPER_ADMIN`)
- `POST /api/v1/dev-admin/colleges` — Add new college + GPS coordinates.
- `POST /api/v1/dev-admin/ban-user` — 1-click hardware ban user + penalize inviter.
- `POST /api/v1/dev-admin/seed-otp` — Generate master seed invite codes for a new college.

---

## 6. FRONTEND UI & SCREEN ARCHITECTURE

### Visual Theme & Design System
- **Theme:** High-contrast Dark Mode default (`#0B0C10` background, `#14161D` cards, `#F3F4F6` text).
- **Status Colors:** Unresolved/Urgent = Crimson Red (`#E11D48`), Trending/Poll Active = Amber (`#F59E0B`), Resolved = Emerald Green (`#10B981`).
- **Responsive Shell:** 3-Column layout on Desktop (Left Nav + Channels `260px`, Center Feed `fluid max 780px`, Right Reality Scoreboard `320px`). Collapses to Bottom Tab Bar on Mobile.

### Core Views to Build:
1. **Landing & Public Scoreboard (`/`, `/c/[slug]`):** Search any college, view its live Grade (`A–F`), Resolved vs. Unresolved metrics, and longest-ignored problems.
2. **Zero-PII Onboarding (`/auth`):** Tabs for Login, Register (with 6-digit Classmate OTP or 1-Tap Campus GPS check), and downloadable **AYE Recovery Keycard Modal**.
3. **Campus Wall (`/campus/wall`):**
   - Sticky filter bar (`All`, `Unresolved`, `Trending`, `Fix Proposed`, `Resolved` + Category chips).
   - **Experience Card:** Shows Ghost Handle, Category badge, live ticking red timer (`Unresolved for 14d 6h`), structured fields (`What's Wrong`, `Location`, `Impact`), Media Grid, **`AYE! (+1)`** button, **`+ Add Proof`** button, **`Propose Fix`** button, **`Join Issue Chat`** button, and **`Flag Junk`** icon.
4. **Drop an Experience Modal:** Enforces Seriousness Policy banner, structured inputs, media upload, and `Hide My Ghost Handle` switch.
5. **AYE Lounge Chat (`/campus/lounge`):** Discord-style split view with Campus Channels, Trending Issue Chats, and Peer DMs, plus a `Chat as Ghost` toggle.
6. **My Ghost Profile (`/campus/profile`):** Shows Trust Score, Strikes (`0/2`), **"Generate 2-Min Classmate OTP"** button with live countdown timer, and My Posts/AYEs.
7. **Developer Super-Admin Console (`/dev-admin`):** Manage colleges, generate seed OTPs, view flagged junk posts, and execute 1-click hardware bans.