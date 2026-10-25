import { NextRequest, NextResponse } from "next/server";
import { requireMembership, handleAuthError } from "@/server/auth/guard";
import { emissionService } from "@/server/services/emission.service";
import { activityRepository } from "@/server/repositories/activity.repository";
import { CreateActivitySchema } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: householdId } = await params;
    await requireMembership(req, householdId, "data:read");

    const searchParams = req.nextUrl.searchParams;
    const category = searchParams.get("category") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "20", 10));
    const offset = searchParams.has("offset")
      ? parseInt(searchParams.get("offset") || "0", 10)
      : (page - 1) * limit;

    const [activities, total] = await Promise.all([
      activityRepository.listActivities(householdId, {
        category,
        limit,
        offset,
      }),
      activityRepository.countActivities(householdId, { category }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      activities,
      count: activities.length,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: householdId } = await params;
    // Guard: Requires activity:create capability (Viewer is blocked with 403!)
    const auth = await requireMembership(req, householdId, "activity:create");

    const body = await req.json();
    const validated = CreateActivitySchema.parse({
      ...body,
      memberId: body.memberId || auth.userId,
    });

    // ?preview=1: what this would add, with the real factor, without recording anything
    if (req.nextUrl.searchParams.get("preview") === "1") {
      return NextResponse.json(await emissionService.preview(householdId, validated));
    }

    const result = await emissionService.calculateAndRecord(householdId, validated);

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "name" in err && err.name === "ZodError") {
      return NextResponse.json({ error: "Validation Error", details: err }, { status: 400 });
    }
    return handleAuthError(err);
  }
}
