#!/usr/bin/env node
/**
 * AgentGate — MCP Tool Approval Gateway
 * https://github.com/RLASAF12/agent-gate
 *
 * Adds human-in-the-loop approval to any agent tool call.
 * Framework-agnostic: works with Claude Desktop, Cursor, Windsurf, and any
 * MCP client. Zero changes to your existing agent prompts or tool wiring.
 *
 * Usage in claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "agent-gate": {
 *         "command": "node",
 *         "args": ["/path/to/agent-gate/server.js"],
 *         "env": {
 *           "AGENTGATE_SUPABASE_URL": "https://yourproject.supabase.co",
 *           "AGENTGATE_SUPABASE_KEY": "your-anon-key",
 *           "AGENTGATE_DASHBOARD_URL": "https://rlasaf12.github.io/agent-gate/"
 *         }
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL =
  process.env.AGENTGATE_SUPABASE_URL ||
  'https://beseparjuerxjygszlta.supabase.co';

const SUPABASE_KEY =
  process.env.AGENTGATE_SUPABASE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJlc2VwYXJqdWVyeGp5Z3N6bHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzODY2OTYsImV4cCI6MjA5Njk2MjY5Nn0.olesTppkswAP5360f2A5Qn9w5pRHTPt0POGfqKtfI3Y';

const DASHBOARD_URL =
  process.env.AGENTGATE_DASHBOARD_URL ||
  'https://rlasaf12.github.io/agent-gate/';

/** How long (ms) before a pending request is auto-expired. Default: 10 min. */
const TIMEOUT_MS = Number(process.env.AGENTGATE_TIMEOUT_MS) || 10 * 60 * 1000;

// ─── Supabase helper ─────────────────────────────────────────────────────────

async function sb(path, method = 'GET', body = null) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  const opts = { method, headers };
  if (body !== null) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return JSON.parse(text);
}

// ─── Server ──────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'agent-gate', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'gate_request',
      description:
        'Submit a tool action for human approval BEFORE executing it. ' +
        'Returns a request_id. Poll gate_check() until status is approved or rejected. ' +
        'Do NOT execute the action until gate_check returns "approved".',
      inputSchema: {
        type: 'object',
        properties: {
          tool_name: {
            type: 'string',
            description:
              'Name of the tool or action being gated (e.g. "delete_rows", "send_bulk_email")',
          },
          action_description: {
            type: 'string',
            description:
              'Plain-English description of exactly what will happen if approved',
          },
          context: {
            type: 'object',
            description:
              'Supporting details: affected row counts, recipient lists, amounts, etc.',
            default: {},
          },
          risk_level: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
            description: 'Self-assessed risk level of this action',
          },
        },
        required: ['tool_name', 'action_description'],
      },
    },
    {
      name: 'gate_check',
      description:
        'Check approval status of a gate_request. ' +
        'Poll every 10–30 seconds. Status: pending | approved | rejected | expired. ' +
        'Only execute the action when status is "approved".',
      inputSchema: {
        type: 'object',
        properties: {
          request_id: {
            type: 'string',
            description: 'UUID returned by gate_request',
          },
        },
        required: ['request_id'],
      },
    },
    {
      name: 'gate_list',
      description:
        'List all currently pending approval requests. ' +
        'Useful for status checks and debugging.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // ── gate_request ──────────────────────────────────────────────────────────
  if (name === 'gate_request') {
    const {
      tool_name,
      action_description,
      context = {},
      risk_level = 'medium',
    } = args;

    const rows = await sb('gate_requests', 'POST', {
      tool_name,
      action_description,
      context,
      risk_level,
      status: 'pending',
    });

    const row = Array.isArray(rows) ? rows[0] : rows;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              request_id: row.id,
              status: 'pending',
              risk_level: row.risk_level,
              message:
                `Approval request submitted. ` +
                `Visit the dashboard to approve or reject: ${DASHBOARD_URL}\n` +
                `Poll gate_check("${row.id}") every 15 seconds until status changes.`,
              dashboard_url: DASHBOARD_URL,
              next_step: `Call gate_check with request_id: "${row.id}"`,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // ── gate_check ────────────────────────────────────────────────────────────
  if (name === 'gate_check') {
    const { request_id } = args;

    const rows = await sb(
      `gate_requests?id=eq.${encodeURIComponent(request_id)}&select=*`
    );

    if (!rows || rows.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Request not found',
              request_id,
            }),
          },
        ],
      };
    }

    let row = rows[0];

    // Auto-expire stale pending requests
    if (row.status === 'pending') {
      const ageMs = Date.now() - new Date(row.requested_at).getTime();
      if (ageMs > TIMEOUT_MS) {
        await sb(`gate_requests?id=eq.${encodeURIComponent(request_id)}`, 'PATCH', {
          status: 'expired',
          decided_at: new Date().toISOString(),
          decision_note: `Auto-expired after ${Math.round(TIMEOUT_MS / 60000)} minutes`,
        });
        row.status = 'expired';
      }
    }

    const instructions = {
      pending: `Still awaiting human decision. Visit ${DASHBOARD_URL}`,
      approved: 'APPROVED ✓ — you may now execute the action.',
      rejected: 'REJECTED ✗ — do NOT execute this action. Abort the workflow.',
      expired: 'EXPIRED — request timed out. Submit a new gate_request if still needed.',
      cancelled: 'CANCELLED — request was cancelled. Do not proceed.',
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              request_id: row.id,
              status: row.status,
              tool_name: row.tool_name,
              action_description: row.action_description,
              risk_level: row.risk_level,
              requested_at: row.requested_at,
              decided_at: row.decided_at ?? null,
              decision_note: row.decision_note ?? null,
              instruction: instructions[row.status] ?? 'Unknown status',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // ── gate_list ─────────────────────────────────────────────────────────────
  if (name === 'gate_list') {
    const rows = await sb(
      'gate_requests?status=eq.pending&order=requested_at.desc&select=*'
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              pending_count: rows?.length ?? 0,
              requests: (rows || []).map((r) => ({
                request_id: r.id,
                tool_name: r.tool_name,
                action_description: r.action_description,
                risk_level: r.risk_level,
                waiting_since: r.requested_at,
              })),
              dashboard_url: DASHBOARD_URL,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// ─── Boot ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[agent-gate] MCP server running on stdio — dashboard: ${DASHBOARD_URL}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[agent-gate] Fatal: ${err.message}\n`);
  process.exit(1);
});
