import { create } from "zustand";
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Edge,
} from "@xyflow/react";

import { CanvasNode, CanvasState, JobStatus, NozyGraph } from "../type/types";
import { get_handle_uid, GRAPH_CACHE_SESSION_KEY } from "@/utils/canvasUtils";
import { common_app } from "@/common_app/app";
import undoRedoInstance from "@/utils/undoRedo";
import { nanoid } from "nanoid";

// this is our useStore hook that we can use in our components to get parts of the store and call actions
const useAppStore = create<CanvasState>((set, get) => {
  const onGraphChange = () => {
    // any changes happen to the graph (nodes, edges, values, job_status) will trigger this
    const { workflow_id, nodes, edges, values, job_status, name } = get();
    common_app.graph.workflow_id = workflow_id;
    common_app.graph.nodes = nodes;
    common_app.graph.edges = edges;
    common_app.graph.values = values;
    common_app.graph.job_status = job_status ?? null;
    common_app.graph.name = name ?? null;
    sessionStorage.setItem(
      GRAPH_CACHE_SESSION_KEY,
      JSON.stringify({
        workflow_id,
        nodes,
        edges,
        values,
        name,
      })
    );
  };
  return {
    workflow_id: nanoid(),
    name: null, // workflow name
    nodes: [],
    edges: [],
    values: {},
    selectedNodeIDs: [],
    setSelectedNodeIDs: (node: string[]) => {
      set({ selectedNodeIDs: node });
    },
    updateValues: (change: Record<string, any>) => {
      let newValues = { ...get().values };
      for (const [key, value] of Object.entries(change)) {
        if (value === undefined) {
          delete newValues[key];
        } else {
          newValues[key] = value;
        }
      }
      set({ values: newValues });
      // save graph to session cache
      onGraphChange();
    },
    onNodesChange: (changes) => {
      undoRedoInstance.addUndoStack("onNodesChange", changes);
      set({
        nodes: applyNodeChanges(changes, get().nodes),
      });
      // remove values for removed nodes
      const removedNodeIds = changes
        .filter((change) => change.type === "remove")
        .map((change) => change.id);

      const newValues = { ...get().values };
      removedNodeIds.forEach((nodeId) => {
        Object.keys(newValues).forEach((key) => {
          if (key.includes(`node_${nodeId}`)) {
            delete newValues[key];
          }
        });
      });
      set({ values: newValues });

      onGraphChange();
    },
    onEdgesChange: (changes) => {
      undoRedoInstance.addUndoStack("onEdgesChange");
      set({
        edges: applyEdgeChanges(changes, get().edges),
      });
      onGraphChange();
    },
    onConnect: (connection) => {
      undoRedoInstance.addUndoStack("onConnect");
      set({
        edges: addEdge(connection, get().edges),
      });
      onGraphChange();
    },
    setNodes: (nodes) => {
      set({ nodes });
    },
    setEdges: (edges) => {
      set({ edges });
    },
    addNode: (node: CanvasNode) => {
      undoRedoInstance.addUndoStack("addNode");
      set({ nodes: get().nodes.concat(node) });
      // add values for new node
      const newValues = { ...get().values };
      node.data.input?.forEach((input) => {
        newValues[get_handle_uid("input", node.id, input.id!)] =
          input.default ?? null;
      });
      set({ values: newValues });
      onGraphChange();
    },
    loadGraph: (graph: NozyGraph) => {
      console.log("load graph", graph);
      set({
        workflow_id: graph.workflow_id,
        nodes: graph.nodes,
        edges: graph.edges,
        values: graph.values,
        job_status: graph.job_status ?? null,
        name: graph.name,
      });
      onGraphChange();
      undoRedoInstance.addUndoStack("init");
    },
    setJobStatus: (status: JobStatus) => {
      set({ job_status: status });
      onGraphChange();
    },
    setJobID: (job_id: string) => {
      set({ job_id });
    },
    setName: (name: string) => {
      set({ name });
      onGraphChange();
    },
  };
});

export default useAppStore;
