'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TestSection {
  name: string;
  description: string;
  component: React.ReactNode;
}

export default function TestPage() {
  const [activeSection, setActiveSection] = useState<string>('api-routing');
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const apiCall = async (key: string, url: string, options?: RequestInit) => {
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      setResults(prev => ({ 
        ...prev, 
        [key]: { 
          status: response.status, 
          success: response.ok, 
          data,
          timestamp: new Date().toLocaleTimeString()
        } 
      }));
    } catch (error: any) {
      setResults(prev => ({ 
        ...prev, 
        [key]: { 
          error: error.message,
          timestamp: new Date().toLocaleTimeString()
        } 
      }));
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const UserManagementTests = () => {
    const [email, setEmail] = useState('test@example.com');
    const [password, setPassword] = useState('password123');
    const [name, setName] = useState('Test User');

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow text-black">
          <h3 className="text-lg font-semibold mb-4">User Registration</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border rounded px-3 py-2"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border rounded px-3 py-2"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border rounded px-3 py-2"
            />
          </div>
          <button
            onClick={() => apiCall('register', '/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, email, password })
            })}
            disabled={loading.register}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 mr-2"
          >
            {loading.register ? 'Registering...' : 'Register User'}
          </button>
          <button
            onClick={() => apiCall('login', '/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            })}
            disabled={loading.login}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading.login ? 'Logging in...' : 'Login User'}
          </button>
        </div>
        {(results.register || results.login) && (
          <ResultDisplay results={[results.register, results.login].filter(Boolean)} />
        )}
      </div>
    );
  };

  const NodeManagementTests = () => {
    const [topic, setTopic] = useState('AI Discussion');
    const [description, setDescription] = useState('A node for discussing AI topics');
    const [model, setModel] = useState('claude-sonnet-4-5-20250929');
    const [nodeId, setNodeId] = useState('');

    const models = [
      'claude-sonnet-4-5-20250929',
      'gpt-5',
      'gpt-5-pro',
      'gemini-3-pro',
      'gemini-2.5-flash'
    ];

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow text-black">
          <h3 className="text-lg font-semibold mb-4">Node Management</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="Topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="border rounded px-3 py-2"
            />
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="border rounded px-3 py-2"
            >
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border rounded px-3 py-2 col-span-full"
              rows={2}
            />
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => apiCall('createNode', '/nodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, description, model })
              })}
              disabled={loading.createNode}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {loading.createNode ? 'Creating...' : 'Create Node'}
            </button>
            <button
              onClick={() => apiCall('listNodes', '/nodes')}
              disabled={loading.listNodes}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading.listNodes ? 'Loading...' : 'List All Nodes'}
            </button>
            {nodeId && (
              <button
                onClick={() => apiCall('getNode', `/nodes/${nodeId}`)}
                disabled={loading.getNode}
                className="bg-cyan-600 text-white px-4 py-2 rounded hover:bg-cyan-700 disabled:opacity-50"
              >
                {loading.getNode ? 'Loading...' : 'Get Node Details'}
              </button>
            )}
          </div>
          {nodeId && (
            <div className="border-t pt-4">
              <input
                type="text"
                placeholder="Node ID for operations"
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
                className="border rounded px-3 py-2 w-full"
              />
            </div>
          )}
        </div>
        {(results.createNode || results.listNodes || results.getNode) && (
          <ResultDisplay results={[results.createNode, results.listNodes, results.getNode].filter(Boolean)} />
        )}
        {results.createNode?.data?.node?.id && (
          <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
            <p className="text-sm text-yellow-800">
              <strong>Created Node ID:</strong> {results.createNode.data.node.id}
              <button
                onClick={() => setNodeId(results.createNode.data.node.id)}
                className="ml-2 text-blue-600 hover:text-blue-800 text-xs underline"
              >
                Use this ID
              </button>
            </p>
          </div>
        )}
      </div>
    );
  };

  const MessageTests = () => {
    const [userId, setUserId] = useState('test-user-1');
    const [nodeId, setNodeId] = useState('');
    const [content, setContent] = useState('What are the latest developments in AI?');
    const [targetNodeVersion, setTargetNodeVersion] = useState(1);
    const [messageId, setMessageId] = useState('');

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow text-black">
          <h3 className="text-lg font-semibold mb-4">Message Processing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="border rounded px-3 py-2"
            />
            <input
              type="text"
              placeholder="Node ID"
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              className="border rounded px-3 py-2"
            />
            <input
              type="number"
              placeholder="Target Node Version"
              value={targetNodeVersion}
              onChange={(e) => setTargetNodeVersion(parseInt(e.target.value))}
              className="border rounded px-3 py-2"
            />
            <input
              type="text"
              placeholder="Message ID (for status check)"
              value={messageId}
              onChange={(e) => setMessageId(e.target.value)}
              className="border rounded px-3 py-2"
            />
            <textarea
              placeholder="Message content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="border rounded px-3 py-2 col-span-full"
              rows={3}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => apiCall('sendMessage', '/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, nodeId, content, targetNodeVersion })
              })}
              disabled={loading.sendMessage}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading.sendMessage ? 'Sending...' : 'Send Message'}
            </button>
            <button
              onClick={() => apiCall('popQueue', '/queue/pop')}
              disabled={loading.popQueue}
              className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:opacity-50"
            >
              {loading.popQueue ? 'Popping...' : 'Pop from Queue'}
            </button>
            {messageId && (
              <button
                onClick={() => apiCall('checkStatus', `/message/${messageId}`)}
                disabled={loading.checkStatus}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading.checkStatus ? 'Checking...' : 'Check Message Status'}
              </button>
            )}
          </div>
        </div>
        {(results.sendMessage || results.popQueue || results.checkStatus) && (
          <ResultDisplay results={[results.sendMessage, results.popQueue, results.checkStatus].filter(Boolean)} />
        )}
        {results.sendMessage?.data?.messageId && (
          <div className="bg-blue-50 p-4 rounded border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Message ID:</strong> {results.sendMessage.data.messageId}
              <button
                onClick={() => setMessageId(results.sendMessage.data.messageId)}
                className="ml-2 text-blue-600 hover:text-blue-800 text-xs underline"
              >
                Use this ID
              </button>
            </p>
          </div>
        )}
      </div>
    );
  };

  const MemoryTests = () => {
    const [nodeId, setNodeId] = useState('');
    const [topic, setTopic] = useState('Artificial Intelligence');
    const [description, setDescription] = useState('Exploring the fundamentals of AI and machine learning');
    const [message, setMessage] = useState('What are neural networks?');
    const [conversationHistory, setConversationHistory] = useState<any[]>([]);
    const [memoryResults, setMemoryResults] = useState<Record<string, any>>({});
    const [memoryLoading, setMemoryLoading] = useState<Record<string, boolean>>({});

    const memoryApiCall = async (key: string, url: string, options?: RequestInit) => {
      setMemoryLoading(prev => ({ ...prev, [key]: true }));
      try {
        const response = await fetch(url, options);
        const data = await response.json();
        const result = { 
          status: response.status, 
          success: response.ok, 
          data,
          timestamp: new Date().toLocaleTimeString()
        };
        setMemoryResults(prev => ({ ...prev, [key]: result }));
        return result;
      } catch (error) {
        const result = { 
          status: 0, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toLocaleTimeString()
        };
        setMemoryResults(prev => ({ ...prev, [key]: result }));
        return result;
      } finally {
        setMemoryLoading(prev => ({ ...prev, [key]: false }));
      }
    };

    const createTestNode = async () => {
      const result = await memoryApiCall('createMemoryNode', '/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          topic, 
          description,
          model: 'claude-sonnet-4-5-20250929'
        })
      });
      
      // Extract node ID from result for further testing
      if (result.success && 'data' in result && result.data?.id) {
        setNodeId(result.data.id);
      }
    };

    const sendMessage = async () => {
      if (!nodeId) {
        alert('Please create a node first');
        return;
      }
      
      const result = await memoryApiCall('sendMemoryMessage', '/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: message,
          nodeId,
          userId: 'test-user-' + Date.now()
        })
      });
      
      // Add to conversation history for display
      setConversationHistory(prev => [...prev, {
        type: 'user',
        content: message,
        timestamp: new Date().toLocaleTimeString()
      }]);
      
      // Add response if available
      if (result.success && 'data' in result && result.data?.response) {
        setConversationHistory(prev => [...prev, {
          type: 'assistant',
          content: result.data.response,
          timestamp: new Date().toLocaleTimeString()
        }]);
      }
      
      setMessage('');
    };

    const getNodeMemory = async () => {
      if (!nodeId) {
        alert('Please create a node first');
        return;
      }
      
      await memoryApiCall('getMemoryNode', `/api/nodes/${nodeId}`);
    };

    const testMessages = [
      "What are neural networks?",
      "How do they learn from data?",
      "What's the difference between supervised and unsupervised learning?",
      "Can you give me an example of deep learning?",
      "How does backpropagation work?",
      "What are some real-world applications?",
      "Tell me about transformers in AI",
      "How does attention mechanism work?",
      "What are the challenges with large language models?",
      "How can we make AI more ethical?"
    ];

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Memory System Testing</h3>
          <p className="text-sm text-gray-700 mb-2">
            This tests the hierarchical memory system for conversation nodes. 
          </p>
          <div className="text-xs text-gray-600">
            <strong>Note:</strong> If backend services aren't running, you'll see 502/404 errors - this is expected.
            To test fully, start the core-service and database.
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow text-black">
          <h3 className="text-lg font-semibold mb-4">Node Creation & Memory Initialization</h3>
          <div className="space-y-4 mb-4">
            <input
              placeholder="Topic (e.g., 'Artificial Intelligence')"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            />
            <textarea
              placeholder="Initial description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              rows={2}
            />
            <input
              placeholder="Node ID (auto-filled after creation, or enter manually for testing)"
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              className="border rounded px-3 py-2 w-full text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={createTestNode}
              disabled={memoryLoading.createMemoryNode}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {memoryLoading.createMemoryNode ? 'Creating...' : 'Create Node'}
            </button>
            <button
              onClick={() => setNodeId('test-node-' + Date.now())}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm"
            >
              Use Mock Node ID
            </button>
          </div>
          {nodeId && (
            <div className="mt-2 text-sm text-gray-600">
              <strong>Node ID:</strong> {nodeId}
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow text-black">
          <h3 className="text-lg font-semibold mb-4">Memory Testing & Conversation</h3>
          <div className="space-y-4 mb-4">
            <textarea
              placeholder="Enter a message to test memory retention..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              rows={2}
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={sendMessage}
                disabled={memoryLoading.sendMemoryMessage || !nodeId}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {memoryLoading.sendMemoryMessage ? 'Sending...' : 'Send Message'}
              </button>
              <button
                onClick={getNodeMemory}
                disabled={memoryLoading.getMemoryNode || !nodeId}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {memoryLoading.getMemoryNode ? 'Loading...' : 'View Memory State'}
              </button>
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Quick Test Messages:</h4>
              <div className="flex flex-wrap gap-2">
                {testMessages.map((msg, index) => (
                  <button
                    key={index}
                    onClick={() => setMessage(msg)}
                    className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-sm"
                  >
                    {msg.length > 30 ? msg.substring(0, 30) + '...' : msg}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {conversationHistory.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Conversation History:</h4>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {conversationHistory.map((entry, index) => (
                  <div key={index} className="text-sm">
                    <span className="text-gray-500">[{entry.timestamp}]</span> 
                    <span className="font-medium ml-2">{entry.type === 'user' ? 'User:' : 'AI:'}</span>
                    <span className="ml-2">{entry.content}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {memoryResults.createMemoryNode && (
          <div className="bg-white p-6 rounded-lg shadow text-black">
            <h4 className="font-medium mb-2">Node Creation Result:</h4>
            <div className={`p-3 rounded text-sm ${memoryResults.createMemoryNode.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-medium ${memoryResults.createMemoryNode.success ? 'text-green-800' : 'text-red-800'}`}>
                  Status: {memoryResults.createMemoryNode.status} {memoryResults.createMemoryNode.success ? '✅' : '❌'}
                </span>
                <span className="text-gray-500">{memoryResults.createMemoryNode.timestamp}</span>
              </div>
              <pre className="whitespace-pre-wrap text-gray-700">
                {JSON.stringify(memoryResults.createMemoryNode.data || memoryResults.createMemoryNode.error, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {memoryResults.getMemoryNode && (
          <div className="bg-white p-6 rounded-lg shadow text-black">
            <h4 className="font-medium mb-2">Memory State:</h4>
            <div className="bg-gray-50 p-4 rounded text-sm">
              {memoryResults.getMemoryNode.data?.memory && (
                <div className="space-y-3">
                  <div>
                    <strong>Core Context:</strong>
                    <p className="mt-1 text-gray-700">{memoryResults.getMemoryNode.data.memory.coreContext}</p>
                  </div>
                  <div>
                    <strong>Working Memory:</strong>
                    <p className="mt-1 text-gray-700">{memoryResults.getMemoryNode.data.memory.workingMemory}</p>
                  </div>
                  <div>
                    <strong>Key Facts ({memoryResults.getMemoryNode.data.memory.keyFacts?.length || 0}):</strong>
                    <ul className="mt-1 text-gray-700 list-disc list-inside">
                      {memoryResults.getMemoryNode.data.memory.keyFacts?.map((fact: string, index: number) => (
                        <li key={index}>{fact}</li>
                      )) || <li>No key facts extracted yet</li>}
                    </ul>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span><strong>Messages:</strong> {memoryResults.getMemoryNode.data.memory.messageCount}</span>
                    <span><strong>Last Summary:</strong> {memoryResults.getMemoryNode.data.memory.lastSummaryAt}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {memoryResults.sendMemoryMessage && (
          <div className="bg-white p-6 rounded-lg shadow text-black">
            <h4 className="font-medium mb-2">Message Processing Result:</h4>
            <div className={`p-3 rounded text-sm ${memoryResults.sendMemoryMessage.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-medium ${memoryResults.sendMemoryMessage.success ? 'text-green-800' : 'text-red-800'}`}>
                  Status: {memoryResults.sendMemoryMessage.status} {memoryResults.sendMemoryMessage.success ? '✅' : '❌'}
                </span>
                <span className="text-gray-500">{memoryResults.sendMemoryMessage.timestamp}</span>
              </div>
              <pre className="whitespace-pre-wrap text-gray-700">
                {JSON.stringify(memoryResults.sendMemoryMessage.data || memoryResults.sendMemoryMessage.error, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    );
  };

  const LLMTests = () => {
    const [prompt, setPrompt] = useState('Explain quantum computing in simple terms');
    const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant');
    const [model, setModel] = useState('claude-sonnet-4-5-20250929');

    const models = [
      'claude-sonnet-4-5-20250929',
      'claude-haiku-4-5-20251001',
      'claude-opus-4-5-20251101',
      'gpt-5',
      'gpt-5-pro',
      'gpt-5.1',
      'gemini-3-pro',
      'gemini-2.5-flash',
      'gemini-2.5-pro'
    ];

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow text-black">
          <h3 className="text-lg font-semibold mb-4">LLM Direct Testing</h3>
          <div className="space-y-4 mb-4">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="border rounded px-3 py-2 w-full"
            >
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <textarea
              placeholder="System prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              rows={2}
            />
            <textarea
              placeholder="User prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              rows={3}
            />
          </div>
          <button
            onClick={() => apiCall('testLLM', '/api/test-llm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt, systemPrompt, model })
            })}
            disabled={loading.testLLM}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading.testLLM ? 'Testing...' : 'Test LLM Direct'}
          </button>
        </div>
        {results.testLLM && (
          <ResultDisplay results={[results.testLLM]} />
        )}
      </div>
    );
  };

  const ResultDisplay = ({ results }: { results: any[] }) => (
    <div className="space-y-4">
      {results.map((result, index) => (
        <div key={index} className="bg-gray-100 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              result.success ? 'bg-green-100 text-green-800' : 
              result.error ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {result.success ? `SUCCESS (${result.status})` : 
               result.error ? 'ERROR' : 'UNKNOWN'}
            </span>
            <span className="text-xs text-gray-500">{result.timestamp}</span>
          </div>
          <pre className="text-xs overflow-auto max-h-64 bg-white p-2 rounded border">
            {JSON.stringify(result.data || result.error, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );

  // Import the routing test component
  const ApiRoutingTests = () => {
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState<string | null>(null);

    const testRoutes = [
      // Test API gateway routing
      { path: '/api/nodes', method: 'GET', description: 'List nodes (via API gateway)' },
      { path: '/api/health', method: 'GET', description: 'Health check (via API gateway)' },
      
      // Test direct service routing (if available)
      { path: '/nodes', method: 'GET', description: 'List nodes (direct)' },
      { path: '/health', method: 'GET', description: 'Health check (direct)' },
    ];

    const testRoute = async (path: string, method: string, description: string) => {
      setLoading(`${method} ${path}`);
      
      try {
        const response = await fetch(path, {
          method,
          headers: { 'Content-Type': 'application/json' },
        });

        const responseData = await response.text();
        let parsedData;
        
        try {
          parsedData = JSON.parse(responseData);
        } catch {
          parsedData = responseData;
        }

        const result = {
          path,
          method,
          status: response.status,
          response: parsedData,
          timestamp: new Date().toISOString(),
        };

        setResults(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
      } catch (error) {
        const result = {
          path,
          method,
          status: 0,
          response: null,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        };

        setResults(prev => [result, ...prev.slice(0, 9)]);
      } finally {
        setLoading(null);
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">API Routing Architecture Test</h3>
          <p className="text-sm text-gray-700">
            Tests the flexible routing system. API gateway routes (/api/*) proxy through the web app, 
            while direct routes may go directly to services depending on ALB configuration.
          </p>
        </div>

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
              <div className="flex items-center justify-between">
                <div>
                  <span className="px-2 py-1 rounded text-xs mr-2 bg-green-100 text-green-800">
                    {method}
                  </span>
                  <span className="font-medium">{path}</span>
                </div>
                {loading === `${method} ${path}` && (
                  <span className="text-sm text-blue-600">Testing...</span>
                )}
              </div>
              <div className="text-sm text-gray-600 mt-1">{description}</div>
            </button>
          ))}
        </div>

        <button
          onClick={() => setResults([])}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
        >
          Clear Results
        </button>

        {results.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold">Recent Test Results</h4>
            {results.map((result, index) => (
              <div key={index} className="border rounded-lg p-3 bg-white text-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{result.method} {result.path}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    result.status >= 200 && result.status < 300 ? 'bg-green-100 text-green-800' :
                    result.status >= 400 ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {result.status || 'ERROR'}
                  </span>
                </div>
                
                {result.error ? (
                  <div className="bg-red-50 p-2 rounded text-xs">
                    <strong>Error:</strong> {result.error}
                  </div>
                ) : (
                  <div className="bg-gray-50 p-2 rounded">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
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
        )}

        <div className="bg-yellow-50 p-3 rounded-lg text-sm">
          <strong>Expected Results:</strong>
          <ul className="mt-2 space-y-1 text-gray-700">
            <li>• <strong>/api/*</strong> routes should work (200) via web app proxy</li>
            <li>• Direct routes may work (200) or fail (404/502) depending on ALB config</li>
            <li>• 502 errors indicate service unavailable</li>
            <li>• 404 errors indicate route not configured</li>
          </ul>
        </div>
      </div>
    );
  };

  const sections: TestSection[] = [
    {
      name: 'api-routing',
      description: 'API Routing Architecture',
      component: <ApiRoutingTests />
    },
    {
      name: 'user-management',
      description: 'User Registration & Authentication',
      component: <UserManagementTests />
    },
    {
      name: 'node-management',
      description: 'Node Creation & Management',
      component: <NodeManagementTests />
    },
    {
      name: 'message-processing',
      description: 'Message Queue & Processing',
      component: <MessageTests />
    },
    {
      name: 'llm-testing',
      description: 'LLM Direct Testing',
      component: <LLMTests />
    },
    {
      name: 'memory-testing',
      description: 'Hierarchical Memory Testing',
      component: <MemoryTests />
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">Collm Feature Testing</h1>
            <Link 
              href="/"
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              ← Back to Home
            </Link>
          </div>
          <p className="mt-2 text-gray-600">Test all system features without remembering URLs</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Navigation Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Test Sections</h2>
              <nav className="space-y-2">
                {sections.map((section) => (
                  <button
                    key={section.name}
                    onClick={() => setActiveSection(section.name)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      activeSection === section.name
                        ? 'bg-blue-100 text-blue-800 font-semibold'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {section.description}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {sections.find(s => s.name === activeSection)?.component}
          </div>
        </div>
      </div>
    </div>
  );
}