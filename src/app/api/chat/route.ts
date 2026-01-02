import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_INSTRUCTION = `You are a technical interviewer conducting a mock interview.

YOUR BEHAVIOR:
1. Start with a brief greeting and ask your first technical question
2. After each answer:
   - If CORRECT: Acknowledge briefly, then ask the next question
   - If WRONG: Correct them with the right answer in 1 sentence, then ask the next question
   - If "I don't know": Tell them the answer briefly, then move on to the next question

EXAMPLE RESPONSES:
- Wrong: "Actually, a stack uses LIFO - Last In First Out. Next question: What's the time complexity of array access by index?"
- Correct: "That's correct. Next question: What's the difference between a linked list and an array?"
- Don't know: "The answer is that a binary tree has at most 2 children per node. Next question: What does SQL stand for?"

TOPICS: Data structures, algorithms, OOP, web development, databases

RULES:
- Be professional and direct like a real interviewer
- When they're wrong, just give the correct answer and move on
- Always end with the next question
- Keep responses short (2-3 sentences max)
- NO explanations, NO teaching, just the answer
- Sound natural for speech
- NO markdown`;

const FREE_MODELS = [
  'deepseek/deepseek-r1-distill-llama-70b:free',
  'meta-llama/llama-4-maverick:free',
  'meta-llama/llama-4-scout:free',
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'qwen/qwen3-4b:free',
];

async function tryModel(apiKey: string, model: string, messages: Array<{role: string; content: string}>): Promise<Response> {
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://interview-simulator.app',
      'X-Title': 'AI Interview Simulator',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        ...messages,
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });
}

function cleanResponse(text: string): string {
  return text
    .replace(/\(You may also want to ask[^)]*\)/gi, '')
    .replace(/\(Consider asking[^)]*\)/gi, '')
    .replace(/\(Follow-up[^)]*\)/gi, '')
    .replace(/\(Note:[^)]*\)/gi, '')
    .replace(/\(Tip:[^)]*\)/gi, '')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    let lastError = '';
    
    for (const model of FREE_MODELS) {
      try {
        const response = await tryModel(apiKey, model, messages);
        
        if (response.ok) {
          const data = await response.json();
          let aiMessage = data.choices?.[0]?.message?.content || '';
          
          if (aiMessage && aiMessage.trim()) {
            aiMessage = cleanResponse(aiMessage);
            
            if (aiMessage) {
              return NextResponse.json({ message: aiMessage });
            }
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error(`Model ${model} failed:`, errorData.error?.message || response.status);
          lastError = errorData.error?.message || `HTTP ${response.status}`;
        }
      } catch (e) {
        console.error(`Model ${model} error:`, e);
        lastError = e instanceof Error ? e.message : 'Unknown error';
      }
    }

    return NextResponse.json(
      { error: lastError || 'All models failed. Please try again.' },
      { status: 503 }
    );
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
