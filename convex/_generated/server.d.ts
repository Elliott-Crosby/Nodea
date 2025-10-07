import type { GenericQueryCtx, GenericMutationCtx, GenericActionCtx } from "convex/server";
import type { Doc, Id } from "./dataModel";

export type QueryCtx = GenericQueryCtx<any>;
export type MutationCtx = GenericMutationCtx<any>;
export type ActionCtx = GenericActionCtx<any>;

export type Query<Args, Output> = {
  args: Args;
  output: Output;
  handler: (ctx: QueryCtx, args: Args) => Promise<Output>;
};

export type Mutation<Args, Output> = {
  args: Args;
  output: Output;
  handler: (ctx: MutationCtx, args: Args) => Promise<Output>;
};

export type Action<Args, Output> = {
  args: Args;
  output: Output;
  handler: (ctx: ActionCtx, args: Args) => Promise<Output>;
};

export type FunctionReference<
  Type extends "query" | "mutation" | "action",
  TableName extends string,
  FunctionName extends string
> = `${TableName}:${FunctionName}`;
