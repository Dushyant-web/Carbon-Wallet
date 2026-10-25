import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { buildCarbonId, carbonIdPrefix } from "@/lib/carbonId";

export function newPublicToken(): string {
  return randomBytes(18).toString("base64url"); // 24 chars, unguessable
}

// Crockford base32: no I, L, O or U, so a code read aloud or typed by hand can't be mistaken
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A private card code, e.g. "CW17KQ3M9XT2PRV" (shown as CW1-7KQ3-M9XT-2PRV). 60 random bits. */
export function newCardCode(): string {
  const bytes = randomBytes(12);
  return "CW1" + Array.from(bytes, (b) => B32[b % 32]).join("");
}

export function formatCardCode(code: string): string {
  const body = code.replace(/^CW1/, "");
  return `CW1-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;
}

/** Gives the household a fresh card code: every card printed with the old one stops resolving. */
export async function reissueCardCode(householdId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const updated = await db.household.update({ where: { id: householdId }, data: { cardCode: newCardCode() }, select: { cardCode: true } });
      return updated.cardCode!;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("Could not allocate a card code");
}

/**
 * Gives a household its permanent Carbon ID and public-link token if it doesn't have them yet.
 * Idempotent; retries on the (rare) unique-serial race between concurrent registrations.
 */
export async function ensureHouseholdIdentity(householdId: string) {
  const hh = await db.household.findUnique({
    where: { id: householdId },
    select: { id: true, state: true, createdAt: true, carbonId: true, publicToken: true, cardCode: true },
  });
  if (!hh) throw new Error(`Household ${householdId} not found`);
  if (hh.carbonId && hh.publicToken && hh.cardCode) return { carbonId: hh.carbonId, publicToken: hh.publicToken, cardCode: hh.cardCode };

  const year = hh.createdAt.getFullYear();
  const prefix = carbonIdPrefix(hh.state, year);

  for (let attempt = 0; attempt < 6; attempt++) {
    const taken = await db.household.count({ where: { carbonId: { startsWith: prefix } } });
    const carbonId = hh.carbonId ?? buildCarbonId(hh.state, year, taken + 1 + attempt);
    try {
      const updated = await db.household.update({
        where: { id: hh.id },
        data: { carbonId, publicToken: hh.publicToken ?? newPublicToken(), cardCode: hh.cardCode ?? newCardCode() },
        select: { carbonId: true, publicToken: true, cardCode: true },
      });
      return { carbonId: updated.carbonId!, publicToken: updated.publicToken!, cardCode: updated.cardCode! };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("Could not allocate a unique Carbon ID");
}
