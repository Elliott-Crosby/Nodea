import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Controls,
  MiniMap,
  Background,
  ReactFlowProvider,
  useReactFlow,
} from "reactflow";
import "reactflow/dist/style.css";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import NodeCard from "./NodeCard";
import FABNewPrompt from "./FABNewPrompt";
import ZoomControls from "./ZoomControls";
import CustomCurvedEdge from "./CustomCurvedEdge";
import { useBoardState } from "../state/useBoardState";
import { Map } from "./icons";

const nodeTypes = {
  nodeCard: NodeCard,
};

const edgeTypes = {
  curved: CustomCurvedEdge,
  default: CustomCurvedEdge, // Use custom curved edge as default
  step: CustomCurvedEdge,   // Use custom curved edge for step connections too
};

interface CanvasProps {
  boardId: Id<"boards">;
}

function CanvasInner({ boardId }: CanvasProps) {
  const { fitView, getViewport } = useReactFlow();
  const nodes = useQuery(api.nodes.listNodesByBoard, { boardId });
  const edges = useQuery(api.edges.listEdgesByBoard, { boardId });
  const createNode = useMutation(api.nodes.createNode);
  const updateNode = useMutation(api.nodes.updateNode);
  const createEdge = useMutation(api.edges.createEdge);
  const deleteEdge = useMutation(api.edges.deleteEdge);

  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesState([]);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState([]);
  const [showMiniMap, setShowMiniMap] = useState(true);
  
  // Debug minimap state
  console.log('MiniMap state:', showMiniMap);
  console.log('ReactFlow nodes count:', reactFlowNodes.length);
  console.log('ReactFlow edges count:', reactFlowEdges.length);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);

  const { selectedNodeId, setSelectedNodeId } = useBoardState();

  // Convert Convex nodes to ReactFlow nodes
  useEffect(() => {
    if (nodes) {
      const flowNodes: Node[] = nodes.map((node) => ({
        id: node._id,
        type: "nodeCard",
        position: node.position,
        data: {
          ...node,
          position: node.position, // Include position in data
          isSelected: selectedNodeId === node._id,
          boardId: boardId,
        },
        selected: selectedNodeId === node._id,
      }));
      setReactFlowNodes(flowNodes);
    }
  }, [nodes, selectedNodeId, setReactFlowNodes]);

  // Convert Convex edges to ReactFlow edges
  useEffect(() => {
    if (edges) {
      const flowEdges: Edge[] = edges.map((edge) => ({
        id: edge._id,
        source: edge.srcNodeId,
        target: edge.dstNodeId,
        type: "curved", // Use our custom curved edge for all connections
        style: {
          stroke: edge.kind === "lineage" ? "#6366f1" : "#9ca3af",
          strokeWidth: 3,
          strokeDasharray: edge.kind === "reference" ? "8,4" : undefined,
        },
        data: {
          kind: edge.kind,
        },
        label: edge.label,
      }));
      setReactFlowEdges(flowEdges);
    }
  }, [edges, setReactFlowEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        createEdge({
          boardId,
          srcNodeId: params.source as Id<"nodes">,
          dstNodeId: params.target as Id<"nodes">,
          kind: "reference",
        });
      }
    },
    [boardId, createEdge]
  );

  const onConnectStart = useCallback(
    (event: any, { nodeId, handleId }: any) => {
      // Store the source node for connection
      setConnectionSource(nodeId);
    },
    []
  );

  const onConnectEnd = useCallback(
    (event: any) => {
      const targetNode = event.target.closest('[data-id]');
      if (targetNode && connectionSource) {
        const targetNodeId = targetNode.getAttribute('data-id');
        if (targetNodeId && targetNodeId !== connectionSource) {
          createEdge({
            boardId,
            srcNodeId: connectionSource as Id<"nodes">,
            dstNodeId: targetNodeId as Id<"nodes">,
            kind: "reference",
          });
        }
      }
      setConnectionSource(null);
    },
    [boardId, createEdge, connectionSource]
  );

  const onNodeDragStop = useCallback(
    (event: any, node: Node) => {
      updateNode({
        nodeId: node.id as Id<"nodes">,
        position: node.position,
      });
    },
    [updateNode]
  );

  const onNodeClick = useCallback(
    (event: any, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const onEdgeDoubleClick = useCallback(
    (event: any, edge: Edge) => {
      event.stopPropagation();
      deleteEdge({ edgeId: edge.id as Id<"edges"> });
    },
    [deleteEdge]
  );

  const handleCreateMessage = useCallback(
    async (position?: { x: number; y: number }) => {
      const viewport = getViewport();
      const centerX = (-viewport.x + window.innerWidth / 2) / viewport.zoom;
      const centerY = (-viewport.y + window.innerHeight / 2) / viewport.zoom;

      await createNode({
        boardId,
        type: "message",
        role: "user",
        content: "",
        position: position || { x: centerX, y: centerY },
      });
    },
    [boardId, createNode, getViewport]
  );

  const handleCreateNote = useCallback(
    async (position?: { x: number; y: number }) => {
      const viewport = getViewport();
      const centerX = (-viewport.x + window.innerWidth / 2) / viewport.zoom;
      const centerY = (-viewport.y + window.innerHeight / 2) / viewport.zoom;

      await createNode({
        boardId,
        type: "note",
        content: "",
        position: position || { x: centerX, y: centerY },
      });
    },
    [boardId, createNode, getViewport]
  );

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        snapToGrid
        snapGrid={[32, 32]}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1}
        maxZoom={2}
        className="bg-gray-50"
      >
        <Background
          gap={32}
          size={6}
          color="rgba(0, 0, 0, 0.03)"
          variant="dots"
        />
        
        <Controls
          showZoom={false}
          showFitView={false}
          showInteractive={false}
          position="bottom-left"
        />
        <ZoomControls />
        <MiniMap />
      </ReactFlow>

      <FABNewPrompt onCreateMessage={handleCreateMessage} onCreateNote={handleCreateNote} />

      {/* Minimap toggle */}
      <button
        onClick={() => setShowMiniMap(!showMiniMap)}
        className={`absolute top-4 right-4 p-2 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow ${
          showMiniMap ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-gray-600'
        }`}
        title="Toggle Minimap"
      >
        <Map size={16} />
      </button>
    </div>
  );
}

export default function Canvas({ boardId }: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner boardId={boardId} />
    </ReactFlowProvider>
  );
}
