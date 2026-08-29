import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import type { NodeKind } from "@studio/shared";
import { useBuilder } from "../lib/builder.ts";
import { NODE_KINDS } from "../lib/nodeKinds.ts";
import { FlowNode, type StudioNode } from "./FlowNode.tsx";

const nodeTypes = { studio: FlowNode };

export const PALETTE_MIME = "application/x-studio-node";

function CanvasInner({ showCosts }: { showCosts: boolean }) {
  const workflow = useBuilder((state) => state.workflow);
  const runtime = useBuilder((state) => state.runtime);
  const issues = useBuilder((state) => state.issues);
  const selectedNodeId = useBuilder((state) => state.selectedNodeId);
  const { select, moveNode, removeNode, addNode, addEdge, removeEdge } = useBuilder.getState();

  const wrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();

  // Opening or closing the side panels resizes the canvas. React Flow only
  // fits on mount, so without this the graph ends up half off-screen.
  useEffect(() => {
    const element = wrapper.current;
    if (!element) return;
    let lastWidth = element.clientWidth;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      const width = element.clientWidth;
      if (Math.abs(width - lastWidth) < 24) return;
      lastWidth = width;
      clearTimeout(timer);
      timer = setTimeout(() => void fitView({ padding: 0.25, maxZoom: 1, duration: 220 }), 90);
    });
    observer.observe(element);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [fitView]);

  const errorNodeIds = useMemo(
    () => new Set(issues.filter((issue) => issue.level === "error").map((issue) => issue.nodeId)),
    [issues],
  );

  const nodes = useMemo<StudioNode[]>(
    () =>
      (workflow?.nodes ?? []).map((node) => ({
        id: node.id,
        type: "studio" as const,
        position: node.position,
        selected: node.id === selectedNodeId,
        data: {
          node,
          runtime: runtime[node.id] ?? null,
          hasError: errorNodeIds.has(node.id),
          showCosts,
        },
      })),
    [workflow?.nodes, runtime, selectedNodeId, errorNodeIds, showCosts],
  );

  const edges = useMemo<Edge[]>(
    () =>
      (workflow?.edges ?? []).map((edge) => {
        const sourceRuntime = runtime[edge.source];
        // A router that has chosen greys out the branches it did not take.
        const isDead =
          Boolean(sourceRuntime?.selectedRoute) &&
          Boolean(edge.sourceHandle) &&
          sourceRuntime?.selectedRoute !== edge.sourceHandle;
        const isLive =
          sourceRuntime?.status === "succeeded" &&
          (!edge.sourceHandle || sourceRuntime.selectedRoute === edge.sourceHandle);

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          label: edge.label || undefined,
          type: "smoothstep",
          animated: sourceRuntime?.status === "running",
          className: isDead ? "dead" : isLive ? "live" : undefined,
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
        };
      }),
    [workflow?.edges, runtime],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<StudioNode>[]) => {
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          moveNode(change.id, change.position);
        } else if (change.type === "remove") {
          removeNode(change.id);
        } else if (change.type === "select" && change.selected) {
          select(change.id);
        }
      }
    },
    [moveNode, removeNode, select],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === "remove") removeEdge(change.id);
      }
    },
    [removeEdge],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      addEdge({
        id: `e_${connection.source}_${connection.target}_${connection.sourceHandle ?? "out"}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? null,
      });
    },
    [addEdge],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(PALETTE_MIME) as NodeKind;
      if (!kind || !NODE_KINDS[kind]) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(kind, { x: Math.round(position.x - 115), y: Math.round(position.y - 30) });
    },
    [addNode, screenToFlowPosition],
  );

  return (
    <div ref={wrapper} className="h-full w-full">
      <ReactFlow<StudioNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={() => select(null)}
        onDrop={onDrop}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#252a35" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          maskColor="rgba(10,11,15,0.75)"
          style={{ width: 148, height: 96 }}
          nodeStrokeWidth={6}
          nodeBorderRadius={3}
          nodeColor={(node) => {
            const data = node.data as StudioNode["data"];
            return NODE_KINDS[data.node.kind]?.color ?? "#4a5265";
          }}
        />
      </ReactFlow>
    </div>
  );
}

export default function Canvas({ showCosts }: { showCosts: boolean }) {
  return (
    <ReactFlowProvider>
      <CanvasInner showCosts={showCosts} />
    </ReactFlowProvider>
  );
}
