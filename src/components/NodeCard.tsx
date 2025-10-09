import { useState, useCallback, useEffect, useRef } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Bot, Clock, User, Trash2, StickyNote, GripVertical, GitBranch, ChevronDown, Copy } from "./icons";

interface NodeData {
  _id: string;
  type: "prompt" | "message" | "response" | "note" | "frame";
  role?: "user" | "assistant";
  title?: string;
  content: string;
  collapsed: boolean;
  color?: string;
  position: { x: number; y: number };
  meta: {
    model?: string;
    provider?: string;
    tokens?: {
      input: number;
      output: number;
    };
  };
  isSelected?: boolean;
  boardId?: string;
}

export default function NodeCard({ data, selected }: NodeProps<NodeData>) {
  const [isGenerating, setIsGenerating] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  const updateNode = useMutation((api as any).nodes.updateNode);
  const deleteNode = useMutation((api as any).nodes.deleteNode);
  const generateFromMessage = useMutation((api as any).nodes.generateFromMessage);
  const generateFromAssistant = useMutation((api as any).nodes.generateFromAssistant);
  const generateContinuation = useMutation((api as any).nodes.generateContinuation);
  const createNode = useMutation((api as any).nodes.createNode);
  const createEdge = useMutation((api as any).edges.createEdge);
  const deleteEdge = useMutation((api as any).edges.deleteEdge);

  const handleFormSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const content = formData.get('content') as string;
    
    if (content !== data.content) {
      await updateNode({
        nodeId: data._id as Id<"nodes">,
        content: content,
      });
    }
  }, [updateNode, data._id, data.content]);

  // Auto-save on blur (when user clicks away)
  const handleBlur = useCallback(async (e: React.FocusEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    if (content !== data.content) {
      await updateNode({
        nodeId: data._id as Id<"nodes">,
        content: content,
      });
    }
  }, [updateNode, data._id, data.content]);

  const handleContinuation = useCallback(async () => {
    if (!data.boardId) return;
    
    try {
      setIsGenerating(true);
      await generateContinuation({
        boardId: data.boardId as Id<"boards">,
        responseNodeId: data._id as Id<"nodes">,
      });
    } catch (error) {
      console.error("Failed to generate continuation:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [generateContinuation, data.boardId, data._id]);

  const handleAddNode = useCallback(async () => {
    if (!data.boardId) return;
    
    try {
      console.log("Creating new prompt node to the right of assistant:", data._id);
      
      // Create a new user message node to the right of the assistant node at the same y level
      const newUserNodeId = await createNode({
        boardId: data.boardId as Id<"boards">,
        type: "message",
        role: "user",
        content: "",
        position: {
          x: data.position.x + 700, // Place further to the right of the assistant node
          y: data.position.y, // Same y plane
        },
      });
      
      console.log("Created new node:", newUserNodeId);
      
      // Create an edge from the assistant node to the new user node
      await createEdge({
        boardId: data.boardId as Id<"boards">,
        srcNodeId: data._id as Id<"nodes">,
        dstNodeId: newUserNodeId,
        kind: "lineage",
        label: "",
      });
      
      console.log("Created edge from", data._id, "to", newUserNodeId);
    } catch (error) {
      console.error("Failed to add connected node:", error);
    }
  }, [data.boardId, data._id, data.position, createNode, createEdge]);

  // Auto-resize textarea when content changes (for generated responses)
  useEffect(() => {
    const textarea = document.querySelector(`textarea[name="content"][data-node-id="${data._id}"]`) as HTMLTextAreaElement;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(60, textarea.scrollHeight) + 'px';
    }
  }, [data.content, data._id]);

  const handleGenerate = useCallback(async () => {
    if (!data.boardId) return;
    
    try {
      setIsGenerating(true);
      await generateFromMessage({
        boardId: data.boardId as Id<"boards">,
        messageNodeId: data._id as Id<"nodes">,
      });
    } catch (error) {
      console.error("Failed to generate response:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [generateFromMessage, data.boardId, data._id]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(data.content);
      // You could add a toast notification here if you have one
      console.log("Content copied to clipboard");
    } catch (error) {
      console.error("Failed to copy content:", error);
    }
  }, [data.content]);

  const getNodeColor = () => {
    if (data.type === "note") {
      // Use the selected color or default to yellow
      const noteColor = data.color || "yellow";
      switch (noteColor) {
        case "yellow":
          return "border-yellow-300 bg-yellow-100 shadow-lg";
        case "red":
          return "border-red-300 bg-red-100 shadow-lg";
        case "blue":
          return "border-blue-300 bg-blue-100 shadow-lg";
        default:
          return "border-yellow-300 bg-yellow-100 shadow-lg";
      }
    }
    if (data.role === "assistant") {
      return "border-green-200 bg-green-50";
    } else if (data.role === "user") {
      return "border-blue-200 bg-blue-50";
    }
    // Fallback for other types
    switch (data.type) {
      case "prompt":
      case "message": return "border-blue-200 bg-blue-50";
      case "response": return "border-green-200 bg-green-50";
      case "frame": return "border-purple-200 bg-purple-50";
      default: return "border-gray-200 bg-white";
    }
  };

  const getPlaceholder = () => {
    if (data.type === "note") {
      return "Write a note...";
    }
    if (data.role === "assistant") {
      return "Generating...";
    }
    return "Enter your message...";
  };

  const getNodeWidth = () => {
    // Prompts are 25% smaller than other nodes
    if (data.type === "prompt" || data.type === "message") {
      return "min-w-[450px] max-w-[600px]";
    }
    // All other nodes (notes, responses) use the full doubled width
    return "min-w-[600px] max-w-[800px]";
  };

  return (
    <div 
      ref={nodeRef}
      data-id={data._id}
      className={`${getNodeWidth()} border-2 rounded-lg shadow-sm ${getNodeColor()} ${selected ? 'ring-2 ring-indigo-500' : ''} relative`} 
    >
      {/* Invisible handles for full-node connection */}
      <Handle type="target" position={Position.Top} className="w-40 h-40 opacity-0" />
      <Handle type="target" position={Position.Right} className="w-40 h-40 opacity-0" />
      <Handle type="target" position={Position.Bottom} className="w-40 h-40 opacity-0" />
      <Handle type="target" position={Position.Left} className="w-40 h-40 opacity-0" />
      
      {/* Visible connection handles */}
      <Handle type="target" position={Position.Top} className="w-12 h-12 bg-blue-500 border-2 border-white rounded-full shadow-lg" />
      <Handle type="target" position={Position.Right} className="w-12 h-12 bg-blue-500 border-2 border-white rounded-full shadow-lg" />
      <Handle type="target" position={Position.Bottom} className="w-12 h-12 bg-blue-500 border-2 border-white rounded-full shadow-lg" />
      <Handle type="target" position={Position.Left} className="w-12 h-12 bg-blue-500 border-2 border-white rounded-full shadow-lg" />
      
      <div className="p-4" style={{ pointerEvents: 'auto' }}>
        {/* Slim header with model chip and 3 icons */}
        <div className="flex items-center justify-between mb-3">
          {/* Left: Model chip */}
          <div className="flex items-center gap-2">
            <div className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md font-mono">
              GPT-5
            </div>
            {data.type === "note" ? (
              <>
                <StickyNote className={`w-3 h-3 ${data.color === "red" ? "text-red-600" : data.color === "blue" ? "text-blue-600" : "text-yellow-600"}`} />
                <span className={`text-xs font-medium ${data.color === "red" ? "text-red-700" : data.color === "blue" ? "text-blue-700" : "text-yellow-700"}`}>Note</span>
              </>
            ) : data.role === "assistant" ? (
              <>
                <Bot className="w-3 h-3 text-green-600" />
                <span className="text-xs font-medium text-green-700">Assistant</span>
              </>
            ) : data.role === "user" ? (
              <>
                <User className="w-3 h-3 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">User</span>
              </>
            ) : data.type === "response" ? (
              <>
                <Bot className="w-3 h-3 text-green-600" />
                <span className="text-xs font-medium text-green-700">Assistant</span>
              </>
            ) : (data.type === "message" || data.type === "prompt") ? (
              <>
                <User className="w-3 h-3 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">User</span>
              </>
            ) : null}
          </div>
          
          {/* Right: 3 icons */}
          <div className="flex items-center gap-1">
            {/* Copy button - only for assistant nodes */}
            {(data.role === "assistant" || data.type === "response") && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-600 transition-colors"
                title="Copy content"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
            
            {/* Collapse icon */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateNode({ nodeId: data._id as Id<"nodes">, collapsed: !data.collapsed });
              }}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
              title="Collapse/Expand"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${data.collapsed ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteNode({ nodeId: data._id as Id<"nodes"> });
              }}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600 transition-colors"
              title="Delete node"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
        
        {/* Color picker for sticky notes */}
        {data.type === "note" && (
          <div className="mb-3 flex gap-2">
            <span className="text-xs text-gray-500">Color:</span>
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateNode({ nodeId: data._id as Id<"nodes">, color: "yellow" });
                }}
                className={`w-4 h-4 rounded-full border-2 ${
                  (data.color || "yellow") === "yellow" 
                    ? "border-gray-400 bg-yellow-300" 
                    : "border-gray-200 bg-yellow-200 hover:bg-yellow-300"
                } transition-colors`}
                title="Yellow"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateNode({ nodeId: data._id as Id<"nodes">, color: "red" });
                }}
                className={`w-4 h-4 rounded-full border-2 ${
                  data.color === "red" 
                    ? "border-gray-400 bg-red-300" 
                    : "border-gray-200 bg-red-200 hover:bg-red-300"
                } transition-colors`}
                title="Light Red"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateNode({ nodeId: data._id as Id<"nodes">, color: "blue" });
                }}
                className={`w-4 h-4 rounded-full border-2 ${
                  data.color === "blue" 
                    ? "border-gray-400 bg-blue-300" 
                    : "border-gray-200 bg-blue-200 hover:bg-blue-300"
                } transition-colors`}
                title="Light Blue"
              />
            </div>
          </div>
        )}
        
        {/* Textarea that looks like regular text */}
        <form onSubmit={handleFormSubmit}>
          <textarea
            name="content"
            data-node-id={data._id}
            defaultValue={data.content}
            onChange={(e) => {
              // Auto-resize
              const target = e.target;
              target.style.height = 'auto';
              target.style.height = Math.max(60, target.scrollHeight) + 'px';
            }}
            onBlur={handleBlur}
            className="w-full px-0 py-0 text-sm bg-transparent border-none outline-none resize-none overflow-hidden min-h-[60px] focus:outline-none"
            placeholder={getPlaceholder()}
            style={{
              minHeight: '60px',
              height: 'auto',
            }}
          />
        </form>

        {/* Token count */}
        {data.meta?.tokens && (
          <div className="mt-2 text-xs text-gray-500">
            {data.meta.tokens.input + data.meta.tokens.output} tokens
          </div>
        )}

        {/* Generate button - for user nodes and message/prompt types, but not notes */}
        {(data.role === "user" || data.type === "message" || data.type === "prompt") && data.type !== "note" && (
          <div className="mt-3 flex justify-center">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md shadow-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              title="Generate Response"
            >
              {isGenerating ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" />
                  Generate
                </>
              )}
            </button>
          </div>
        )}

        {/* Follow-up buttons - for assistant nodes */}
        {(data.role === "assistant" || data.type === "response") && (
          <div className="mt-3 flex justify-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddNode();
              }}
              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors flex items-center gap-1"
              title="Add consecutive prompt"
            >
              <span>+</span>
              <span>add prompt</span>
            </button>
            
            {/* Continuation button - only show if response ends with CONTINUE? */}
            {data.content.trim().endsWith("CONTINUE?") && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleContinuation();
                }}
                disabled={isGenerating}
                className="px-3 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors flex items-center gap-1"
                title="Continue with more detail"
              >
                {isGenerating ? (
                  <>
                    <Clock className="w-3 h-3 animate-spin" />
                    Continuing...
                  </>
                ) : (
                  <>
                    <span>→</span>
                    <span>continue</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Invisible handles for full-node connection */}
      <Handle type="source" position={Position.Top} className="w-40 h-40 opacity-0" />
      <Handle type="source" position={Position.Right} className="w-40 h-40 opacity-0" />
      <Handle type="source" position={Position.Bottom} className="w-40 h-40 opacity-0" />
      <Handle type="source" position={Position.Left} className="w-40 h-40 opacity-0" />
      
      {/* Visible connection handles */}
      <Handle type="source" position={Position.Top} className="w-12 h-12 bg-green-500 border-2 border-white rounded-full shadow-lg" />
      <Handle type="source" position={Position.Right} className="w-12 h-12 bg-green-500 border-2 border-white rounded-full shadow-lg" />
      <Handle type="source" position={Position.Bottom} className="w-12 h-12 bg-green-500 border-2 border-white rounded-full shadow-lg" />
      <Handle type="source" position={Position.Left} className="w-12 h-12 bg-green-500 border-2 border-white rounded-full shadow-lg" />
    </div>
  );
}
