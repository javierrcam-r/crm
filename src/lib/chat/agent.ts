import { ChatOpenAI } from '@langchain/openai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { allTools } from './tools';
import { SYSTEM_PROMPT } from './systemPrompt';

let agentInstance: ReturnType<typeof createReactAgent> | null = null;

function getAgent() {
  if (agentInstance) return agentInstance;

  const llm = new ChatOpenAI({
    modelName: 'gpt-4.1',
    temperature: 0,
    openAIApiKey: process.env.OPENAI_API_KEY,
    streaming: true,
  });

  agentInstance = createReactAgent({
    llm,
    tools: allTools,
    prompt: SYSTEM_PROMPT,
  });

  return agentInstance;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function* streamChat(messages: ChatMessage[]) {
  const agent = getAgent();

  const langchainMessages = messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const stream = await agent.stream(
    { messages: langchainMessages },
    { streamMode: 'messages' }
  );

  for await (const [msgChunk, metadata] of stream) {
    if (
      msgChunk._getType?.() === 'ai' &&
      typeof msgChunk.content === 'string' &&
      msgChunk.content.length > 0 &&
      !msgChunk.additional_kwargs?.tool_calls?.length
    ) {
      yield msgChunk.content;
    }
  }
}
