import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './tools.mjs';

const scope = process.env.ILIACACHE_SCOPE || 'local';
if (!['local', 'public'].includes(scope)) throw new Error('ILIACACHE_SCOPE must be local or public.');
const server = createMcpServer({ scope, writeToken: process.env.ILIA_MCP_WRITE_TOKEN });
await server.connect(new StdioServerTransport());
