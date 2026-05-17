import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { z } from 'zod';
import { LlmRequest, LlmResponse } from '../common/types/llm.types';
import { LLM_MODEL } from '../common/constants';

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);
  private model!: ChatGoogleGenerativeAI;

  onModuleInit(): void {
    this.model = new ChatGoogleGenerativeAI({
      model: LLM_MODEL,
      apiKey: process.env.GEMINI_API_KEY ?? '',
      maxOutputTokens: 8192,
      temperature: 0.2,
    });
  }

  async generateStructured<T extends Record<string, unknown>>(
    request: LlmRequest,
    schema: z.ZodType<T>,
  ): Promise<T> {
    this.logger.debug(
      `Structured LLM request: "${request.userMessage.slice(0, 80)}${request.userMessage.length > 80 ? '...' : ''}"`,
    );

    const messages = this.buildMessages(request);
    const structuredModel = this.model.withStructuredOutput(schema);
    const result = await this.withRetry(() => structuredModel.invoke(messages));

    this.logger.log('Structured LLM response received');

    return result;
  }

  async generate(request: LlmRequest): Promise<LlmResponse> {
    this.logger.debug(
      `LLM request: "${request.userMessage.slice(0, 80)}${request.userMessage.length > 80 ? '...' : ''}"`,
    );

    const messages = this.buildMessages(request);
    const response = await this.withRetry(() => this.model.invoke(messages));

    const text =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    const tokensUsed = response.usage_metadata?.total_tokens;

    this.logger.log(
      `LLM response: ${text.length} chars${tokensUsed !== undefined ? `, ${tokensUsed} tokens` : ''}`,
    );

    return { text, tokensUsed };
  }

  private buildMessages(request: LlmRequest): BaseMessage[] {
    const systemContent = request.ragContext
      ? `${request.systemPrompt}\n\n${request.ragContext}`
      : request.systemPrompt;

    const messages: BaseMessage[] = [new SystemMessage(systemContent)];

    for (const msg of request.conversationHistory ?? []) {
      messages.push(
        msg.role === 'user'
          ? new HumanMessage(msg.content)
          : new AIMessage(msg.content),
      );
    }

    messages.push(new HumanMessage(request.userMessage));
    return messages;
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err: unknown) {
        lastError = err;
        if (attempt === MAX_RETRIES - 1) break;

        const delayMs = RETRY_DELAYS_MS[attempt];
        const label = this.isRateLimitError(err)
          ? 'Rate limit hit'
          : `LLM call failed (${String(err)})`;

        this.logger.warn(
          `${label} — retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
        );

        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError;
  }

  private isRateLimitError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const e = err as Record<string, unknown>;
    const status = e['status'];
    const message = typeof e['message'] === 'string' ? e['message'] : '';
    return (
      status === 429 ||
      message.includes('429') ||
      message.toLowerCase().includes('rate limit') ||
      message.toLowerCase().includes('quota')
    );
  }
}
