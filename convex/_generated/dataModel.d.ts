export type Doc<TableName extends string> = {
  _id: Id<TableName>;
  _creationTime: number;
} & Record<string, any>;

export type Id<TableName extends string> = string & { __tableName: TableName };

export type Tables = {
  boards: {
    ownerUserId: string;
    title: string;
    description?: string;
    isPublic: boolean;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
    lastAccessedAt?: number;
    lastAccessedBy?: string;
  };
  nodes: {
    boardId: Id<"boards">;
    title: string;
    content?: string;
    x: number;
    y: number;
    type: string;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
  };
  edges: {
    boardId: Id<"boards">;
    sourceNodeId: Id<"nodes">;
    targetNodeId: Id<"nodes">;
    createdBy: string;
    createdAt: number;
  };
  userProfiles: {
    userId: string;
    name?: string;
    email?: string;
    createdAt: number;
    updatedAt: number;
  };
};
