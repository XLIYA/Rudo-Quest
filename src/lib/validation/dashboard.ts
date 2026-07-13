import { z } from "zod";
import { dateSchema } from "@/lib/validation/common";

const maximumDashboardRangeInDays = 31;

export const dashboardQuerySchema = z
  .object({ from: dateSchema, to: dateSchema })
  .superRefine((value, context) => {
    if (value.to < value.from) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "The end date must not precede the start date.",
      });
      return;
    }
    const from = Date.parse(`${value.from}T00:00:00.000Z`);
    const to = Date.parse(`${value.to}T00:00:00.000Z`);
    if ((to - from) / 86_400_000 > maximumDashboardRangeInDays) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "Dashboard ranges cannot exceed 32 calendar days.",
      });
    }
  });
