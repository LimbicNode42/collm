'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TestSection {
  name: string;
  description: string;
  component: React.ReactNode;
}

export default function TestPage() {
  const [activeSection, setActiveSection] = useState<string>('user-management');
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

  const sections: TestSection[] = [
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