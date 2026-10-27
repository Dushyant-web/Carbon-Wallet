import { NextRequest, NextResponse } from "next/server";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { rateLimit } from "@/server/auth/rateLimit";
import { EngineError } from "@/server/engine";
import { FuelError, fuelService } from "@/server/services/fuel.service";

export const runtime = "nodejs";

/** Multipart `photo` (+ optional allowAi=1): returns what was read. Nothing is saved until confirmed. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: householdId } = await params;
    const auth = await requireMembership(req, householdId, "activity:create");
    if (!(await rateLimit(`fuel-read:${auth.userId}`, 20, 10 * 60_000)).ok) {
      return NextResponse.json({ error: "Too many photos. Try again in a few minutes." }, { status: 429 });
    }
    const form = await req.formData().catch(() => null);
    const file = form?.get("photo");
    if (!file || typeof file === "string") return NextResponse.json({ error: "Attach the photo as `photo`." }, { status: 400 });
    try {
      const reading = await fuelService.read(Buffer.from(await file.arrayBuffer()), form?.get("allowAi") === "1");
      return NextResponse.json({ reading });
    } catch (err) {
      if (err instanceof FuelError || err instanceof EngineError) return NextResponse.json({ error: err.message }, { status: err.status });
      throw err;
    }
  } catch (err) {
    return handleAuthError(err);
  }
}
