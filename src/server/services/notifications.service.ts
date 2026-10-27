import { db } from "@/server/db";

/** The notification centre: a page of 20, the unread count, marking as read. Only ever the signed-in person's own. */
export const PAGE_SIZE = 20;

export async function listNotifications(userId: string, page = 1) {
  const p = Math.max(1, Math.floor(page));
  const [items, total, unread] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, skip: (p - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.notification.count({ where: { userId } }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return {
    items: items.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, url: n.url, read: !!n.readAt, at: n.createdAt.toISOString() })),
    total,
    unread,
    page: p,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function markRead(userId: string, ids: string[] | "all") {
  const res = await db.notification.updateMany({
    where: { userId, readAt: null, ...(ids === "all" ? {} : { id: { in: ids.slice(0, 100) } }) },
    data: { readAt: new Date() },
  });
  return res.count;
}
