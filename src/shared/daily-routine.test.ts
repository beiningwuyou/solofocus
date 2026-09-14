import { describe, expect, it } from "vitest";
import { emptyRoutine, routineDateSchema, routineSchema, routineSlots, shiftRoutineDate } from "./daily-routine.js";

describe("daily routine calendar and records", () => {
  it("rejects invalid dates and handles month/year boundaries", () => {
    expect(routineDateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(routineDateSchema.safeParse("../../etc").success).toBe(false);
    expect(shiftRoutineDate("2027-01-01", -1)).toBe("2026-12-31");
    expect(shiftRoutineDate("2028-03-01", -1)).toBe("2028-02-29");
  });
  it("protects weekday core blocks and gives weekends a separate routine", () => {
    expect(routineSlots("2026-09-07").find((slot) => slot.start === "08:00")?.title).toBe("秋招核心时段");
    expect(routineSlots("2026-09-07").find((slot) => slot.start === "09:45")?.title).toBe("论文核心时段");
    expect(routineSlots("2026-09-12").find((slot) => slot.start === "08:00")?.title).toContain("半天");
    expect(routineSlots("2026-09-13").some((slot) => slot.core)).toBe(false);
    for (const date of ["2026-09-07", "2026-09-12", "2026-09-13"]) {
      const slots = routineSlots(date);
      expect(slots.find((slot) => slot.start === "11:30")?.title).toBe("午饭、休息");
      expect(slots.find((slot) => slot.start === "13:00")?.end).toBe("15:00");
      expect(slots.at(-1)?.start).toBe("21:30");
    }
  });
  it("never marks default goals as completed and rejects malformed checks", () => {
    expect(Object.values(emptyRoutine().checks)).toEqual(["pending", "pending", "pending"]);
    expect(routineSchema.safeParse({ ...emptyRoutine(), checks: { job: true } }).success).toBe(false);
  });
});
