import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Check trending threshold after every AYE vote.
 * When aye_count reaches 25 on an UNRESOLVED post:
 *  - Set status to TRENDING
 *  - Auto-create an ISSUE_ROOM chat room and link it
 */
export async function checkTrendingEscalation(post_id: string): Promise<void> {
  const post = await prisma.experience.findUnique({
    where: { post_id },
  });
  if (!post) return;
  if (post.aye_count < 25) return;
  if (post.status !== "UNRESOLVED") return;

  // Create the issue chat room
  const room = await prisma.chatRoom.create({
    data: {
      college_id: post.college_id,
      room_type: "ISSUE_ROOM",
      name: `⚡ ${post.title.slice(0, 50)}`,
      linked_post_id: post_id,
    },
  });

  // Update post status and link room
  await prisma.experience.update({
    where: { post_id },
    data: {
      status: "TRENDING",
      linked_chat_room_id: room.room_id,
    },
  });
}
