export interface AgentOutput<T> {
  success: boolean;
  data: T | null;
  confidence: number; // 0 to 100
  reasoning: string;
  duration_ms: number;
  metadata?: Record<string, unknown>;
}

export abstract class BaseAgent<TInput, TOutput> {
  public abstract readonly name: string;
  public abstract readonly role: string;

  protected async executeTimed(
    fn: () => Promise<{ data: TOutput; confidence: number; reasoning: string; metadata?: Record<string, unknown> }>
  ): Promise<AgentOutput<TOutput>> {
    const startTime = Date.now();
    try {
      const res = await fn();
      return {
        success: true,
        data: res.data,
        confidence: res.confidence,
        reasoning: res.reasoning,
        duration_ms: Date.now() - startTime,
        metadata: res.metadata,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Agent execution failed";
      return {
        success: false,
        data: null,
        confidence: 0,
        reasoning: `Execution Error: ${message}`,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  public abstract run(input: TInput): Promise<AgentOutput<TOutput>>;
}
