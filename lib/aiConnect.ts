// RP MotionStudio — Rafael Posada, 2026. Apache-2.0.
// Ready-to-paste setups that connect the app's MCP connector to Claude Code,
// the Claude app and Codex. The connector is the app's own binary in Node
// mode, so the paths follow wherever the app is installed.
import type { McpStatus } from './desktop';

export type Connector = McpStatus['connector'];
export const DEFAULT_CONNECTOR: Connector = {
  command: '/Applications/RP MotionStudio Desktop.app/Contents/MacOS/RP MotionStudio Desktop',
  args: ['/Applications/RP MotionStudio Desktop.app/Contents/Resources/app/desktop/mcp-stdio.cjs'],
  env: { ELECTRON_RUN_AS_NODE: '1' },
};

const shell = (value: string) => `"${value.replace(/(["\\$`])/g, '\\$1')}"`;
const toml = (value: string) => JSON.stringify(value);

export function connectSnippets(connector: Connector = DEFAULT_CONNECTOR) {
  const { command, args, env } = connector;
  return {
    claudeCode: `claude mcp add rp-motionstudio -s user ${Object.entries(env).map(([k, v]) => `-e ${k}=${v}`).join(' ')} -- ${[command, ...args].map(shell).join(' ')}`,
    claudeApp: JSON.stringify({ mcpServers: { 'rp-motionstudio': { command, args, env } } }, null, 2),
    codex: [
      '[mcp_servers.rp-motionstudio]',
      `command = ${toml(command)}`,
      `args = [${args.map(toml).join(', ')}]`,
      'startup_timeout_sec = 120',
      'tool_timeout_sec = 3600',
      '',
      '[mcp_servers.rp-motionstudio.env]',
      ...Object.entries(env).map(([k, v]) => `${k} = ${toml(v)}`),
    ].join('\n'),
  };
}

export const OPEN_CONNECT_EVENT = 'rp-connect-ai';
export const openConnectDialog = () => window.dispatchEvent(new Event(OPEN_CONNECT_EVENT));
