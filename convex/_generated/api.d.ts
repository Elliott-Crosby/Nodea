import type { FunctionReference, FunctionReturnType } from "convex/server";
import type { GenericQueryCtx, GenericMutationCtx, GenericActionCtx } from "convex/server";
import type { Doc, Id } from "./dataModel";

export type Api = {
  queries: {
    getBoard: FunctionReference<"query", "boards", "getBoard">;
    listBoards: FunctionReference<"query", "boards", "listBoards">;
    getNode: FunctionReference<"query", "nodes", "getNode">;
    listNodes: FunctionReference<"query", "nodes", "listNodes">;
    listEdges: FunctionReference<"query", "edges", "listEdges">;
    getUserProfile: FunctionReference<"query", "userProfiles", "getUserProfile">;
  };
  mutations: {
    createBoard: FunctionReference<"mutation", "boards", "createBoard">;
    updateBoardMeta: FunctionReference<"mutation", "boards", "updateBoardMeta">;
    deleteBoard: FunctionReference<"mutation", "boards", "deleteBoard">;
    createNode: FunctionReference<"mutation", "nodes", "createNode">;
    updateNode: FunctionReference<"mutation", "nodes", "updateNode">;
    deleteNode: FunctionReference<"mutation", "nodes", "deleteNode">;
    createEdge: FunctionReference<"mutation", "edges", "createEdge">;
    deleteEdge: FunctionReference<"mutation", "edges", "deleteEdge">;
    updateAccessMetadata: FunctionReference<"mutation", "boards", "updateAccessMetadata">;
  };
  actions: {};
};

export type Query = Api["queries"];
export type Mutation = Api["mutations"];
export type Action = Api["actions"];

export type QueryNames = keyof Query;
export type MutationNames = keyof Mutation;
export type ActionNames = keyof Action;

export type QueryReturnType<QueryName extends QueryNames> = FunctionReturnType<Query[QueryName]>;

export type MutationReturnType<MutationName extends MutationNames> = FunctionReturnType<Mutation[MutationName]>;

export type ActionReturnType<ActionName extends ActionNames> = FunctionReturnType<Action[ActionName]>;

export const api = {
  queries: {
    getBoard: "boards:getBoard" as const,
    listBoards: "boards:listBoards" as const,
    getNode: "nodes:getNode" as const,
    listNodes: "nodes:listNodes" as const,
    listEdges: "edges:listEdges" as const,
    getUserProfile: "userProfiles:getUserProfile" as const,
  },
  mutations: {
    createBoard: "boards:createBoard" as const,
    updateBoardMeta: "boards:updateBoardMeta" as const,
    deleteBoard: "boards:deleteBoard" as const,
    createNode: "nodes:createNode" as const,
    updateNode: "nodes:updateNode" as const,
    deleteNode: "nodes:deleteNode" as const,
    createEdge: "edges:createEdge" as const,
    deleteEdge: "edges:deleteEdge" as const,
    updateAccessMetadata: "boards:updateAccessMetadata" as const,
  },
  actions: {},
} as const;
