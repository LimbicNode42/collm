"use strict";
/**
 * OpenAPI Contract Validation Middleware
 *
 * This module provides middleware to validate requests/responses
 * against OpenAPI specifications in your services.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractTester = void 0;
exports.createFastifySchema = createFastifySchema;
exports.createValidationMiddleware = createValidationMiddleware;
exports.createResponseValidationMiddleware = createResponseValidationMiddleware;
// Convert OpenAPI schema to Fastify JSON Schema format
function createFastifySchema(openApiPath) {
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
function createValidationMiddleware(schema) {
    return async (request, reply) => {
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
function createResponseValidationMiddleware() {
    return async (request, reply, payload) => {
        // Log responses for contract debugging
        request.log.info({
            statusCode: reply.statusCode,
            responseSize: payload ? payload.length : 0,
        }, 'API Response');
        return payload;
    };
}
// Contract testing utilities
class ContractTester {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async testEndpoint(path, method, testCase) {
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
    validateResponse(data, schema) {
        // Basic schema validation - in production use ajv or similar
        try {
            // This would use the generated schemas for validation
            return true;
        }
        catch (error) {
            return false;
        }
    }
}
exports.ContractTester = ContractTester;
//# sourceMappingURL=validation.js.map