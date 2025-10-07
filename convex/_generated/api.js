export const api = {
  queries: {
    getBoard: "boards:getBoard",
    listBoards: "boards:listBoards", 
    getNode: "nodes:getNode",
    listNodes: "nodes:listNodes",
    listEdges: "edges:listEdges",
    getUserProfile: "userProfiles:getUserProfile",
  },
  mutations: {
    createBoard: "boards:createBoard",
    updateBoardMeta: "boards:updateBoardMeta",
    deleteBoard: "boards:deleteBoard",
    createNode: "nodes:createNode",
    updateNode: "nodes:updateNode",
    deleteNode: "nodes:deleteNode",
    createEdge: "edges:createEdge",
    deleteEdge: "edges:deleteEdge",
    updateAccessMetadata: "boards:updateAccessMetadata",
  },
  actions: {},
};
