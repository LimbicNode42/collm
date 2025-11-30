import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, systemPrompt, model } = await request.json();
    
    // This would normally call your core service
    // For now, we'll return a mock response to test the interface
    const mockResponse = {
      success: true,
      content: `Mock response from ${model}: This is a simulated response to "${prompt.substring(0, 50)}...". In a real implementation, this would call the core service LLM endpoint.`,
      usage: {
        promptTokens: 45,
        completionTokens: 23,
        totalTokens: 68
      },
      model,
      timestamp: new Date().toISOString()
    };

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json(mockResponse);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}