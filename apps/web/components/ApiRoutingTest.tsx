/**
 * API Routing Test
 * 
 * This component tests the flexible API routing system to ensure
 * requests are properly proxied to backend services.
 */

'use client';

import { useState } from 'react';

interface TestResult {
  path: string;
  method: string;
  status: number;
  response: any;
  error?: string;
  timestamp: string;
}

export default function ApiRoutingTest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const testRoutes = [
    // Test API gateway routing
    { path: '/api/nodes', method: 'GET', description: 'List nodes (via API gateway)' },
    { path: '/api/health', method: 'GET', description: 'Health check (via API gateway)' },
    { path: '/api/users', method: 'GET', description: 'List users (via API gateway)' },
    
    // Test direct service routing (if available)
    { path: '/nodes', method: 'GET', description: 'List nodes (direct)' },
    { path: '/health', method: 'GET', description: 'Health check (direct)' },
  ];

  const testRoute = async (path: string, method: string, description: string) => {
    setLoading(`${method} ${path}`);
    
    try {
      const response = await fetch(path, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const responseData = await response.text();
      let parsedData;
      
      try {
        parsedData = JSON.parse(responseData);
      } catch {
        parsedData = responseData;
      }

      const result: TestResult = {
        path,
        method,
        status: response.status,
        response: parsedData,
        timestamp: new Date().toISOString(),
      };

      setResults(prev => [result, ...prev]);
    } catch (error) {
      const result: TestResult = {
        path,
        method,
        status: 0,
        response: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };

      setResults(prev => [result, ...prev]);
    } finally {
      setLoading(null);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">API Routing Test</h2>
        <p className="text-gray-600 mb-4">
          Test the flexible API routing system. The API gateway should proxy requests
          to appropriate backend services without requiring infrastructure updates.
        </p>
      </div>

      {/* Test Buttons */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Test Routes</h3>
        <div className="grid gap-2">
          {testRoutes.map(({ path, method, description }) => (
            <button
              key={`${method}-${path}`}
              onClick={() => testRoute(path, method, description)}
              disabled={loading === `${method} ${path}`}
              className={`p-3 text-left border rounded-lg hover:bg-gray-50 disabled:opacity-50 ${
                loading === `${method} ${path}` ? 'bg-blue-50' : 'bg-white'
              }`}
            >
              <div className="font-medium">
                <span className={`px-2 py-1 rounded text-xs mr-2 ${
                  method === 'GET' ? 'bg-green-100 text-green-800' :
                  method === 'POST' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {method}
                </span>
                {path}
              </div>
              <div className="text-sm text-gray-600">{description}</div>
            </button>
          ))}
        </div>
        
        <button
          onClick={clearResults}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
        >
          Clear Results
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Test Results</h3>
          <div className="space-y-3">
            {results.map((result, index) => (
              <div key={index} className="border rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">
                    <span className={`px-2 py-1 rounded text-xs mr-2 ${
                      result.method === 'GET' ? 'bg-green-100 text-green-800' :
                      result.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {result.method}
                    </span>
                    {result.path}
                  </div>
                  <div className={`px-2 py-1 rounded text-xs ${
                    result.status >= 200 && result.status < 300 ? 'bg-green-100 text-green-800' :
                    result.status >= 400 ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {result.status || 'NETWORK_ERROR'}
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 mb-2">
                  {new Date(result.timestamp).toLocaleString()}
                </div>

                {result.error ? (
                  <div className="bg-red-50 p-3 rounded">
                    <div className="text-red-800 font-medium">Error:</div>
                    <div className="text-red-700 text-sm">{result.error}</div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="text-sm font-medium mb-1">Response:</div>
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                      {typeof result.response === 'string' 
                        ? result.response 
                        : JSON.stringify(result.response, null, 2)
                      }
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Legend */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-semibold mb-2">Expected Behavior:</h4>
        <ul className="text-sm space-y-1">
          <li><strong>API Gateway routes (/api/*):</strong> Should work via web app proxy</li>
          <li><strong>Direct routes (/):</strong> May work if ALB rules exist, or 404 if using web-only routing</li>
          <li><strong>502 errors:</strong> Service unavailable (check service is running)</li>
          <li><strong>404 errors:</strong> Route not configured (expected for some direct routes)</li>
        </ul>
      </div>
    </div>
  );
}