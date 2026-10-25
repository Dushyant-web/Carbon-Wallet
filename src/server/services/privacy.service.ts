import { db } from "@/server/db";
import { EngineError, engineGetStatement, engineShredStatements, engineStatementStatus } from "@/server/engine";
import { verifyPassword } from "@/server/auth/password";
import { getEncrypted, removeStored } from "@/server/storage/encrypted";

/*
 * Your data, your call (DPDP Act 2023; flaws.md G2):
 *   export  everything about you and your households in one file, including sealed-statement proofs
 *   delete  ask to be erased: you're signed out everywhere at once, and 30 days later everything goes:
 *           rows, stored bill files, and the salts of sealed statements (their on-chain roots stay, but can
 *           never be linked to you again). Only a count is kept, with no names or ids.
 */

export const CONSENT_VERSION = "2026-10"; // the privacy notice at /privacy
export const ERASE_AFTER_DAYS = 30;
const DAY = 86_400_000;

export class PrivacyError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export async function recordConsent(userId: string) {
  await db.user.update({ where: { id: userId }, data: { consentVersion: CONSENT_VERSION, consentAt: new Date() } });
}

/** One JSON file with everything we hold about this person and their households. */
export async function exportUserData(userId: string, includeFiles = false) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true, platformRole: true, createdAt: true, lastLoginAt: true, consentVersion: true, consentAt: true, notifyPrefs: true },
  });
  const memberships = await db.membership.findMany({ where: { userId }, include: { household: true } });
  const devices = await db.pushSubscription.findMany({ where: { userId }, select: { userAgent: true, createdAt: true, lastSentAt: true } });
  const myActions = await db.auditLog.findMany({ where: { userId }, select: { householdId: true, action: true, entity: true, details: true, at: true }, orderBy: { at: "asc" } });

  const households = [];
  for (const m of memberships) {
    const h = m.household;
    const id = h.id;
    const manager = m.role === "OWNER";
    const [activities, bills, fuelLogs, appliances, vehicles, months, checkIns, goals, recommendations, shares, cards, documents] = await Promise.all([
      db.activity.findMany({ where: { householdId: id }, orderBy: { occurredOn: "asc" } }),
      db.bill.findMany({ where: { householdId: id }, orderBy: { periodStart: "asc" } }),
      db.fuelLog.findMany({ where: { householdId: id }, orderBy: { filledOn: "asc" } }),
      db.appliance.findMany({ where: { householdId: id } }),
      db.vehicle.findMany({ where: { householdId: id } }),
      db.monthlySummary.findMany({ where: { householdId: id }, orderBy: { month: "asc" } }),
      db.checkIn.findMany({ where: { householdId: id }, orderBy: { weekStart: "asc" } }),
      db.goal.findMany({ where: { householdId: id } }),
      db.recommendation.findMany({ where: { householdId: id } }),
      manager ? db.shareLink.findMany({ where: { householdId: id } }) : Promise.resolve([]),
      db.card.findMany({ where: { householdId: id } }),
      db.document.findMany({ where: { householdId: id }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true, storagePath: true, status: true, createdAt: true } }),
    ]);

    // sealed statements with their salts and proofs: keep them and you can prove your months anywhere, any time
    let statements: unknown[] | { unavailable: string } = [];
    try {
      const status = await engineStatementStatus(id);
      statements = await Promise.all(status.map(async (s) => ({ ...s, bundle: await engineGetStatement(s.statement_id) })));
    } catch (err) {
      statements = { unavailable: err instanceof EngineError ? "The proof service was offline; export again later for your sealed statements." : "Couldn't read sealed statements." };
    }

    const files = [];
    if (includeFiles && m.role === "OWNER") {
      for (const d of documents.filter((x) => x.storagePath)) {
        try {
          files.push({ fileName: d.fileName, mimeType: d.mimeType, base64: (await getEncrypted([...d.storagePath!.split("/"), "original.bin"])).toString("base64") });
        } catch {
          /* already removed */
        }
      }
    }

    households.push({
      household: {
        name: h.name,
        city: h.city,
        state: h.state,
        size: h.size,
        homeType: h.homeType,
        floorAreaM2: h.floorAreaM2,
        carbonId: h.carbonId,
        cardCode: h.cardCode,
        joinCode: manager ? h.joinCode : undefined,
        createdAt: h.createdAt,
      },
      yourRole: m.role,
      monthlyTotals: months.map((s) => ({ month: s.month, totalKg: s.totalKg, byCategory: JSON.parse(s.byCategory || "{}"), score: s.score })),
      activities,
      bills,
      billFiles: documents.map(({ storagePath, ...d }) => ({ ...d, originalStored: !!storagePath })),
      ...(files.length ? { billFileContents: files } : {}),
      fuelLogs,
      appliances,
      vehicles,
      checkIns: checkIns.map((c) => ({ ...c, answers: JSON.parse(c.answers) })),
      goals,
      suggestionsAndCommitments: recommendations,
      cards,
      shareLinks: shares,
      sealedStatements: statements,
    });
  }

  return {
    format: "carbon-wallet-export/v1",
    exportedAt: new Date().toISOString(),
    privacyNotice: { version: CONSENT_VERSION, url: "/privacy" },
    you: { ...user, notifyPrefs: user.notifyPrefs ? JSON.parse(user.notifyPrefs) : null, devicesWithReminders: devices },
    households,
    whatYouDid: myActions,
  };
}

