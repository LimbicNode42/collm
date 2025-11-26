'use client';

import { useState } from 'react';

export default function QueueDebugPage() {
  const [userId, setUserId] = useState('test-user-1');
  const [nodeId, setNodeId] = useState('test-node-1');
  const [content, setContent] = useState('Hello World');
  const [targetNodeVersion, setTargetNodeVersion] = useState(1);
  
  const [pushResult, setPushResult] = useState<any>(null);
  const [popResult, setPopResult] = useState<any>(null);
  const [nodeResult, setNodeResult] = useState<any>(null);
  const [messageStatus, setMessageStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleCheckStatus = async () => {
    if (!pushResult?.data?.messageId) return;
    setLoading(true);
    try {
      const res = await fetch(`/message/${pushResult.data.messageId}`);
      const data = await res.json();
      setMessageStatus(data);
    } catch (err: any) {
      setMessageStatus({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNode = async () => {
    setLoading(true);
    setNodeResult(null);
    try {
      const res = await fetch('/queue/create-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'Debug Node', description: 'Created for testing' }),
      });
      const data = await res.json();
      setNodeResult(data);
      if (data.success && data.node?.id) {
        setNodeId(data.node.id);
      }
    } catch (err: any) {
      setNodeResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPushResult(null);
    try {
      const res = await fetch('/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, nodeId, content, targetNodeVersion }),
      });
      const data = await res.json();
      setPushResult(data);
    } catch (err: any) {
      setPushResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePop = async () => {
    setLoading(true);
    setPopResult(null);
    try {
      const res = await fetch('/queue/pop');
      const data = await res.json();
      setPopResult(data);
    } catch (err: any) {
      setPopResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Queue Debugger</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-8 text-black">
        <h2 className="text-xl font-semibold mb-4">Setup</h2>
        <button
          onClick={handleCreateNode}
          disabled={loading}
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 mb-4"
        >
          {loading ? 'Creating...' : 'Create Test Node'}
        </button>
        {nodeResult && (
          <div className="p-4 bg-gray-100 rounded overflow-auto">
            <pre className="text-xs">{JSON.stringify(nodeResult, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8 text-black">
        <h2 className="text-xl font-semibold mb-4">Push Message</h2>
        <form onSubmit={handlePush} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">User ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Node ID</label>
            <input
              type="text"
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Target Node Version</label>
            <input
              type="number"
              value={targetNodeVersion}
              onChange={(e) => setTargetNodeVersion(parseInt(e.target.value))}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Pushing...' : 'Push to Queue'}
          </button>
        </form>
        {pushResult && (
          <div className="mt-4 p-4 bg-gray-100 rounded overflow-auto">
            <pre className="text-xs">{JSON.stringify(pushResult, null, 2)}</pre>
            {pushResult.success && (
              <button
                onClick={handleCheckStatus}
                className="mt-2 bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
              >
                Check Status
              </button>
            )}
            {messageStatus && (
              <div className="mt-2 border-t pt-2">
                <p className="font-semibold text-sm">Current Status:</p>
                <pre className="text-xs">{JSON.stringify(messageStatus, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md text-black">
        <h2 className="text-xl font-semibold mb-4">Pop Message</h2>
        <button
          onClick={handlePop}
          disabled={loading}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Popping...' : 'Pop from Queue'}
        </button>
        {popResult && (
          <div className="mt-4 p-4 bg-gray-100 rounded overflow-auto">
            <pre className="text-xs">{JSON.stringify(popResult, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
