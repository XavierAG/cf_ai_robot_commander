# 🤖 Robot Command Center

Welcome to the **Robot Command Center**, an autonomous fleet management system powered by AI. 
Create your robots, assign them specialized roles, and deploy them to tasks using natural language. Whether there's a spill in the kitchen or a logic error in the lab, simply ask the **Robot Commander** to send help, and it will dispatch the best bot for the job. 
I hope you enjoy my mini project and feel free to leave a cool robot for others to see!

## 🚀 Live Demo
Access the live fleet dashboard here:  
👉 **[https://cf-ai-robot-commander.pages.dev/](https://cf-ai-robot-commander.pages.dev/)**

---

## 🛠️ Prerequisites
* **Cloudflare Account**: [Sign up here](https://dash.cloudflare.com/sign-up) (Free tier supported).
* **Node.js**: Version 18+ installed.

## ⚙️ Setup & Deployment

### 1. Clone & Install
```bash
git clone https://github.com/XavierAG/cf_ai_robot_commander.git
cd robot-command-center
npm install
```
### 2. Deploy Backend
```bash
npx wrangler login
npx wrangler deploy
```
## 🖥️ Frontend Configuration

Before deploying the dashboard to Cloudflare Pages, you must point the frontend to **your own** Cloudflare Worker URL.

### 1. Update the Connection URLs
Open `index.html` and update the following constants at the top of the `<script>` tag:

```javascript
// Change these to your deployed Worker's domain
const WORKER_URL = "wss://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev/ws?robotId=CENTRAL_HUB";
const API_BASE = "[https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev/api](https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev/api)";
```
### 2. Update Connection URLs
Before deploying, you must point the frontend to **your own** Cloudflare Worker backend. Open `index.html` and search for the following lines to replace them with your deployed Worker URL:

* **WebSockets**: Replace `wss://robot-command-center.xavierart2001.workers.dev/ws...` with your socket URL.
* **API Calls**: Replace any `fetch` calls currently pointing to `https://robot-command-center.xavierart2001.workers.dev/api/...` with your own API base URL.

### 3. Deploy to Cloudflare Pages

---

## 🛰️ System Architecture

Our backend architecture ensures that robot states are persistent and movements are smooth.

1.  **Durable Object (`RobotMemory`)**: A stateful SQLite database that stores room coordinates, robot roles, and current positions.
2.  **Workflow (`MissionWorkflow`)**: A long-running process that manages robot travel time, calculates Euclidean distance, and emits updates every second.
3.  **Real-time Bus**: The Durable Object broadcasts every movement update to all connected WebSockets, allowing the dashboard to render across the map.

---

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
     -d '{"prompt": "Send Billy to help in the kitchen}'
```