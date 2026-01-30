import { fromHono } from "chanfana";
import { Hono } from "hono";
import { TaskCreate } from "./endpoints/taskCreate";
import { TaskDelete } from "./endpoints/taskDelete";
import { TaskFetch } from "./endpoints/taskFetch";
import { TaskList } from "./endpoints/taskList";
import { DurableObject, WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
// Start a Hono app

import { RobotCommand } from "./endpoints/commander";
import { MissionStatus } from "./endpoints/missionstatus";

export class RobotMemory extends DurableObject {
  async getStatus() {
    return await this.ctx.storage.get("status") || "Standing by";
  }
  async setStatus(status: string) {
    await this.ctx.storage.put("status", status);
  }
}
export class MissionWorkflow extends WorkflowEntrypoint {
  async run(event: any, step: WorkflowStep) {
    const { robotId, missionType } = event.payload;

    await step.do('Init Mission', async () => {
      console.log(`[${robotId}] Starting ${missionType}...`);
    });

    await step.sleep('Moving to checkpoint', '1 minute');

    await step.do('Finalize', async () => {
      return { status: "Mission Accomplished" };
    });
  }
}

const app = new Hono<{ Bindings: Env }>();

const openapi = fromHono(app, {
	docs_url: "/",
});


openapi.get("/api/tasks", TaskList);
openapi.post("/api/tasks", TaskCreate);
openapi.get("/api/tasks/:taskSlug", TaskFetch);
openapi.delete("/api/tasks/:taskSlug", TaskDelete);
openapi.post("/api/command", RobotCommand);
openapi.get("/api/mission/:missionId", MissionStatus);
export default app;
