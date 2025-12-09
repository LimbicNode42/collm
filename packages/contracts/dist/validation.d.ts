/**
 * OpenAPI Contract Validation Middleware
 *
 * This module provides middleware to validate requests/responses
 * against OpenAPI specifications in your services.
 */
import { FastifyRequest, FastifyReply, FastifySchema } from 'fastify';
export declare function createFastifySchema(openApiPath: any): FastifySchema;
export declare function createValidationMiddleware(schema: FastifySchema): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
export declare function createResponseValidationMiddleware(): (request: FastifyRequest, reply: FastifyReply, payload: any) => Promise<any>;
export declare class ContractTester {
    private baseUrl;
    constructor(baseUrl: string);
    testEndpoint(path: string, method: string, testCase: any): Promise<{
        status: number;
        headers: {
            [k: string]: string;
        };
        body: unknown;
        matchesContract: boolean;
    }>;
    private validateResponse;
}
//# sourceMappingURL=validation.d.ts.map