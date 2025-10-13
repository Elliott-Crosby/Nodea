"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { decryptApiKey } from "./keys";
import { requireAuth, checkRateLimit } from "./security";
import { serverEnv } from "./config";

// Helper function to determine if web search should be enabled
function shouldEnableWebSearch(messages: any[]): boolean {
  const lastUserMessage = messages.filter(m => m.role === "user").pop();
  if (!lastUserMessage) return false;
  
  const content = lastUserMessage.content.toLowerCase();
  return (
    content.includes("search") ||
    content.includes("current") ||
    content.includes("recent") ||
    content.includes("latest") ||
    content.includes("news") ||
    content.includes("today") ||
    content.includes("2024") ||
    content.includes("2025") ||
    content.includes("what is") ||
    content.includes("who is") ||
    content.includes("when did") ||
    content.includes("where is") ||
    content.includes("how does") ||
    content.includes("explain") ||
    content.includes("tell me about") ||
    content.includes("internet") ||
    content.includes("web") ||
    content.includes("online")
  );
}

export const complete = action({
  args: {
    boardId: v.id("boards"),
    nodeId: v.optional(v.id("nodes")),
    responseNodeId: v.optional(v.id("nodes")),
    userId: v.id("users"),
    boardData: v.optional(v.object({
      defaultApiKeyId: v.optional(v.id("apiKeys")),
    })),
    messages: v.array(v.object({
      role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
      content: v.string(),
    })),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Use the passed userId instead of trying to get it from auth context
    const userId = args.userId;

    // Determine if web search should be enabled
    const enableWebSearch = shouldEnableWebSearch(args.messages);

    const provider = args.provider || "openai";
    const model = args.model || "gpt-5-mini";
    const temperature = args.temperature || 0.2;
    const maxTokens = Math.min(args.maxTokens || 400, 600); // Hard ceiling: never exceed 600 tokens

    // Find API key (board default -> user key -> system key)
    let apiKey = null;
    if (args.boardData?.defaultApiKeyId) {
      const key = await ctx.runQuery(internal.keys.getApiKey, { keyId: args.boardData.defaultApiKeyId });
      if (key && key.provider === provider) {
        apiKey = await decryptApiKey(key.encryptedKey);
      }
    }

    if (!apiKey) {
      // Try system key from environment
      if (provider === "openai") {
        apiKey = process.env.CONVEX_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      }
    }

    if (!apiKey) {
      throw new Error(`No ${provider} API key found. Please add one in settings.`);
    }

    // Make the API call
    let response;
    let inputTokens = 0;
    let outputTokens = 0;

    // Security: No logging of sensitive data (messages, API keys, etc.)

    try {
      if (provider === "openai") {
        const result = await callOpenAI(apiKey, model, args.messages, temperature, maxTokens, enableWebSearch);
        response = result.text;
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
      } else {
        throw new Error(`Provider ${provider} not yet supported`);
      }

      // Record usage
      await ctx.runMutation(internal.usage.recordUsage, {
        userId,
        boardId: args.boardId,
        nodeId: args.nodeId,
        provider,
        model,
        inputTokens,
        outputTokens,
        costEstimate: calculateCost(provider, model, inputTokens, outputTokens),
        status: "success",
      });

      // Update the response node if this was called from generateFromMessage
      if (args.responseNodeId) {
        await ctx.runMutation(api.nodes.updateResponseNode, {
          nodeId: args.responseNodeId,
          content: response,
          model,
          tokens: { input: inputTokens, output: outputTokens },
        });
      }

      return {
        text: response,
        model,
        tokens: { input: inputTokens, output: outputTokens },
      };

    } catch (error) {
      // Record failed usage
      await ctx.runMutation(internal.usage.recordUsage, {
        userId,
        boardId: args.boardId,
        nodeId: args.nodeId,
        provider,
        model,
        inputTokens: 0,
        outputTokens: 0,
        costEstimate: 0,
        status: "error",
      });

      throw error;
    }
  },
});

