import { z } from "zod";
import { uuidSchema } from "./common";

export const createTaskRewardSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    amountToman: z.number().int().positive().max(1_000_000_000_000),
    deadline: z.iso.datetime({ offset: true }),
    tasks: z
      .array(z.object({ id: uuidSchema, version: z.number().int().positive() }))
      .min(2)
      .max(100),
  })
  .refine(
    (value) => new Set(value.tasks.map((task) => task.id)).size === value.tasks.length,
    { message: "Select each task only once.", path: ["tasks"] },
  );

export const taskRewardActionSchema = z.object({
  version: z.number().int().positive(),
  action: z.enum(["approve", "cancel"]),
});

export type CreateTaskRewardInput = z.infer<typeof createTaskRewardSchema>;
