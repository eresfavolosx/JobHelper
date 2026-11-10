# NovuJobs (JobHelper) Model Context Protocol (MCP) Server & ChatGPT Integration

Connect **ChatGPT**, **Claude Desktop**, **Cursor**, **Windsurf**, or any autonomous AI agent securely to your **NovuJobs** career command center.

---

## ⚡ What You Can Do with ChatGPT + NovuJobs

Once connected, you can converse with ChatGPT in natural language to manage your entire job search:

- 🗣️ *"What applications are currently in my interviewing stage?"*
- 🗣️ *"Add a new role: Senior Machine Learning Engineer at Anthropic with $240k-$280k salary in San Francisco."*
- 🗣️ *"Do I have any ghosted applications that haven't responded in over 10 days?"*
- 🗣️ *"Log that I sent a follow-up email to the recruiter at Google today."*
- 🗣️ *"Search for all roles mentioning 'Remote' or 'Distributed Systems'."*
- 🗣️ *"Give me a 30-second pipeline summary before my morning career sprint."*

---

## 🔒 Security Architecture: How It Stays 100% Safe

1. **Zero Intermediate Servers**: The MCP server runs directly on your local machine over `stdio`. Your Firebase credentials and job applications never pass through any third-party proxy.
2. **User-Scoped Isolation**: Every query and mutation is strictly locked to your personal Firebase UID (`/users/{USER_ID}/jobs/*`).
3. **Least Privilege**: Only the designated Firestore subcollections are queried. Your system files and personal documents are never accessible.

---

## 🚀 Setup Option 1: ChatGPT Desktop & Claude Desktop (Local MCP)

### Step 1: Find your Firebase User ID
1. Open your NovuJobs application ([https://jobhelper.novu.works/](https://jobhelper.novu.works/) or local).
2. Go to **Profile** (or press `Cmd+K` -> Profile).
3. Under your account info, copy your **User ID (UID)** (e.g. `abc123xyz456`).

### Step 2: Add to your Claude Desktop / ChatGPT Desktop configuration
In your client configuration file:
- **Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows).
- **ChatGPT Desktop**: Settings -> Developer / Model Context Protocol -> Add Server.

Add the following block under `"mcpServers"`:

```json
{
  "mcpServers": {
    "novujobs": {
      "command": "node",
      "args": [
        "/Users/fabianvelez/.gemini/antigravity/scratch/job-tracker/mcp/server.js"
      ],
      "env": {
        "NOVUJOBS_USER_ID": "YOUR_FIREBASE_USER_ID_HERE",
        "FIREBASE_PROJECT_ID": "jobhelper-c3cd7"
      }
    }
  }
}
```

*(Optional: If using a Firebase Service Account key file for headless admin access, add `"GOOGLE_APPLICATION_CREDENTIALS": "/path/to/serviceAccountKey.json"` to `"env"`).*

Restart Claude Desktop or ChatGPT Desktop. You will immediately see the NovuJobs tools active!

---

## 🌐 Setup Option 2: ChatGPT on the Web (Custom GPT Action)

If you use ChatGPT on web ([chatgpt.com](https://chatgpt.com)), iOS, or Android:

1. Open ChatGPT -> Click **Explore GPTs** -> **Create**.
2. Name your GPT **"NovuJobs Career Copilot"**.
3. In instructions, add:
   > *"You are the AI Career Copilot for NovuJobs. Use the available actions to fetch the user's pipeline summary, list applications, search jobs, track new roles, and log follow-ups."*
4. Under **Actions**, click **Create new action**.
5. Copy and paste the contents of [`chatgpt-actions-openapi.json`](./chatgpt-actions-openapi.json) into the Schema editor.
6. Under Authentication, select **API Key** -> **Bearer Token** and enter your personal token.
7. Click **Save** (Only me).

You can now use your custom GPT on any device!

---

## 🛠️ Available MCP Tools

| Tool Name | Purpose | Parameters |
| :--- | :--- | :--- |
| `novujobs_get_pipeline_summary` | Executive breakdown of pipeline, total roles, and alert counts | None |
| `novujobs_list_jobs` | List applications with stage filtering | `status` (optional), `limit` (optional) |
| `novujobs_search_jobs` | Keyword search across title, company, notes, location | `query` (required) |
| `novujobs_get_job` | Detailed view of a single application | `jobId` (required) |
| `novujobs_add_job` | Log a new application to the board | `company`, `role`, `status`, `salary`, `location`, `notes` |
| `novujobs_update_job` | Change stage status or edit job fields | `jobId` (required), `status`, `notes`, etc. |
| `novujobs_log_follow_up` | Record outreach to recruiter & reset ghost alert | `jobId` (required), `channel`, `note` |

---

## 🧪 Testing the MCP Server

You can test the MCP server locally at any time:

```bash
cd mcp
node test-mcp.mjs
```

All JSON-RPC 2.0 handshake and ping-pong tests will run and report health status.
