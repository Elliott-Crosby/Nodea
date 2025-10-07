import { createRoot } from "react-dom/client";
import { ClerkProviderWrapper } from "./lib/clerk";
import { ConvexProviderWithClerkWrapper } from "./lib/convex";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <ClerkProviderWrapper>
    <ConvexProviderWithClerkWrapper>
      <App />
    </ConvexProviderWithClerkWrapper>
  </ClerkProviderWrapper>,
);
