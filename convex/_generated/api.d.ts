/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as acl from "../acl.js";
import type * as anomalyDetection from "../anomalyDetection.js";
import type * as auth from "../auth.js";
import type * as boards from "../boards.js";
import type * as config from "../config.js";
import type * as edges from "../edges.js";
import type * as exports from "../exports.js";
import type * as http from "../http.js";
import type * as keys from "../keys.js";
import type * as llm from "../llm.js";
import type * as llmSecure from "../llmSecure.js";
import type * as logging from "../logging.js";
import type * as nodes from "../nodes.js";
import type * as observability from "../observability.js";
import type * as router from "../router.js";
import type * as security from "../security.js";
import type * as shares from "../shares.js";
import type * as usage from "../usage.js";
import type * as userProfiles from "../userProfiles.js";
import type * as validation from "../validation.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  acl: typeof acl;
  anomalyDetection: typeof anomalyDetection;
  auth: typeof auth;
  boards: typeof boards;
  config: typeof config;
  edges: typeof edges;
  exports: typeof exports;
  http: typeof http;
  keys: typeof keys;
  llm: typeof llm;
  llmSecure: typeof llmSecure;
  logging: typeof logging;
  nodes: typeof nodes;
  observability: typeof observability;
  router: typeof router;
  security: typeof security;
  shares: typeof shares;
  usage: typeof usage;
  userProfiles: typeof userProfiles;
  validation: typeof validation;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
