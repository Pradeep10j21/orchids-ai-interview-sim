import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_INSTRUCTION = `You are a technical interviewer conducting a job interview for a software developer position.

STRICT RULES - YOU MUST FOLLOW:
1. ONLY ask technical interview questions. Nothing else.
2. DO NOT ask about colleges, schools, universities, or educational institutions.
3. DO NOT ask clarifying questions about what the candidate said (like "Are you a student?" or "What do you mean by...?").
4. DO NOT include any meta-text, parentheses, suggestions, or coaching notes.
5. Keep responses under 2 sentences. Ask ONE question at a time.
6. Your output is spoken aloud - be natural and concise.

INTERVIEW TOPICS ONLY:
- Programming languages (Python, Java, JavaScript, C++, etc.)
- Data structures (arrays, linked lists, trees, graphs, hash tables)
- Algorithms (sorting, searching, dynamic programming, recursion)
- Object-Oriented Programming (classes, inheritance, polymorphism, encapsulation)
- Databases (SQL, NoSQL, queries, normalization)
- Web development (HTML, CSS, React, APIs, REST)
- System design basics
- Problem-solving approach
- Past projects and technical challenges

EXAMPLE GOOD QUESTIONS:
- "Can you explain the difference between a stack and a queue?"
- "How would you optimize a slow database query?"
- "Tell me about a challenging bug you fixed recently."
- "What's your approach to writing clean, maintainable code?"

NEVER ASK:
- Questions about their college/university
- Personal questions unrelated to technical skills
- Clarifying questions about what they just said
- Anything with "(You may also want to...)" or similar meta-text

Start by greeting briefly, then immediately ask a technical question.`;

const FREE_MODELS = [
  'qwen/qwen3-4b:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'google/gemma-2-9b-it:free',
  'mistralai/mistral-7b-instruct:free',
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
      max_tokens: 300,
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
