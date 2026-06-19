# AgentGate 🔐

**MCP Tool Approval Gateway — pause any agent tool call for human review**

> Add human-in-the-loop approval to any AI agent in 5 minutes. No code changes to your existing agent.

---

## What It Does

AgentGate is an MCP server that sits between your AI agent and its tool calls. When the agent wants to perform a risky action — delete rows, send bulk emails, push to main — it calls `gate_request` first. The action is paused. You approve or reject from a live dashboard. The agent only proceeds when you say so.

**Before AgentGate:** Agent deletes 12,847 database rows → you find out later.  
**After AgentGate:** Agent pauses → dashboard shows you exactly what it wants to do → you approve or block it.

---

## The Problem

MCP agents now have tools that can:
- Delete thousands of database rows
- Send emails to tens of thousands of recipients
- Force-push to production branches
- Execute arbitrary shell commands

Most frameworks give you logging. None give you a **pause button**.

AgentGate is the pause button.

---

## Quick Start

### 1. Install

```bash
git clone https://github.com/RLASAF12/agent-gate.git
cd agent-gate
npm install
```

### 2. Add to Claude Desktop

In `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-gate": {
      "command": "node",
      "args": ["/path/to/agent-gate/server.js"],
      "env": {
        "AGENTGATE_SUPABASE_URL": "https://yourproject.supabase.co",
        "AGENTGATE_SUPABASE_KEY": "your-anon-key",
        "AGENTGATE_DASHBOARD_URL": "https://yourname.github.io/agent-gate/"
      }
    }
  }
}
```

Restart Claude Desktop. The three `gate_*` tools are now available.

### 3. Open the Dashboard

```
https://rlasaf12.github.io/agent-gate/
```

The dashboard connects to Supabase, polls every 5 seconds, and shows pending approval requests with Approve / Reject buttons.

### 4. Tell Your Agent When to Gate

Add instructions to your agent's system prompt:

```
Before executing any destructive or irreversible action (deleting data,
sending bulk messages, pushing to production), call gate_request() first.
Wait for approval via gate_check() before proceeding.
```

That's it. No code changes to your existing agent setup.

---

## How It Works

```
Agent wants to delete rows
        │
        ▼
  gate_request("delete_rows", "Delete 12,847 expired sessions", risk_level="critical")
        │
        ▼
  Returns request_id — action is now PAUSED
        │
        ▼
  Dashboard shows the request with full context
        │
        ▼
  You click Approve or Reject
        │
        ▼
  gate_check(request_id) → "APPROVED — you may now execute"
        │
        ▼
  Agent proceeds (or aborts on Reject)
```

---

## Tools

### `gate_request`

Submit an action for approval before executing it.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tool_name` | string | ✓ | Name of the tool being gated |
| `action_description` | string | ✓ | Plain-English description of what will happen |
| `context` | object | — | Supporting details (row counts, recipient lists, etc.) |
| `risk_level` | string | — | `low` / `medium` / `high` / `critical` (default: `medium`) |

Returns: `request_id`, `status: "pending"`, dashboard URL, next step.

### `gate_check`

Poll for approval status. Call every 10–30 seconds.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `request_id` | string | ✓ | UUID from gate_request |

Returns: `pending` → `approved` / `rejected` / `expired`

Auto-expires pending requests after 10 minutes (configurable via `AGENTGATE_TIMEOUT_MS`).

### `gate_list`

List all currently pending requests. Useful for debugging.

---

## Dashboard

![AgentGate Dashboard](https://rlasaf12.github.io/agent-gate/)

- **Live feed** — auto-polls every 5 seconds
- **Risk badges** — critical / high / medium / low with color coding
- **Context display** — shows row counts, recipient counts, whatever you pass
- **One-click approve/reject** — with optional rejection reason
- **History table** — full decision log
- **Stats bar** — pending count, approval rate

Fully self-contained HTML, no build step, works on GitHub Pages.

---

## Project Structure

```
agent-gate/
├── server.js          # MCP stdio server — the core
├── package.json       # Dependencies (@modelcontextprotocol/sdk)
├── dashboard/
│   └── index.html     # Self-contained approval dashboard
└── README.md
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENTGATE_SUPABASE_URL` | built-in demo | Your Supabase project URL |
| `AGENTGATE_SUPABASE_KEY` | built-in demo | Supabase anon key (safe for client-side) |
| `AGENTGATE_DASHBOARD_URL` | GitHub Pages | URL shown to agents |
| `AGENTGATE_TIMEOUT_MS` | `600000` (10 min) | Auto-expire timeout in milliseconds |

The built-in demo credentials connect to a live Supabase instance pre-seeded with example approval requests so you can try the dashboard immediately.

---

## Bring Your Own Supabase

1. Create a Supabase project
2. Run this migration:

```sql
create table gate_requests (
  id uuid primary key default gen_random_uuid(),
  tool_name text not null,
  action_description text not null,
  context jsonb default '{}',
  risk_level text not null default 'medium'
    check (risk_level in ('low','medium','high','critical')),
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','expired','cancelled')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decision_note text,
  agent_id text
);

alter table gate_requests enable row level security;
create policy "public_all" on gate_requests for all using (true) with check (true);
```

3. Set `AGENTGATE_SUPABASE_URL` and `AGENTGATE_SUPABASE_KEY` in your MCP config

---

## vs. agentguard

[hidearmoon/agentguard](https://github.com/hidearmoon/agentguard) is a Python library that requires code integration and framework-specific wrappers. AgentGate is framework-agnostic: it works via MCP with Claude Desktop, Cursor, Windsurf, and any MCP client. Zero changes to your existing agent code.

---

## License

MIT — built by [RLASAF12](https://github.com/RLASAF12)
