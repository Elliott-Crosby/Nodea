"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import { decryptApiKey } from "./keys";
import { requireAuth, checkRateLimit } from "./security";
import { 
  validateNodeContent, 
  validateModelName, 
  validateProviderName,
  validateTemperature,
  validateMaxTokens 
} from "./validation";
import { startRequestTracking, completeRequestTracking } from "./observability";
import { logFunctionEntry, logFunctionExit, logApiCall, logError } from "./logging";
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
    messages: v.array(v.object({
      role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
      content: v.string(),
    })),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    enableWebSearch: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Security: Require authentication
    const authenticatedUserId = await requireAuth(ctx);
    const requestId = startRequestTracking("llm.complete", authenticatedUserId);
    const startTime = Date.now();
    
    try {
      logFunctionEntry("llm.complete", requestId, authenticatedUserId);
      
      // Security: Rate limiting
      if (!checkRateLimit(`llm:${authenticatedUserId}`, 50, 60000)) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
    
    // Security: Verify user owns the board
    const board = await ctx.runQuery(api.boards.getBoard, { boardId: args.boardId });
    if (!board || board.ownerUserId !== authenticatedUserId) {
      throw new Error("Access denied. You can only access your own boards.");
    }
    
    // Validate and sanitize inputs
    const validatedProvider = args.provider ? validateProviderName(args.provider) : "openai";
    const validatedModel = args.model ? validateModelName(args.model) : "gpt-4o";
    const validatedTemperature = validateTemperature(args.temperature);
    const validatedMaxTokens = validateMaxTokens(args.maxTokens);
    
    // Validate messages content
    const validatedMessages = args.messages.map(msg => ({
      ...msg,
      content: validateNodeContent(msg.content)
    }));
    
    // Use the authenticated userId for security
    const userId = authenticatedUserId;

    // Determine if web search should be enabled
    const enableWebSearch = shouldEnableWebSearch(validatedMessages);

    const provider = validatedProvider;
    const model = validatedModel;
    const temperature = validatedTemperature;
    const maxTokens = validatedMaxTokens;

    // Get API key for the user
    const apiKeys = await ctx.runQuery(api.keys.listApiKeys, {});
    const apiKey = apiKeys.find(key => key.provider === provider);
    
    if (!apiKey) {
      throw new Error(`No API key found for provider: ${provider}`);
    }

    const keyData = await ctx.runQuery(api.keys.getEncryptedKey, { keyId: apiKey._id });
    const decryptedKey = await decryptApiKey(keyData.encryptedKey);
    
    if (!decryptedKey) {
      throw new Error("Failed to decrypt API key");
    }

    // Call OpenAI API
    const response = await fetch(serverEnv.openAiChatCompletionsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${decryptedKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: validatedMessages,
        temperature: temperature,
        max_tokens: maxTokens,
        tools: enableWebSearch ? [{ type: "web_search" }] : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    
    // Update the response node with the completion
    if (args.responseNodeId) {
      await ctx.runMutation(api.nodes.updateResponseNode, {
        nodeId: args.responseNodeId,
        content: data.choices[0].message.content,
        model: validatedModel,
        tokens: {
          input: data.usage?.prompt_tokens || 0,
          output: data.usage?.completion_tokens || 0,
        },
      });
    }

      const result = {
        text: data.choices[0].message.content,
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      };

      // Log successful completion
      logFunctionExit("llm.complete", requestId, Date.now() - startTime, 'success', authenticatedUserId, result.inputTokens + result.outputTokens);
      completeRequestTracking(requestId, 'completed', result.inputTokens + result.outputTokens);

      return result;
    } catch (error) {
      // Log error and complete tracking
      logError("LLM completion failed", error instanceof Error ? error : String(error), {
        requestId,
        functionName: "llm.complete",
        userId: authenticatedUserId
      });
      completeRequestTracking(requestId, 'failed', undefined, undefined, error instanceof Error ? error.message : String(error));
      throw error;
    }
  },
});

export const completeStream = action({
  args: {
    boardId: v.id("boards"),
    nodeId: v.optional(v.id("nodes")),
    responseNodeId: v.optional(v.id("nodes")),
    messages: v.array(v.object({
      role: v.union(v.literal("system"), v.literal("user"), v.literal("assistant")),
      content: v.string(),
    })),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    enableWebSearch: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Security: Require authentication
    const authenticatedUserId = await requireAuth(ctx);
    
    // Security: Rate limiting
    if (!checkRateLimit(`llm-stream:${authenticatedUserId}`, 30, 60000)) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }
    
    // Security: Verify user owns the board
    const board = await ctx.runQuery(api.boards.getBoard, { boardId: args.boardId });
    if (!board || board.ownerUserId !== authenticatedUserId) {
      throw new Error("Access denied. You can only access your own boards.");
    }
    
    // Validate and sanitize inputs
    const validatedProvider = args.provider ? validateProviderName(args.provider) : "openai";
    const validatedModel = args.model ? validateModelName(args.model) : "gpt-4o";
    const validatedTemperature = validateTemperature(args.temperature);
    const validatedMaxTokens = validateMaxTokens(args.maxTokens);
    
    // Validate messages content
    const validatedMessages = args.messages.map(msg => ({
      ...msg,
      content: validateNodeContent(msg.content)
    }));
    
    // Use the authenticated userId for security
    const userId = authenticatedUserId;

    // Determine if web search should be enabled
    const enableWebSearch = shouldEnableWebSearch(validatedMessages);

    const provider = validatedProvider;
    const model = validatedModel;
    const temperature = validatedTemperature;
    const maxTokens = validatedMaxTokens;

    // Get API key for the user
    const apiKeys = await ctx.runQuery(api.keys.listApiKeys, {});
    const apiKey = apiKeys.find(key => key.provider === provider);
    
    if (!apiKey) {
      throw new Error(`No API key found for provider: ${provider}`);
    }

    const keyData = await ctx.runQuery(api.keys.getEncryptedKey, { keyId: apiKey._id });
    const decryptedKey = await decryptApiKey(keyData.encryptedKey);
    
    if (!decryptedKey) {
      throw new Error("Failed to decrypt API key");
    }

    // Call OpenAI API with streaming
    const response = await fetch(serverEnv.openAiChatCompletionsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${decryptedKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: validatedMessages,
        temperature: temperature,
        max_tokens: maxTokens,
        stream: true,
        tools: enableWebSearch ? [{ type: "web_search" }] : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body reader available");
    }

    let fullResponse = "";
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                
                // Update the response node with streaming content
                if (args.responseNodeId) {
                  await ctx.runMutation(api.nodes.updateResponseNodeStream, {
                    nodeId: args.responseNodeId,
                    content: fullResponse,
                    model: validatedModel,
                  });
                }
              }

              // Track token usage
              if (parsed.usage) {
                inputTokens = parsed.usage.prompt_tokens || 0;
                outputTokens = parsed.usage.completion_tokens || 0;
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Final update with token counts
    if (args.responseNodeId) {
      await ctx.runMutation(api.nodes.updateResponseNode, {
        nodeId: args.responseNodeId,
        content: fullResponse,
        model: validatedModel,
        tokens: {
          input: inputTokens,
          output: outputTokens,
        },
      });
    }

    return {
      text: fullResponse,
      inputTokens,
      outputTokens,
    };
  },
});
