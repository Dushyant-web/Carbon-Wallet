import { db } from "@/server/db";
import { emissionService } from "./emission.service";
import { engineExtractFuel } from "@/server/engine";

/**
 * Fuel fill-ups: litres (kg for CNG) burned × the fuel's factor = CO2, exactly; no mileage guess involved.
 * For the same car and month, km-based trip estimates stop counting (the fill-up is the better number).
 */

export class FuelError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const FUEL_TYPE: Record<string, { type: string; unit: string; tripType: string }> = {
  Petrol: { type: "petrol_fuel", unit: "L", tripType: "petrol_car" },
  Hybrid: { type: "petrol_fuel", unit: "L", tripType: "petrol_car" },
  Diesel: { type: "diesel_fuel", unit: "L", tripType: "diesel_car" },
  CNG: { type: "cng_fuel", unit: "kg", tripType: "cng_car" },
};

const DAY = 86_400_000;
const monthOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

function sniffImage(bytes: Buffer): boolean {
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return true;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return true;
  if (bytes.subarray(1, 4).toString("latin1") === "PNG") return true;
  return ["ftypheic", "ftypheix", "ftypmif1"].includes(bytes.subarray(4, 12).toString("latin1"));
}

export const fuelService = {
  async read(bytes: Buffer, allowAi: boolean) {
    if (bytes.length === 0) throw new FuelError("The photo is empty.");
    if (bytes.length > 10 * 1024 * 1024) throw new FuelError("Photos must be under 10 MB.", 413);
    if (!sniffImage(bytes)) throw new FuelError("Upload a JPG, PNG or HEIC photo (or a PDF receipt).", 415);
    return engineExtractFuel(bytes, allowAi); // the photo itself is not stored
  },

  async confirm(opts: {
    householdId: string;
    userId: string;
    vehicleId: string;
    quantity: number;
    amountInr?: number | null;
    pricePerUnit?: number | null;
    filledOn: string;
    source: "PHOTO" | "MANUAL";
  }) {
    const vehicle = await db.vehicle.findFirst({ where: { id: opts.vehicleId, householdId: opts.householdId } });
    if (!vehicle) throw new FuelError("Vehicle not found", 404);
    const ft = FUEL_TYPE[vehicle.fuel];
    if (!ft) throw new FuelError(`A ${vehicle.fuel.toLowerCase()} vehicle doesn't take fuel. Log charging as electricity.`);
    if (!(opts.quantity > 0 && opts.quantity <= 200)) throw new FuelError("Quantity should be between 0 and 200.");
    const filledOn = new Date(`${opts.filledOn.slice(0, 10)}T12:00:00.000Z`);
    if (Number.isNaN(filledOn.getTime()) || filledOn.getTime() > Date.now() + DAY) throw new FuelError("Check the date.");

    const res = await emissionService.calculateAndRecord(opts.householdId, {
      category: "Transport",
      type: ft.type,
      quantity: opts.quantity,
      unit: ft.unit,
      occurredOn: filledOn,
      source: opts.source === "PHOTO" ? "FUEL_PHOTO" : "MANUAL",
      notes: `Fuel: ${opts.quantity} ${ft.unit} for ${vehicle.name ?? vehicle.type}`,
    });
    const log = await db.fuelLog.create({
      data: {
        householdId: opts.householdId,
        vehicleId: vehicle.id,
        fuel: vehicle.fuel,
        quantity: opts.quantity,
        amountInr: opts.amountInr ?? null,
        pricePerUnit: opts.pricePerUnit ?? null,
        filledOn,
        kgCo2e: res.emissionEvent.kgCo2e,
        estimatedKm: vehicle.kmPerUnit > 0 ? Math.round(opts.quantity * vehicle.kmPerUnit) : null,
        source: opts.source,
        activityId: res.activity.id,
        createdById: opts.userId,
      },
    });

    // Km-trip estimates for this car in this month are now replaced, but only when we know which car they were
    const sameFuel = await db.vehicle.count({ where: { householdId: opts.householdId, fuel: vehicle.fuel } });
    const month = monthOf(filledOn);
    let covered = 0;
    if (sameFuel === 1) {
      const [y, m] = month.split("-").map(Number);
      const out = await db.activity.updateMany({
        where: {
          householdId: opts.householdId,
          category: "Transport",
          type: ft.tripType,
          coveredByFuelLogId: null,
          occurredOn: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) },
        },
        data: { coveredByFuelLogId: log.id },
      });
      covered = out.count;
    }
    await emissionService.recalculateMonthSummary(opts.householdId, month);
    await db.auditLog.create({
      data: { householdId: opts.householdId, userId: opts.userId, action: "fuel.add", entity: "FuelLog", details: `${opts.quantity} ${ft.unit} ${vehicle.fuel}` },
    });
    return { log, coveredTrips: covered };
  },

  async list(householdId: string) {
    const logs = await db.fuelLog.findMany({
      where: { householdId },
      orderBy: { filledOn: "desc" },
      take: 50,
      include: { vehicle: { select: { name: true, type: true } } },
    });
    return logs.map((l) => ({
      id: l.id,
      vehicle: l.vehicle.name ?? l.vehicle.type,
      fuel: l.fuel,
      quantity: l.quantity,
      unit: l.fuel === "CNG" ? "kg" : "L",
      amountInr: l.amountInr,
      pricePerUnit: l.pricePerUnit,
      filledOn: l.filledOn.toISOString().slice(0, 10),
      kgCo2e: l.kgCo2e,
      estimatedKm: l.estimatedKm,
      source: l.source,
    }));
  },

  async remove(householdId: string, id: string, userId: string) {
    const log = await db.fuelLog.findFirst({ where: { id, householdId } });
    if (!log) throw new FuelError("Not found", 404);
    await db.fuelLog.delete({ where: { id: log.id } }); // covered trips are released (SET NULL)
    if (log.activityId) await db.activity.delete({ where: { id: log.activityId } }).catch(() => null);
    await emissionService.recalculateMonthSummary(householdId, monthOf(log.filledOn));
    await db.auditLog.create({ data: { householdId, userId, action: "fuel.delete", entity: "FuelLog", details: `${log.quantity} ${log.fuel}` } });
  },
};
