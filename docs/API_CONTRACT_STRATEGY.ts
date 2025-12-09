/**
 * API Contract Management Strategy
 * 
 * This document outlines approaches for maintaining API contracts
 * across microservices in the Collm architecture.
 */

// 1. OpenAPI Specifications per Service
// Each service defines its contract in OpenAPI format

// Example: apps/message-service/openapi.yaml
export const messageServiceSpec = {
  openapi: "3.0.0",
  info: {
    title: "Message Service API",
    version: "1.0.0"
  },
  paths: {
    "/message": {
      post: {
        summary: "Send a message for adjudication",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["userId", "nodeId", "content", "targetNodeVersion"],
                properties: {
                  userId: { type: "string" },
                  nodeId: { type: "string" }, 
                  content: { type: "string" },
                  targetNodeVersion: { type: "integer" }
                }
              }
            }
          }
        },
        responses: {
          "202": {
            description: "Message queued for adjudication",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: { type: "string" },
                    data: {
                      type: "object",
                      properties: {
                        messageId: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/message/{id}": {
      get: {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Message details",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    message: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        content: { type: "string" },
                        userId: { type: "string" },
                        nodeId: { type: "string" },
                        status: { type: "string" },
                        createdAt: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

// 2. TypeScript Interface Generation
// Generate TypeScript types from OpenAPI specs

export interface MessageRequest {
  userId: string;
  nodeId: string;
  content: string;
  targetNodeVersion: number;
}

export interface MessageResponse {
  success: boolean;
  message: string;
  data: {
    messageId: string;
  };
}

// 3. Runtime Validation with Zod
import { z } from 'zod';

export const MessageRequestSchema = z.object({
  userId: z.string(),
  nodeId: z.string(),
  content: z.string(),
  targetNodeVersion: z.number().int().min(0),
});

export const MessageResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    messageId: z.string(),
  }),
});

// 4. Contract Testing
export const contractTests = {
  messageService: {
    'POST /message': {
      validRequest: {
        userId: 'test-user-123',
        nodeId: 'node-456', 
        content: 'Test message',
        targetNodeVersion: 0
      },
      expectedResponse: {
        success: true,
        message: 'Message queued for adjudication',
        data: { messageId: expect.any(String) }
      }
    }
  }
};