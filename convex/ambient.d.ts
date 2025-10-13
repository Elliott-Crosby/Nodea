// Temporary type shims to unblock local dev; replace with Convex codegen output
declare module "./_generated/api" {
  export const api: any;
}
declare module "./_generated/dataModel" {
  export type Id<T extends string> = string & { __table: T };
  export type Doc<T extends string> = { _id: Id<T>; _creationTime: number } & Record<string, unknown>;
}
declare module "./_generated/server" {
  export const query: any;
  export const mutation: any;
  export const action: any;
  export const internalQuery: any;
  export const internalMutation: any;
  export const internalAction: any;
}

