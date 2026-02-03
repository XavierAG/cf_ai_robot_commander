import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { DurableObject, WorkflowEntrypoint, WorkflowStep } from 'cloudflare:workers';
import { RobotCommand } from "./endpoints/commander";
import { MissionStatus } from "./endpoints/missionstatus";

export interface Env {
  AI: any; 
  ROBOT_MEMORY: DurableObjectNamespace<RobotMemory>;
  MISSION_WORKFLOW: Workflow; 
}

export class RobotMemory extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

  this.ctx.storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS rooms (name TEXT PRIMARY KEY, x REAL, y REAL);
    CREATE TABLE IF NOT EXISTS robot_roles (robot_id TEXT PRIMARY KEY, role TEXT);
    -- NEW TABLE: Track live positions
    CREATE TABLE IF NOT EXISTS robot_positions (robot_id TEXT PRIMARY KEY, x REAL, y REAL);
    CREATE TABLE IF NOT EXISTS mission_logs (
      id TEXT PRIMARY KEY,
      robot_id TEXT,
      action TEXT,
      progress INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT OR IGNORE INTO rooms VALUES ('Spawner', 0, 0), ('Kitchen', 10, 5), ('Lab', -5, 12);
  `);
  }
  async deleteRoom(name: string) {
    this.ctx.storage.sql.exec("DELETE FROM rooms WHERE name = ?", name);
  }

  async deleteRole(robotId: string) {
    this.ctx.storage.sql.exec("DELETE FROM robot_roles WHERE robot_id = ?", robotId);
  }
  async addRoom(name: string, x: number, y: number) {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO rooms (name, x, y) VALUES (?, ?, ?)",
      name, x, y
    );
  }

  async setRole(robotId: string, role: string) {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO robot_roles (robot_id, role) VALUES (?, ?)",
      robotId, role
    );
  }

  async getPosition(robotId: string) {
  const res = this.ctx.storage.sql.exec("SELECT x, y FROM robot_positions WHERE robot_id = ?", robotId).toArray();
  return res.length > 0 ? res[0] : { x: 0, y: 0 };
  }

  async updatePosition(robotId: string, x: number, y: number) {
    this.ctx.storage.sql.exec("INSERT OR REPLACE INTO robot_positions (robot_id, x, y) VALUES (?, ?, ?)", robotId, x, y);
  }

  async logAction(missionId: string, robotId: string, action: string, progress: number, destination?: string, startPos?: {x: number, y: number}) {
    this.ctx.storage.sql.exec("INSERT INTO mission_logs (id, robot_id, action, progress) VALUES (?, ?, ?, ?)", `${missionId}-${Date.now()}`, robotId, action, progress);
  
    const msg = JSON.stringify({ robotId, action, progress, missionId, destination, startPos });
    this.ctx.getWebSockets().forEach(ws => ws.send(msg));
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (url.pathname === "/map") {
      const rooms = this.ctx.storage.sql.exec("SELECT * FROM rooms").toArray();
      const roles = this.ctx.storage.sql.exec("SELECT * FROM robot_roles").toArray();
      return Response.json({ rooms, roles });
    }

    if (url.pathname === "/status") {
      const logs = this.ctx.storage.sql.exec("SELECT * FROM mission_logs ORDER BY timestamp DESC LIMIT 10").toArray();
      return Response.json(logs);
    }

    return new Response("Robot Memory Online", { status: 200 });
  }
}

export class MissionWorkflow extends WorkflowEntrypoint<Env> {
  async run(event: any, step: WorkflowStep) {
    const { robotId, destination, task } = event.payload;
    const missionId = (this as any).id;
    const hubStub = this.env.ROBOT_MEMORY.get(this.env.ROBOT_MEMORY.idFromName("CENTRAL_HUB"));

    const startPos = await step.do('Get Start Position', async () => {
  const pos = await hubStub.getPosition(robotId);
  return { 
    x: Number(pos.x), 
    y: Number(pos.y) 
  };
});

    const pathMetrics = await step.do('Calculate Path', async () => {
       const res = await hubStub.fetch("http://do/map");
       const { rooms } = await res.json() as any;
       const target = rooms.find((r: any) => r.name.toLowerCase() === destination?.toLowerCase());
       
       const dist = Math.sqrt(Math.pow(target.x - startPos.x, 2) + Math.pow(target.y - startPos.y, 2));
       return { travelTime: Math.max(Math.round(dist), 2), target };
    });

    for (let i = 0; i <= pathMetrics.travelTime; i++) {
      const currentProgress = Math.round((i / pathMetrics.travelTime) * 100);
      await hubStub.logAction(missionId, robotId, `Moving to ${destination}...`, currentProgress, destination, startPos);
      if (i < pathMetrics.travelTime) await step.sleep(`Moving`, "1 second");
    }
    
    await step.do('Save Final Position', async () => {
      await hubStub.updatePosition(robotId, pathMetrics.target.x, pathMetrics.target.y);
      await hubStub.logAction(missionId, robotId, `Arrived at ${destination}`, 100, destination, startPos);
    });
  }
}
const app = new Hono<{ Bindings: Env }>();
app.use("/api/*", cors({ origin: "*" }));

const openapi = fromHono(app, { docs_url: "/" });
app.get("/ws", async (c) => {
  const robotId = c.req.query("robotId") || "CENTRAL_HUB";
  const id = c.env.ROBOT_MEMORY.idFromName(robotId);
  return c.env.ROBOT_MEMORY.get(id).fetch(c.req.raw);
});
app.post("/api/rooms", async (c) => {
    const { name, x, y } = await c.req.json();
    
    if (x < -25 || x > 25 || y < -25 || y > 25) {
        return c.json({ 
            success: false, 
            message: "Coordinates must be between -25 and 25." 
        }, 400);
    }

    const hub = c.env.ROBOT_MEMORY.get(c.env.ROBOT_MEMORY.idFromName("CENTRAL_HUB"));
    await hub.addRoom(name, x, y);
    return c.json({ success: true });
});

openapi.post("/api/roles", async (c) => {
  const { robotId, role } = await c.req.json();
  const hub = c.env.ROBOT_MEMORY.get(c.env.ROBOT_MEMORY.idFromName("CENTRAL_HUB"));
  await hub.setRole(robotId, role);
  return c.json({ success: true, message: `${robotId} assigned as ${role}.` });
});
openapi.get("/api/world", async (c) => {
  const hub = c.env.ROBOT_MEMORY.get(c.env.ROBOT_MEMORY.idFromName("CENTRAL_HUB"));
  const response = await hub.fetch(new Request("http://do/map"));
  const data = await response.json();
  return c.json(data);
});

openapi.delete("/api/rooms/:name", async (c) => {
  const name = c.req.param('name');
  const id = c.env.ROBOT_MEMORY.idFromName("CENTRAL_HUB");
  const hub = c.env.ROBOT_MEMORY.get(id);
  
  await hub.deleteRoom(name);
  
  return c.json({ success: true, message: `Room ${name} deleted.` });
});

openapi.delete("/api/roles/:robotId", async (c) => {
  const robotId = c.req.param('robotId');
  const id = c.env.ROBOT_MEMORY.idFromName("CENTRAL_HUB");
  const hub = c.env.ROBOT_MEMORY.get(id);
  
  await hub.deleteRole(robotId);
  
  return c.json({ success: true, message: `Robot ${robotId} removed.` });
});

openapi.post("/api/command", RobotCommand);
openapi.get("/api/mission/:missionId", MissionStatus);

export default app;