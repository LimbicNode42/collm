/**
 * Catch-all API proxy route
 * 
 * This route handles all /api/* requests and proxies them to the appropriate
 * backend services based on path patterns. This eliminates the need to update
 * infrastructure when adding new API endpoints.
 * 
 * Route: /api/[...proxy]
 * Matches: /api/nodes/123, /api/messages, /api/users/profile, etc.
 */

import { createProxyHandler } from '../../../lib/api-proxy';

const handler = createProxyHandler();

export async function GET(request: Request) {
  return handler(request);
}

export async function POST(request: Request) {
  return handler(request);
}

export async function PUT(request: Request) {
  return handler(request);
}

export async function DELETE(request: Request) {
  return handler(request);
}

export async function PATCH(request: Request) {
  return handler(request);
}

export async function OPTIONS(request: Request) {
  return handler(request);
}