import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { sendToUser } from "./notify.service";

/*
 * Help and complaints (शिकायत), the way public services run them: every complaint gets a ticket number, a status
 * and a written reply; the person is notified when it changes. Admins answer from /admin/grievances.
 */

export const CATEGORIES = ["BILL", "SHOP_ITEM", "SCHEME", "MOHALLA", "PRIVACY", "ACCOUNT", "OTHER"] as const;

export const GrievanceInput = z.object({
  category: z.enum(CATEGORIES),
  subject: z.string().trim().min(5, "Write a short subject").max(120),
  message: z.string().trim().min(20, "Tell us a little more (at least a line)").max(2000),
  householdId: z.string().max(40).optional(),
});

export class GrievanceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const ticketFor = (n: number) => `CW-GRV-${new Date().getFullYear()}-${String(n).padStart(6, "0")}`;

export async function fileGrievance(user: { id: string; platformRole: string }, body: unknown) {
  const parsed = GrievanceInput.safeParse(body);
  if (!parsed.success) throw new GrievanceError(parsed.error.issues[0]?.message ?? "Check the form.");
  const { householdId, ...g } = parsed.data;
  if (householdId) {
    const member = await db.membership.findFirst({ where: { userId: user.id, householdId, status: "ACTIVE" } });
    if (!member) throw new GrievanceError("That home isn't yours.", 403);
  }
  const merchant = user.platformRole === "MERCHANT" ? await db.merchant.findUnique({ where: { userId: user.id }, select: { id: true } }) : null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const n = (await db.grievance.count()) + 1 + attempt;
    try {
      return await db.grievance.create({
        data: { ticket: ticketFor(n), userId: user.id, householdId: householdId ?? null, merchantId: merchant?.id ?? null, ...g },
        select: { ticket: true, status: true, createdAt: true },
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err; // ticket taken by a parallel filing
    }
  }
  throw new GrievanceError("Couldn't file it just now. Try again.", 503);
}

const view = (g: Awaited<ReturnType<typeof db.grievance.findMany>>[number]) => ({
  id: g.id,
  ticket: g.ticket,
  category: g.category,
  subject: g.subject,
  message: g.message,
  status: g.status,
  response: g.response,
  createdAt: g.createdAt.toISOString(),
  updatedAt: g.updatedAt.toISOString(),
  resolvedAt: g.resolvedAt?.toISOString() ?? null,
});

export async function myGrievances(userId: string) {
  return (await db.grievance.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 })).map(view);
}

export async function adminGrievances(status?: string) {
  const rows = await db.grievance.findMany({
    where: status ? { status } : {},
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    take: 200,
  });
  const users = await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId).filter((x): x is string => !!x) } }, select: { id: true, name: true, email: true, platformRole: true } });
  return rows.map((r) => ({ ...view(r), from: users.find((u) => u.id === r.userId) ?? null, householdId: r.householdId }));
}

export const ResponseInput = z.object({ status: z.enum(["IN_PROGRESS", "RESOLVED"]), response: z.string().trim().min(5).max(2000) });

export async function respond(id: string, adminId: string, body: unknown) {
  const parsed = ResponseInput.safeParse(body);
  if (!parsed.success) throw new GrievanceError("Write a reply and choose a status.");
  const g = await db.grievance.findUnique({ where: { id } });
  if (!g) throw new GrievanceError("Ticket not found", 404);
  const updated = await db.grievance.update({
    where: { id },
    data: { status: parsed.data.status, response: parsed.data.response, respondedById: adminId, resolvedAt: parsed.data.status === "RESOLVED" ? new Date() : null },
  });
  if (g.userId) {
    await sendToUser(g.userId, {
      title: parsed.data.status === "RESOLVED" ? `Resolved: ${g.ticket}` : `Update on ${g.ticket}`,
      body: parsed.data.response.slice(0, 140),
      url: g.merchantId ? "/merchant/help" : "/grievance",
      tag: `grievance:${g.id}`,
    }).catch(() => 0);
  }
  return view(updated);
}
