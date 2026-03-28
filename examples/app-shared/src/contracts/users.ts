import { buildRestContract } from "@lokalise/api-contracts";
import { z } from "zod/v4";

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(["admin", "user"]),
});

export type User = z.infer<typeof userSchema>;

export const listUsersContract = buildRestContract({
  method: "get",
  pathResolver: () => "/api/users",
  successResponseBodySchema: z.array(userSchema),
});

export const getUserContract = buildRestContract({
  method: "get",
  pathResolver: (params) => `/api/users/${params.userId}`,
  requestPathParamsSchema: z.object({ userId: z.string() }),
  successResponseBodySchema: userSchema,
});
