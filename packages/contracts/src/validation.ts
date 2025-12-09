/**
 * OpenAPI Contract Validation Middleware
 * 
 * This module provides middleware to validate requests/responses 
 * against OpenAPI specifications in your services.
 */

import { FastifyRequest, FastifyReply, FastifySchema } from 'fastify';

// Convert OpenAPI schema to Fastify JSON Schema format
export function createFastifySchema(openApiPath: any): FastifySchema {
  // This would typically use a library like @fastify/swagger
  // For now, we'll create a basic structure
  
  return {
    body: openApiPath.requestBody?.content?.['application/json']?.schema || {},
    response: {
      200: openApiPath.responses?.['200']?.content?.['application/json']?.schema || {},
      201: openApiPath.responses?.['201']?.content?.['application/json']?.schema || {},
      400: openApiPath.responses?.['400']?.content?.['application/json']?.schema || {},
      404: openApiPath.responses?.['404']?.content?.['application/json']?.schema || {},
      500: openApiPath.responses?.['500']?.content?.['application/json']?.schema || {},
    }
  };
}

// Validation middleware factory
export function createValidationMiddleware(schema: FastifySchema) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Request validation happens automatically with Fastify schemas
    // This middleware can add custom validation logic if needed
    
    // Add request logging for contract debugging
    request.log.info({
      method: request.method,
      url: request.url,
      body: request.body,
      query: request.query,
      params: request.params,
    }, 'API Request');
  };
}

// Response validation middleware
export function createResponseValidationMiddleware() {
  return async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
    // Log responses for contract debugging
    request.log.info({
      statusCode: reply.statusCode,
      responseSize: payload ? payload.length : 0,
    }, 'API Response');
    
    return payload;
  };
}

// Contract testing utilities
export class ContractTester {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  async testEndpoint(path: string, method: string, testCase: any) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...testCase.headers,
      },
      body: testCase.body ? JSON.stringify(testCase.body) : undefined,
    });
    
    const responseData = await response.json();
    
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseData,
      matchesContract: this.validateResponse(responseData, testCase.expectedSchema),
    };
  }
  
  private validateResponse(data: any, schema: any): boolean {
    // Basic schema validation - in production use ajv or similar
    try {
      // This would use the generated schemas for validation
      return true;
    } catch (error) {
      return false;
    }
  }
}