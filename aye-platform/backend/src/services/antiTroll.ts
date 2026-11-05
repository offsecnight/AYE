import { PrismaClient } from "@prisma/client";
import { banFingerprint } from "./fingerprint";

const prisma = new PrismaClient();

/**
 * Run anti-troll check after every junk flag.
 * If junk_flag_count >= 5 AND aye_count < 5:
 *   - Hide the post
 *   - Strike author (+1 strike, -30 trust)
 *   - If strikes >= 2: hardware ban author + penalise inviter
 */
export async function runAntiTrollCheck(post_id: string): Promise<void> {
  const post = await prisma.experience.findUnique({
    where: { post_id },
    include: { author: true },
  });
  if (!post) return;
  if (post.junk_flag_count < 5 || post.aye_count >= 5) return;
  if (post.status === "HIDDEN_JUNK") return; // already processed

  // Hide the post
  await prisma.experience.update({
    where: { post_id },
    data: { status: "HIDDEN_JUNK" },
  });

  const newStrikeCount = post.author.strike_count + 1;
  const newTrustScore  = Math.max(0, post.author.trust_score - 30);
  const shouldBan      = newStrikeCount >= 2;

  // Update author
  await prisma.user.update({
    where: { user_id: post.author_id },
    data: {
      strike_count:   newStrikeCount,
      trust_score:    newTrustScore,
      account_status: shouldBan ? "BANNED_TROLL" : post.author.account_status,
    },
  });

  // Hardware ban if 2+ strikes
  if (shouldBan) {
    await banFingerprint(
      post.author.hardware_fingerprint_hash,
      `Auto-ban: ${newStrikeCount} strikes for troll posts`
    );

    // Chain-reaction: penalise the user who generated their invite OTP
    if (post.author.invited_by_user_id) {
      await prisma.user.update({
        where: { user_id: post.author.invited_by_user_id },
        data: {
          trust_score: {
            decrement: 30,
          },
        },
      });
    }
  }
}

/**
 * Apply chain-reaction penalty when a newly registered user is banned.
 * Called from the ban-user admin route.
 */
export async function applyInviterPenalty(banned_user_id: string): Promise<void> {
  const banned = await prisma.user.findUnique({
    where: { user_id: banned_user_id },
  });
  if (!banned?.invited_by_user_id) return;

  await prisma.user.update({
    where: { user_id: banned.invited_by_user_id },
    data: { trust_score: { decrement: 30 } },
  });
}
