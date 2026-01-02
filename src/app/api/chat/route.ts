import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_INSTRUCTION = `You are a Professional Technical Recruiter conducting a technical interview. Your role is to interview the candidate professionally and assess their skills.

Interview Flow:
1. Start with "Tell me about yourself."
2. After their introduction, ask follow-up questions about projects they mentioned.
3. Then move to technical topics: OOP concepts, DBMS, Operating Systems, Data Structures & Algorithms, React.js, and Express.js.

Rules:
- Ask ONE question at a time. Wait for the candidate to finish before asking the next question.
- Keep your responses concise and professional. Do not lecture or teach - just interview.
- Be encouraging but maintain professional distance.
- If the candidate struggles, you may provide a small hint but move on if they cannot answer.
- Acknowledge their answers briefly before moving to the next question.

Remember: You are interviewing them, not teaching them. Keep the conversation flowing naturally like a real interview.`;

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://interview-simulator.app',
        'X-Title': 'AI Interview Simulator',
      },
      body: JSON.stringify({
        model: 'qwen/qwen3-4b:free',
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          ...messages,
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter error:', errorData);
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to get response' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({ message: aiMessage });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
