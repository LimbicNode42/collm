#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');
const indexPath = path.join(docsDir, 'index.html');

const indexHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>COLLM API Documentation</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            background: #f5f7fa;
            color: #2c3e50;
        }
        .header {
            text-align: center;
            margin-bottom: 3rem;
            padding: 2rem;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 0.5rem;
        }
        .subtitle {
            color: #7f8c8d;
            font-size: 1.1rem;
        }
        .services-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 2rem;
            margin-bottom: 3rem;
        }
        .service-card {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .service-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }
        .service-title {
            color: #2c3e50;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .service-icon {
            width: 24px;
            height: 24px;
            border-radius: 4px;
        }
        .core { background: #3498db; }
        .message { background: #e74c3c; }
        .user { background: #2ecc71; }
        .service-description {
            color: #7f8c8d;
            margin-bottom: 1.5rem;
            line-height: 1.6;
        }
        .doc-link {
            display: inline-block;
            padding: 0.75rem 1.5rem;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 500;
            transition: background 0.2s ease;
        }
        .doc-link:hover {
            background: #2980b9;
        }
        .footer {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            color: #7f8c8d;
        }
        .build-info {
            font-size: 0.9rem;
            margin-top: 1rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>COLLM API Documentation</h1>
        <div class="subtitle">Collaborative Language Learning Model - Microservices API</div>
    </div>

    <div class="services-grid">
        <div class="service-card">
            <h2 class="service-title">
                <div class="service-icon core"></div>
                Core Service
            </h2>
            <div class="service-description">
                Handles node management, hierarchical memory system, and LLM interactions. 
                Manages conversation contexts and provides AI-powered responses.
            </div>
            <a href="core-service.html" class="doc-link">View Documentation</a>
        </div>

        <div class="service-card">
            <h2 class="service-title">
                <div class="service-icon message"></div>
                Message Service
            </h2>
            <div class="service-description">
                Manages message queue operations for asynchronous processing. 
                Handles message persistence, queueing, and worker coordination.
            </div>
            <a href="message-service.html" class="doc-link">View Documentation</a>
        </div>

        <div class="service-card">
            <h2 class="service-title">
                <div class="service-icon user"></div>
                User Service
            </h2>
            <div class="service-description">
                Handles user authentication, registration, and user management. 
                Provides JWT-based authentication and user profile operations.
            </div>
            <a href="user-service.html" class="doc-link">View Documentation</a>
        </div>
    </div>

    <div class="footer">
        <div>Generated from OpenAPI specifications</div>
        <div class="build-info">Built on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</div>
    </div>
</body>
</html>
`;

// Ensure docs directory exists
if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
}

// Write index file
fs.writeFileSync(indexPath, indexHtml.trim());

console.log('📚 Documentation index generated at docs/index.html');