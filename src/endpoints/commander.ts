import { OpenAPIRoute } from "chanfana";
import { z } from "zod";

export class RobotCommand extends OpenAPIRoute {
  schema = {
    tags: ["Commander"],
    summary: "Send a command to the Robot Command Center",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              prompt: z.string().openapi({ example: "Send Billy to the kitchen" }),
            }),
          },
        },
      },
    },
    responses: {
      "200": { description: "Success", content: { "application/json": { schema: z.object({ message: z.string(), missionId: z.string().optional() }) } } },
    },
  };

  async handle(c: any) {
    const data = await this.getValidatedData<typeof this.schema>();
    const env = c.env;

    const jsonSchema = {
      type: "object",
      properties: {
        intent: { type: "string", enum: ["MISSION", "CHAT"] },
        robot: { type: "string" },
        task: { type: "string" }
      },
      required: ["intent", "robot", "task"]
    };

    const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: 'You are a Robot Command AI. Output ONLY valid JSON. No conversational text.' },
        { role: 'user', content: data.body.prompt }
      ],
      response_format: { type: "json_schema", json_schema: jsonSchema }
    });

    let decision;
    try {
      decision = typeof aiResponse.response === 'string' 
        ? JSON.parse(aiResponse.response) 
        : aiResponse.response;
    } catch (e) {
      console.error("Inference Error:", aiResponse.response);
      return Response.json({ error: "Garbled orders received from Commander." }, { status: 500 });
    }

    if (decision.intent === "MISSION") {
      const mission = await env.MISSION_WORKFLOW.create({
        params: { robotId: decision.robot || "Alpha-1", task: decision.task }
      });
      return { 
        message: `Mission sequence initiated: ${decision.task} for ${decision.robot}`, 
        missionId: mission.id 
      };
    }

    return { message: decision.task || "Acknowledged." };
  }
}