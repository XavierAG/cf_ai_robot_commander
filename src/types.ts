import { DateTime, Str } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";
import { DurableObjectNamespace, Workflow } from "@cloudflare/workers-types";

export type AppContext = Context<{ Bindings: Env }>;

export const Task = z.object({
	name: Str({ example: "lorem" }),
	slug: Str(),
	description: Str({ required: false }),
	completed: z.boolean().default(false),
	due_date: DateTime(),
});

export interface Env {
  AI: any;
  ROBOT_MEMORY: DurableObjectNamespace;
  MISSION_WORKFLOW: Workflow;
}
