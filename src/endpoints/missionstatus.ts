import { OpenAPIRoute } from "chanfana";
import { z } from "zod";

export class MissionStatus extends OpenAPIRoute {
  schema = {
    tags: ["Commander"],
    summary: "Check the status of a specific mission",
    request: {
      params: z.object({
        missionId: z.string().openapi({ example: "fbde024c-d3f1-4f12-88be-185b13f40fa0" }),
      }),
    },
    responses: {
      "200": {
        description: "Returns the current status of the mission",
        content: {
          "application/json": {
            schema: z.object({
              status: z.string(),
              details: z.any(),
            }),
          },
        },
      },
    },
  };

  async handle(c: any) {
    const data = await this.getValidatedData<typeof this.schema>();
    const env = c.env;

    // Retrieve the specific workflow instance by ID
    try {
      const instance = await env.MISSION_WORKFLOW.get(data.params.missionId);
      const status = await instance.status();

      return {
        status: status.status, // "running", "errored", "completed", etc.
        details: status
      };
    } catch (e) {
      return Response.json({ error: "Mission ID not found." }, { status: 404 });
    }
  }
}