/** What deleting this account would do to each household, so the person can decide before confirming. */
export async function deletionPlan(userId: string) {
  const memberships = await db.membership.findMany({
    where: { userId, status: "ACTIVE" },
    include: { household: { include: { memberships: { where: { status: "ACTIVE" }, select: { userId: true, role: true } } } } },
  });
  return memberships.map((m) => {
    const others = m.household.memberships.filter((x) => x.userId !== userId);
    const otherOwners = others.filter((x) => x.role === "OWNER").length;
    return {
      householdId: m.householdId,
      name: m.household.name,
      role: m.role,
      otherMembers: others.length,
      // you leave, it stays | it's deleted with you (nobody else in it) | you must choose (sole owner, others in it)
      outcome: others.length === 0 ? "deleted" : m.role !== "OWNER" || otherOwners > 0 ? "you_leave" : "choose",
    } as const;
  });
}

/**
 * Asks for this account to be erased. `deleteHouseholds`: shared households (where this person is the only owner)
 * to delete as well; the alternative is to make someone else an owner first.
 */
export async function requestAccountDeletion(userId: string, password: string, deleteHouseholds: string[] = []) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(password, user.passwordHash))) throw new PrivacyError("That password isn't right.", 403);
  const plan = await deletionPlan(userId);
  const undecided = plan.filter((p) => p.outcome === "choose" && !deleteHouseholds.includes(p.householdId));
  if (undecided.length) {
    throw new PrivacyError(`You're the only owner of ${undecided.map((p) => p.name).join(", ")}. Make another member an owner first, or delete it too.`, 409);
  }
  const now = new Date();
  const doomed = plan.filter((p) => p.outcome === "deleted" || (p.outcome === "choose" && deleteHouseholds.includes(p.householdId))).map((p) => p.householdId);
  await db.$transaction([
    db.household.updateMany({ where: { id: { in: doomed } }, data: { status: "DELETION_PENDING", deletionRequestedAt: now } }),
    db.membership.deleteMany({ where: { userId, householdId: { notIn: doomed } } }), // leaves the households that carry on
    db.user.update({ where: { id: userId }, data: { status: "DELETION_PENDING", deletionRequestedAt: now } }),
    db.session.deleteMany({ where: { userId } }), // signed out everywhere
    db.pushSubscription.deleteMany({ where: { userId } }),
  ]);
  return { eraseOn: new Date(now.getTime() + ERASE_AFTER_DAYS * DAY).toISOString(), households: doomed.length };
}

/** An owner deletes one household (the account stays). */
export async function requestHouseholdDeletion(householdId: string, userId: string, password: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(password, user.passwordHash))) throw new PrivacyError("That password isn't right.", 403);
  const now = new Date();
  await db.household.update({ where: { id: householdId }, data: { status: "DELETION_PENDING", deletionRequestedAt: now } });
  return { eraseOn: new Date(now.getTime() + ERASE_AFTER_DAYS * DAY).toISOString() };
}

/** Erases everything whose 30 days are up. Safe to run as often as you like (scripts/purge.ts). */
export async function purgeDue(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - ERASE_AFTER_DAYS * DAY);
  const households = await db.household.findMany({ where: { status: "DELETION_PENDING", deletionRequestedAt: { lte: cutoff } }, select: { id: true } });
  let statements = 0;
  let files = 0;
  for (const h of households) {
    try {
      statements += (await engineShredStatements(h.id)).deleted;
    } catch {
      continue; // the proof service is down: try again next run, never leave salts behind
    }
    await removeStored(["bills", h.id]);
    files++;
    await db.household.delete({ where: { id: h.id } }); // cascades to every row that belongs to it
  }
  const users = await db.user.findMany({ where: { status: "DELETION_PENDING", deletionRequestedAt: { lte: cutoff } }, select: { id: true } });
  // only once their own households are gone
  const ready = [];
  for (const u of users) {
    const pending = await db.membership.count({ where: { userId: u.id, household: { status: "DELETION_PENDING" } } });
    if (pending === 0) ready.push(u.id);
  }
  if (ready.length) await db.user.deleteMany({ where: { id: { in: ready } } });
  if (households.length || ready.length) {
    await db.erasureLog.create({ data: { users: ready.length, households: households.length, statements, files } });
  }
  return { users: ready.length, households: households.length, statements };
}
