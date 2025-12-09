# COLLM API Documentation

This directory contains the generated OpenAPI documentation for all COLLM microservices.

## 📚 Available Documentation

- **[index.html](index.html)** - Main documentation portal with service overview
- **[core-service.html](core-service.html)** - Node management, memory system, and LLM interactions
- **[message-service.html](message-service.html)** - Message queue operations
- **[user-service.html](user-service.html)** - User authentication and management

## 🚀 Viewing Documentation

### Local Development
```bash
# Serve documentation locally
npm run serve-docs:all
```
Then open http://localhost:8080 in your browser.

### Individual Service Documentation
```bash
# Preview a specific service's documentation
npm run serve-docs  # Serves core-service by default
npx @redocly/cli preview-docs openapi/message-service.yaml
npx @redocly/cli preview-docs openapi/user-service.yaml
```

## 🔧 Generating Documentation

Documentation is automatically generated from the OpenAPI specifications in the `openapi/` directory.

```bash
# Generate all documentation
npm run docs

# Generate individual service docs
npm run docs:core
npm run docs:message
npm run docs:user
```

## 📝 OpenAPI Specifications

The source specifications are located at:
- `openapi/core-service.yaml`
- `openapi/message-service.yaml`  
- `openapi/user-service.yaml`

## 🔄 Auto-Update

Documentation is regenerated whenever:
1. OpenAPI specifications are modified
2. `npm run build` is executed
3. CI/CD pipeline runs

The documentation reflects the current state of your API contracts and provides:
- Interactive API exploration
- Request/response examples
- Schema definitions
- Authentication requirements
- Error responses