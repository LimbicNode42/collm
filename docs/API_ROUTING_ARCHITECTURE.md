# Flexible API Routing Architecture

This document explains how we've implemented a flexible API routing system that eliminates the need to update infrastructure when adding new API endpoints.

## Problem Statement

Previously, every new API endpoint required updating the Application Load Balancer (ALB) configuration in Terraform with specific path patterns. This created tight coupling between application development and infrastructure management.

## Solution Overview

We've implemented a two-tier routing system:

1. **Infrastructure Layer**: Broad service-based routing rules in ALB
2. **Application Layer**: Intelligent API proxy in the web application

## Architecture Components

### 1. ALB Service-Based Routing (`infra/teardown/alb.tf`)

Instead of specific path rules like `/nodes/[id]`, we use broad patterns:

```terraform
# Core Service - handles nodes, LLM operations, and core business logic
resource "aws_lb_listener_rule" "core_service_api" {
  condition {
    path_pattern {
      values = [
        "/nodes*",           # All node operations
        "/llm*",             # All LLM operations  
        "/health",           # Health checks
        "/adjudication*"     # Future adjudication endpoints
      ]
    }
  }
}

# API Gateway Pattern - route all /api/* to web app
resource "aws_lb_listener_rule" "web_api_catchall" {
  condition {
    path_pattern {
      values = ["/api*"]
    }
  }
}
```

### 2. Web Application Proxy (`apps/web/lib/api-proxy.ts`)

The web app acts as an intelligent API gateway:

```typescript
const SERVICES: ServiceConfig[] = [
  {
    name: 'core-service',
    baseUrl: process.env.CORE_SERVICE_URL || 'http://core-service:3003',
    pathPatterns: ['/nodes', '/llm', '/health', '/adjudication']
  },
  // ... other services
];
```

### 3. Catch-All Route (`apps/web/app/api/[...proxy]/route.ts`)

A Next.js dynamic route handles all `/api/*` requests:

```typescript
export async function GET(request: Request) {
  return handler(request);
}
// ... all HTTP methods
```

## How It Works

### Direct Service Access
```
Client → ALB → Core Service
  GET /nodes/123
```

### API Gateway Pattern
```
Client → ALB → Web App → Proxy → Backend Service
  GET /api/nodes/123
```

## Benefits

### 🚀 **Zero Infrastructure Updates**
- Add new endpoints without touching Terraform
- Deploy API changes independently of infrastructure

### 🔄 **Flexible Routing**
- Environment-specific service URLs
- Easy service discovery and routing rules
- Support for complex routing logic

### 🛡️ **Centralized Control**
- Single point for API middleware (auth, logging, rate limiting)
- Consistent error handling across all APIs
- CORS configuration in one place

### 📈 **Scalability**
- Add new services without infrastructure changes
- Support for canary deployments and A/B testing
- Easy load balancing and failover logic

## Usage Examples

### Adding a New Service Endpoint

**Before** (Required infrastructure update):
1. Add endpoint to backend service
2. Update ALB rules in Terraform
3. Apply infrastructure changes
4. Deploy application

**After** (Zero infrastructure changes):
1. Add endpoint to backend service
2. Update routing config in `api-proxy.ts` (optional)
3. Deploy application

### Adding a New Service

1. **Update Service Config**:
```typescript
// apps/web/lib/api-proxy.ts
const SERVICES: ServiceConfig[] = [
  // ... existing services
  {
    name: 'analytics-service',
    baseUrl: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3004',
    pathPatterns: ['/analytics', '/reports', '/metrics']
  }
];
```

2. **Add Environment Variable** (optional for direct access):
```terraform
# infra/teardown/alb.tf - only if you want direct service access
resource "aws_lb_listener_rule" "analytics_service_api" {
  condition {
    path_pattern {
      values = ["/analytics*", "/reports*", "/metrics*"]
    }
  }
}
```

## Environment Configuration

### Development (docker-compose.yml)
```yaml
web:
  environment:
    - CORE_SERVICE_URL=http://core-service:3003
    - MESSAGE_SERVICE_URL=http://message-service:3001
    - USER_SERVICE_URL=http://user-service:3002
```

### Production (ECS)
```terraform
environment = [
  {
    name  = "CORE_SERVICE_URL"
    value = "http://${aws_lb.main.dns_name}"
  }
  # ALB handles routing to correct service
]
```

## Migration Path

### Phase 1: Hybrid Approach ✅
- Keep existing direct service routes for backward compatibility
- Add API gateway routes for new endpoints
- Both patterns work simultaneously

### Phase 2: Full Migration (Optional)
- Migrate all clients to use `/api/*` endpoints
- Remove specific ALB rules
- Simplify infrastructure to web-only routing

## Monitoring and Debugging

### Request Flow Tracing
```typescript
// Enable detailed logging in api-proxy.ts
console.log(`Routing ${path} to ${service.name} at ${targetUrl}`);
```

### Health Checks
- Direct service health: `GET /health`
- API gateway health: `GET /api/health` 
- Service discovery: Built into proxy logic

### Error Handling
- Service unavailable: Returns 502 with service details
- Path not found: Returns 404 with path information
- Automatic failover: Can be added to proxy logic

## Best Practices

1. **Service Naming**: Use consistent patterns (`/service-name/*`)
2. **Environment Variables**: Always provide fallback URLs for development
3. **Error Handling**: Include service context in error responses
4. **Logging**: Log routing decisions for debugging
5. **Testing**: Test both direct and proxied routes

This architecture provides maximum flexibility while maintaining performance and reliability. You can now focus on building features instead of managing infrastructure routing rules!