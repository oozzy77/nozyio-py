import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  type NodeTypes,
  Controls,
  ControlButton,
  Background,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import { useTheme } from "@/components/ui/theme-provider";
import { IconArrowBackUp, IconArrowForwardUp } from "@tabler/icons-react";
import { useDnD } from "./DnDContext";
import { CanvasNode, CanvasState } from "@/type/types";
import ASTFunctionNode from "./nodes/ASTFunctionNode";
import useAppStore from "./store";
import { useShallow } from "zustand/react/shallow";
import { GRAPH_CACHE_SESSION_KEY } from "@/utils/canvasUtils";
import undoRedoInstance from "@/utils/undoRedo";
import { common_app, fetchApi } from "@/common_app/app";

const selector = (state: CanvasState) => ({
  nodes: state.nodes,
  edges: state.edges,
  onNodesChange: state.onNodesChange,
  onEdgesChange: state.onEdgesChange,
  setJobStatus: state.setJobStatus,
  onConnect: state.onConnect,
  addNode: state.addNode,
  loadGraph: state.loadGraph,
  setSelectedNodeIDs: state.setSelectedNodeIDs,
});

const nodeTypes: NodeTypes = {
  astFunction: ASTFunctionNode,
};

export function FlowCanvas() {
  const { theme } = useTheme();
  const { screenToFlowPosition } = useReactFlow();
  const { dropingNode, setDropingNode } = useDnD();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    loadGraph,
    setSelectedNodeIDs,
    setJobStatus,
  } = useAppStore(useShallow(selector));

  useEffect(() => {
    // restore graph from session cache
    const graphStr = sessionStorage.getItem(GRAPH_CACHE_SESSION_KEY);
    if (graphStr) {
      loadGraph(JSON.parse(graphStr));
      // refresh node def
      fetchApi("/refresh_node_def", {
        method: "POST",
        body: graphStr,
      })
        .then((res) => res.json())
        .then((graph) => {
          loadGraph(graph);
        });
    }

    console.log("connecting to websocket", common_app.wsUrl);
    const ws = new WebSocket(common_app.wsUrl);
    ws.onopen = () => {
      console.log("websocket connected");
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      window.dispatchEvent(new CustomEvent("message", { detail: message }));
      console.log("message", message);
      if (message.type === "job_status" && message.data) {
        setJobStatus(message.data);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const getNextNodeID = useCallback(() => {
    let start = 1;
    while (start < nodes.length + 1) {
      if (nodes.every((node) => node.id !== start.toString())) {
        return start.toString();
      }
      start++;
    }
    return start.toString();
  }, [nodes]);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      // check if dropping node in progress
      if (!dropingNode) {
        return;
      }
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const newNode: CanvasNode = {
        id: getNextNodeID(),
        data: dropingNode,
        position: position,
        type: "astFunction",
      };

      addNode(newNode);
      setDropingNode(null);
    },
    [screenToFlowPosition, dropingNode]
  );

  return (
    <ReactFlow
      nodes={nodes}
      nodeTypes={nodeTypes}
      edges={edges}
      colorMode={theme}
      //   edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onConnect={onConnect}
      fitView
      fitViewOptions={{
        padding: 0.2,
      }}
      defaultEdgeOptions={{}}
      onNodeClick={(_event, node) => {
        console.log("node click #" + node.id);
        setSelectedNodeIDs([node.id]);
      }}
      onPaneClick={() => {
        console.log("pane click");
        setSelectedNodeIDs([]);
      }}
    >
      <Background />
      <Controls orientation="horizontal">
        <ControlButton onClick={undoRedoInstance.undo}>
          <IconArrowBackUp
            size={16}
            className="!fill-[none] !max-w-4 !max-h-4"
          />
        </ControlButton>
        <ControlButton onClick={undoRedoInstance.redo}>
          <IconArrowForwardUp
            size={16}
            className="!fill-[none] !max-w-4 !max-h-4"
          />
        </ControlButton>
      </Controls>
    </ReactFlow>
  );
}

export default function FlowCanvasWithProvider() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}
