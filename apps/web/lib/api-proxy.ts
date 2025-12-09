/**
 * API Proxy Utilities
 * 
 * This module provides utilities for proxying API requests to backend services.
 * It enables flexible routing without requiring infrastructure updates.
 */

interface ServiceConfig {
  name: string;
  baseUrl: string;
  pathPatterns: string[];
}

// Service configuration - update these environment variables to change routing
const SERVICES: ServiceConfig[] = [
  {
    name: 'core-service',
    baseUrl: process.env.CORE_SERVICE_URL || 'http://core-service:3001',
    pathPatterns: ['/nodes', '/llm', '/health', '/adjudication']
  },
  {
    name: 'message-service', 
    baseUrl: process.env.MESSAGE_SERVICE_URL || 'http://message-service:3002',
    pathPatterns: ['/message', '/messages', '/queue']
  },
  {
    name: 'user-service',
    baseUrl: process.env.USER_SERVICE_URL || 'http://user-service:3003', 
    pathPatterns: ['/users', '/auth', '/register', '/login']
  }
];

/**
 * Determines which service should handle a given API path
 */
export function getServiceForPath(path: string): ServiceConfig | null {
  // Remove /api prefix for matching
  const cleanPath = path.replace(/^\/api/, '');
  
  for (const service of SERVICES) {
    for (const pattern of service.pathPatterns) {
      if (cleanPath.startsWith(pattern)) {
        return service;
      }
    }
  }
  
  return null;
}

/**
 * Proxy a request to the appropriate backend service
 */
export async function proxyToService(
  request: Request,
  path: string
): Promise<Response> {
  const service = getServiceForPath(path);
  
  if (!service) {
    return new Response(
      JSON.stringify({ error: 'Service not found for path', path }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Remove /api prefix and construct target URL
  const targetPath = path.replace(/^\/api/, '');
  const targetUrl = `${service.baseUrl}${targetPath}`;
  
  try {
    // Forward the request to the target service
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' 
        ? await request.blob()
        : null,
    });

    const response = await fetch(proxyRequest);
    
    // Forward the response back to the client
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    
  } catch (error) {
    console.error(`Error proxying to ${service.name}:`, error);
    return new Response(
      JSON.stringify({ 
        error: 'Service unavailable', 
        service: service.name,
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 502, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

/**
 * Create a Next.js API handler that proxies to backend services
 */
export function createProxyHandler() {
  return async function handler(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Add CORS headers for development
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    
    const response = await proxyToService(request, path);
    
    // Add CORS headers to the response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  };
}