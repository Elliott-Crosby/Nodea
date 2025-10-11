import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

const convexUrl = import.meta.env.VITE_CONVEX_URL ?? "https://posh-setter-840.convex.cloud";

export const convexClient = new ConvexReactClient(convexUrl);
export { ConvexProviderWithClerk };
