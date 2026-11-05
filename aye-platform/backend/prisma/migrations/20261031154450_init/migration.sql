-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('CLASSMATE_OTP', 'CAMPUS_GPS', 'DEV_SEED');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'RESTRICTED', 'BANNED_TROLL');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'CAMPUS_MOD', 'DEV_SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "ExperienceCategory" AS ENUM ('HOSTEL', 'MESS_FOOD', 'LABS_WIFI', 'FEES_ADMIN', 'FACULTY', 'INFRASTRUCTURE', 'SAFETY');

-- CreateEnum
CREATE TYPE "ExperienceSeverity" AS ENUM ('NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ExperienceStatus" AS ENUM ('UNRESOLVED', 'TRENDING', 'FIX_PROPOSED', 'RESOLVED', 'HIDDEN_JUNK');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('AYE_VOTE', 'JUNK_FLAG', 'CROWD_PROOF');

-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('ACTIVE', 'APPROVED_RESOLVED', 'REJECTED_STILL_BROKEN');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('GLOBAL', 'BRANCH', 'ISSUE_ROOM', 'DM');

-- CreateTable
CREATE TABLE "College" (
    "college_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "gps_lat" DOUBLE PRECISION NOT NULL,
    "gps_lng" DOUBLE PRECISION NOT NULL,
    "geofence_radius_meters" INTEGER NOT NULL DEFAULT 500,
    "resolution_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reality_grade" TEXT NOT NULL DEFAULT 'N/A',
    "total_experiences" INTEGER NOT NULL DEFAULT 0,
    "total_resolved" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "College_pkey" PRIMARY KEY ("college_id")
);

-- CreateTable
CREATE TABLE "User" (
    "user_id" TEXT NOT NULL,
    "college_id" TEXT NOT NULL,
    "ghost_handle" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "recovery_key_hash" TEXT NOT NULL,
    "course_branch" TEXT NOT NULL,
    "study_year" INTEGER NOT NULL,
    "verification_method" "VerificationMethod" NOT NULL,
    "invited_by_user_id" TEXT,
    "trust_score" INTEGER NOT NULL DEFAULT 50,
    "strike_count" INTEGER NOT NULL DEFAULT 0,
    "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "hardware_fingerprint_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "CampusOtp" (
    "otp_id" TEXT NOT NULL,
    "college_id" TEXT NOT NULL,
    "generated_by_user_id" TEXT NOT NULL,
    "otp_code" TEXT NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "used_by_user_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampusOtp_pkey" PRIMARY KEY ("otp_id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "post_id" TEXT NOT NULL,
    "college_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "hide_handle" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "what_is_wrong" TEXT NOT NULL,
    "exact_location" TEXT NOT NULL,
    "impact_scope" TEXT NOT NULL,
    "category" "ExperienceCategory" NOT NULL,
    "severity" "ExperienceSeverity" NOT NULL DEFAULT 'NORMAL',
    "media_urls" JSONB NOT NULL DEFAULT '[]',
    "aye_count" INTEGER NOT NULL DEFAULT 1,
    "junk_flag_count" INTEGER NOT NULL DEFAULT 0,
    "status" "ExperienceStatus" NOT NULL DEFAULT 'UNRESOLVED',
    "linked_chat_room_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("post_id")
);

-- CreateTable
CREATE TABLE "PostInteraction" (
    "interaction_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL,
    "proof_media_url" TEXT,
    "comment_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostInteraction_pkey" PRIMARY KEY ("interaction_id")
);

-- CreateTable
CREATE TABLE "ResolutionPoll" (
    "poll_id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "proposed_by_user_id" TEXT NOT NULL,
    "fix_proof_media_url" TEXT NOT NULL,
    "fix_note" TEXT,
    "yes_fixed_votes" INTEGER NOT NULL DEFAULT 1,
    "no_broken_votes" INTEGER NOT NULL DEFAULT 0,
    "poll_status" "PollStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolutionPoll_pkey" PRIMARY KEY ("poll_id")
);

-- CreateTable
CREATE TABLE "ChatRoom" (
    "room_id" TEXT NOT NULL,
    "college_id" TEXT NOT NULL,
    "room_type" "RoomType" NOT NULL,
    "name" TEXT NOT NULL,
    "linked_post_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRoom_pkey" PRIMARY KEY ("room_id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "msg_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "send_as_ghost" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "media_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("msg_id")
);

-- CreateTable
CREATE TABLE "BannedFingerprint" (
    "fingerprint_hash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "banned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BannedFingerprint_pkey" PRIMARY KEY ("fingerprint_hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "College_slug_key" ON "College"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_ghost_handle_key" ON "User"("ghost_handle");

-- CreateIndex
CREATE UNIQUE INDEX "User_hardware_fingerprint_hash_key" ON "User"("hardware_fingerprint_hash");

-- CreateIndex
CREATE INDEX "User_college_id_idx" ON "User"("college_id");

-- CreateIndex
CREATE INDEX "User_hardware_fingerprint_hash_idx" ON "User"("hardware_fingerprint_hash");

-- CreateIndex
CREATE UNIQUE INDEX "CampusOtp_used_by_user_id_key" ON "CampusOtp"("used_by_user_id");

-- CreateIndex
CREATE INDEX "Experience_college_id_idx" ON "Experience"("college_id");

-- CreateIndex
CREATE INDEX "Experience_status_idx" ON "Experience"("status");

-- CreateIndex
CREATE INDEX "Experience_created_at_idx" ON "Experience"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "PostInteraction_post_id_user_id_type_key" ON "PostInteraction"("post_id", "user_id", "type");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "College"("college_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "User"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusOtp" ADD CONSTRAINT "CampusOtp_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "College"("college_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusOtp" ADD CONSTRAINT "CampusOtp_generated_by_user_id_fkey" FOREIGN KEY ("generated_by_user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampusOtp" ADD CONSTRAINT "CampusOtp_used_by_user_id_fkey" FOREIGN KEY ("used_by_user_id") REFERENCES "User"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "College"("college_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_linked_chat_room_id_fkey" FOREIGN KEY ("linked_chat_room_id") REFERENCES "ChatRoom"("room_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostInteraction" ADD CONSTRAINT "PostInteraction_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Experience"("post_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostInteraction" ADD CONSTRAINT "PostInteraction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionPoll" ADD CONSTRAINT "ResolutionPoll_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Experience"("post_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionPoll" ADD CONSTRAINT "ResolutionPoll_proposed_by_user_id_fkey" FOREIGN KEY ("proposed_by_user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRoom" ADD CONSTRAINT "ChatRoom_college_id_fkey" FOREIGN KEY ("college_id") REFERENCES "College"("college_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "ChatRoom"("room_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
