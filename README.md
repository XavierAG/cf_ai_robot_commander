
# Prerequisites
Cloudflare Account (Free tier works perfectly).
Node.js installed on your machine.

# Setup

## Clone the repository
git clone <https://github.com/XavierAG/cf_ai_robot_commander.git>
cd robot-command-center

## Install dependencies
npm install

## Login to Cloudflare
npx wrangler login

## 📡 API Reference

The Command Center utilizes a RESTful API built on **Hono** and **Chanfana (OpenAPI)**. All coordinates follow a strict $50 \times 50$ grid constraint ($x, y$ between $-25$ and $25$).

| Endpoint | Method | Input | Description |
| :--- | :--- | :--- | :--- |
| `/api/rooms` | **POST** | `{"name": "Kitchen", "x": 10, "y": -5}` | Registers a new location. Validates bounds. |
| `/api/rooms/:name` | **DELETE** | `name` (URL Param) | Removes a room from the SQL registry. |
| `/api/roles` | **POST** | `{"robotId": "Billy", "role": "Chef"}` | Assigns a specific role to a robot ID. |
| `/api/roles/:robotId`| **DELETE** | `robotId` (URL Param) | Removes a robot from the active roster. |
| `/api/world` | **GET** | *None* | Returns the current map and robot roles. |
| `/api/command` | **POST** | `{"prompt": "string"}` | Triggers AI parsing and starts a **Mission Workflow**. |
| `/api/mission/:id` | **GET** | `missionId` (URL Param) | Fetches historical logs for a specific mission. |
| `/ws` | **GET** | `?robotId=CENTRAL_HUB` | WebSocket entry point for real-time telemetry. |

---

## 🛰️ System Architecture

Our backend architecture ensures that robot states are persistent and movements are smooth.



1.  **Durable Object (`RobotMemory`)**: A stateful SQLite database that stores room coordinates, robot roles, and current positions.
2.  **Workflow (`MissionWorkflow`)**: A long-running process that manages robot travel time, calculates Euclidean distance, and emits "heartbeat" updates every second.
3.  **Real-time Bus**: The Durable Object broadcasts every movement update to all connected WebSockets, allowing the dashboard to render a smooth "glide" across the map.

---

## 🛠️ Testing with cURL

You can test the components directly from your terminal using these commands:

### Create a Room
```bash
curl -X POST https://<your-worker>.workers.dev/api/rooms \
     -H "Content-Type: application/json" \
     -d '{"name": "Lab", "x": -20, "y": 15}'
```
### Deploy a Robot
```bash
curl -X POST https://<your-worker>.workers.dev/api/command \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Send Billy to the Lab to analyze samples"}'
```