/**
 * OpenAPI Contract Types
 * Generated TypeScript types from OpenAPI specifications
 */
import type { components as CoreComponents, paths as CorePaths, operations as CoreOperations } from './generated/core-service';
import type { components as MessageComponents, paths as MessagePaths, operations as MessageOperations } from './generated/message-service';
import type { components as UserComponents, paths as UserPaths, operations as UserOperations } from './generated/user-service';
export declare namespace CoreService {
    type Components = CoreComponents;
    type Paths = CorePaths;
    type Operations = CoreOperations;
    type CreateNodeRequest = CoreComponents['schemas']['CreateNodeRequest'];
    type NodeResponse = CoreComponents['schemas']['NodeResponse'];
    type NodeMemory = CoreComponents['schemas']['NodeMemory'];
    type LLMChatRequest = CoreComponents['schemas']['LLMChatRequest'];
    type LLMChatResponse = CoreComponents['schemas']['LLMChatResponse'];
}
export declare namespace MessageService {
    type Components = MessageComponents;
    type Paths = MessagePaths;
    type Operations = MessageOperations;
    type SendMessageRequest = MessageComponents['schemas']['SendMessageRequest'];
    type SendMessageResponse = MessageComponents['schemas']['SendMessageResponse'];
    type GetMessageResponse = MessageComponents['schemas']['GetMessageResponse'];
    type QueueMessage = MessageComponents['schemas']['QueueMessage'];
}
export declare namespace UserService {
    type Components = UserComponents;
    type Paths = UserPaths;
    type Operations = UserOperations;
    type RegisterRequest = UserComponents['schemas']['RegisterRequest'];
    type LoginRequest = UserComponents['schemas']['LoginRequest'];
    type AuthResponse = UserComponents['schemas']['AuthResponse'];
    type UserResponse = UserComponents['schemas']['UserResponse'];
}
export type ErrorResponse = CoreComponents['schemas']['ErrorResponse'];
export * from './validation';
//# sourceMappingURL=index.d.ts.map