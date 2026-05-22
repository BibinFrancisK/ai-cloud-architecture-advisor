export class ChatGoogleGenerativeAI {
  constructor(_config: Record<string, unknown>) {}

  withStructuredOutput(_schema: unknown) {
    return {
      invoke: (_messages: unknown[]): Promise<unknown> => Promise.resolve({}),
    };
  }

  invoke(
    _messages: unknown[],
  ): Promise<{ content: string; usage_metadata: { total_tokens: number } }> {
    return Promise.resolve({
      content: '',
      usage_metadata: { total_tokens: 0 },
    });
  }
}