export const completeStream = action({
  args: {
    boardId: v.id("boards"),
    nodeId: v.optional(v.id("nodes")),
    responseNodeId: v.optional(v.id("nodes")),
    userId: v.id("users"),
    boardData: v.optional(v.object({
      defaultApiKeyId: v.optional(v.id("apiKeys")),
    })),
    messages: v.array(v.object({
      role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
      content: v.string(),
    })),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Use the passed userId instead of trying to get it from auth context
    const userId = args.userId;

    // Determine if web search should be enabled
    const enableWebSearch = shouldEnableWebSearch(args.messages);

    const provider = args.provider || "openai";
    const model = args.model || "gpt-5-mini";
    const temperature = args.temperature || 0.2;
    const maxTokens = Math.min(args.maxTokens || 400, 600); // Hard ceiling: never exceed 600 tokens

    // Find API key (board default -> user key -> system key)
    let apiKey = null;
    if (args.boardData?.defaultApiKeyId) {
      const key = await ctx.runQuery(internal.keys.getApiKey, { keyId: args.boardData.defaultApiKeyId });
      if (key && key.provider === provider) {
        apiKey = await decryptApiKey(key.encryptedKey);
      }
    }

    if (!apiKey) {
      // Try system key from environment
      if (provider === "openai") {
        apiKey = process.env.CONVEX_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      }
    }

    if (!apiKey) {
      throw new Error(`No ${provider} API key found. Please add one in settings.`);
    }

    let fullResponse = "";
    let inputTokens = 0;
    let outputTokens = 0;

    // Security: No logging of sensitive data (messages, API keys, etc.)

    try {
      if (provider === "openai") {
        for await (const chunk of callOpenAIStream(apiKey, model, args.messages, temperature, maxTokens, enableWebSearch)) {
          if (chunk.done) {
            inputTokens = chunk.inputTokens;
            outputTokens = chunk.outputTokens;
            break;
          }
          
          fullResponse += chunk.content;
          
          // Update the response node incrementally only if we're not in a function call context
          if (args.responseNodeId && !enableWebSearch) {
            try {
              await ctx.runMutation(api.nodes.updateResponseNode, {
                nodeId: args.responseNodeId,
                content: fullResponse,
                model,
                tokens: { input: 0, output: 0 }, // Temporary tokens during streaming
              });
            } catch (error) {
              // Security: Log error without sensitive data
              console.error('Error updating response node during streaming');
              // Continue streaming even if node update fails
            }
          }
        }
      } else {
        throw new Error(`Provider ${provider} not yet supported`);
      }

      // Record usage
      await ctx.runMutation(internal.usage.recordUsage, {
        userId,
        boardId: args.boardId,
        nodeId: args.nodeId,
        provider,
        model,
        inputTokens,
        outputTokens,
        costEstimate: calculateCost(provider, model, inputTokens, outputTokens),
        status: "success",
      });

      // Final update with token counts
      if (args.responseNodeId) {
        try {
          await ctx.runMutation(api.nodes.updateResponseNode, {
            nodeId: args.responseNodeId,
            content: fullResponse,
            model,
            tokens: { input: inputTokens, output: outputTokens },
          });
        } catch (error) {
          // Security: Log error without sensitive data
          console.error('Error updating response node at end');
          // Continue without failing the entire operation
        }
      }

      return {
        text: fullResponse,
        model,
        tokens: { input: inputTokens, output: outputTokens },
      };

    } catch (error) {
      // Record failed usage
      await ctx.runMutation(internal.usage.recordUsage, {
        userId,
        boardId: args.boardId,
        nodeId: args.nodeId,
        provider,
        model,
        inputTokens: 0,
        outputTokens: 0,
        costEstimate: 0,
        status: "error",
      });

      throw error;
    }
  },
});

async function callOpenAI(
  apiKey: string, 
  model: string, 
  messages: any[], 
  temperature: number, 
  maxTokens: number,
  enableWebSearch: boolean = false
) {
  // Map gpt-5 to gpt-4o for now, gpt-5-mini to gpt-4o-mini
  // Use gpt-4o for all models to support tools
  const actualModel = model === "gpt-5" ? "gpt-4o" : 
                     model === "gpt-5-mini" ? "gpt-4o-mini" : 
                     "gpt-4o";

  // Prepare messages with system prompt if web search is enabled
  let finalMessages = messages;
  if (enableWebSearch) {
    finalMessages = [
      {
        role: "system",
        content: "You have access to a web search function. Use it whenever you need current information, recent news, or any data that might be newer than your training data. Do not say you cannot browse the internet - you can search the web using the web_search function."
      },
      ...messages
    ];
  }

  const requestBody: any = {
    model: actualModel,
    messages: finalMessages,
    temperature,
    max_tokens: maxTokens,
  };

  // Add native OpenAI web search tool if enabled
  if (enableWebSearch) {
    requestBody.tools = [
      {
        type: "web_search"
      }
    ];
  }

  const response = await fetch(serverEnv.openAiChatCompletionsUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  
  // OpenAI's native web search tool handles everything automatically
  
  return {
    text: data.choices[0].message.content,
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  };
}

async function* callOpenAIStream(
  apiKey: string, 
  model: string, 
  messages: any[], 
  temperature: number, 
  maxTokens: number,
  enableWebSearch: boolean = false
): AsyncGenerator<{content: string, inputTokens: number, outputTokens: number, done?: boolean}, void, unknown> {
  // Map gpt-5 to gpt-4o for now, gpt-5-mini to gpt-4o-mini
  // Use gpt-4o for all models to support tools
  const actualModel = model === "gpt-5" ? "gpt-4o" : 
                     model === "gpt-5-mini" ? "gpt-4o-mini" : 
                     "gpt-4o";

  // Prepare messages with system prompt if web search is enabled
  let finalMessages = messages;
  if (enableWebSearch) {
    finalMessages = [
      {
        role: "system",
        content: "You have access to a web search function. Use it whenever you need current information, recent news, or any data that might be newer than your training data. Do not say you cannot browse the internet - you can search the web using the web_search function."
      },
      ...messages
    ];
  }

  const requestBody: any = {
    model: actualModel,
    messages: finalMessages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  // Add native OpenAI web search tool if enabled
  if (enableWebSearch) {
    requestBody.tools = [
      {
        type: "web_search"
      }
    ];
  }

  const response = await fetch(serverEnv.openAiChatCompletionsUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body reader available");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6);
          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            
            if (delta?.content) {
              yield {
                content: delta.content,
                inputTokens: parsed.usage?.prompt_tokens || 0,
                outputTokens: parsed.usage?.completion_tokens || 0,
              };
            }
            if (parsed.usage) {
              inputTokens = parsed.usage.prompt_tokens || 0;
              outputTokens = parsed.usage.completion_tokens || 0;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Return final token counts
  yield {
    content: "",
    inputTokens,
    outputTokens,
    done: true,
  };
}

function calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  // Placeholder cost calculation
  if (provider === "openai") {
    if (model.includes("gpt-4")) {
      return (inputTokens * 0.00003 + outputTokens * 0.00006);
    }
  }
  return 0;
}
