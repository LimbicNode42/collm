import { NextRequest, NextResponse } from 'next/server';

// Get core service URL from environment or default to localhost
const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:3003';

export async function POST(request: NextRequest) {
  try {
    const { prompt, systemPrompt, model } = await request.json();
    
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Call the core service LLM endpoint
    const response = await fetch(`${CORE_SERVICE_URL}/llm/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, systemPrompt, model }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return NextResponse.json(
        { 
          success: false, 
          error: `Core service error: ${response.status}`,
          details: errorData.error || errorData.details
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('[test-llm] Error calling core service:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to connect to core service',
        details: error.message 
      },
      { status: 500 }
    );
  }
}