import { NextResponse } from 'next/server';
import { messageQueue } from '../../../services/queue';
import { QueueMessage } from '../../../types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, nodeId, content } = body;

    if (!userId || !nodeId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, nodeId, content' },
        { status: 400 }
      );
    }

    // In a real app, we would save the message to the DB with status 'PENDING' here first.
    // For this scaffold, we'll generate an ID and push directly to the queue.
    const messageId = Math.random().toString(36).substring(7);
    
    const queueMessage: QueueMessage = {
      messageId,
      nodeId,
      content,
      timestamp: Date.now(),
    };

    await messageQueue.enqueue(queueMessage);

    return NextResponse.json({ 
      success: true, 
      message: 'Message queued for adjudication',
      data: { messageId } 
    }, { status: 202 });

  } catch (error) {
    console.error('Error processing message:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
