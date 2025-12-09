/**
 * OpenAPI Contract Types
 * Generated TypeScript types from OpenAPI specifications
 */

// Import types with namespaces to avoid conflicts
import type { 
  components as CoreComponents,
  paths as CorePaths,
  operations as CoreOperations
} from './generated/core-service';

import type { 
  components as MessageComponents,
  paths as MessagePaths,
  operations as MessageOperations
} from './generated/message-service';

import type { 
  components as UserComponents,
  paths as UserPaths,
  operations as UserOperations
} from './generated/user-service';

// Export service-specific namespaces
export namespace CoreService {
  export type Components = CoreComponents;
  export type Paths = CorePaths;
  export type Operations = CoreOperations;
  
  // Common request/response types
  export type CreateNodeRequest = CoreComponents['schemas']['CreateNodeRequest'];
  export type NodeResponse = CoreComponents['schemas']['NodeResponse'];
  export type NodeMemory = CoreComponents['schemas']['NodeMemory'];
  export type LLMChatRequest = CoreComponents['schemas']['LLMChatRequest'];
  export type LLMChatResponse = CoreComponents['schemas']['LLMChatResponse'];
}

export namespace MessageService {
  export type Components = MessageComponents;
  export type Paths = MessagePaths;
  export type Operations = MessageOperations;
  
  // Common request/response types
  export type SendMessageRequest = MessageComponents['schemas']['SendMessageRequest'];
  export type SendMessageResponse = MessageComponents['schemas']['SendMessageResponse'];
  export type GetMessageResponse = MessageComponents['schemas']['GetMessageResponse'];
  export type QueueMessage = MessageComponents['schemas']['QueueMessage'];
}

export namespace UserService {
  export type Components = UserComponents;
  export type Paths = UserPaths;
  export type Operations = UserOperations;
  
  // Common request/response types
  export type RegisterRequest = UserComponents['schemas']['RegisterRequest'];
  export type LoginRequest = UserComponents['schemas']['LoginRequest'];
  export type AuthResponse = UserComponents['schemas']['AuthResponse'];
  export type UserResponse = UserComponents['schemas']['UserResponse'];
}

// Common error type used across all services
export type ErrorResponse = CoreComponents['schemas']['ErrorResponse'];

// Re-export validation utilities
export * from './validation';