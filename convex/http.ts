import router from "./router";

const http = router;

// Note: HTTP middleware is not available in current Convex version
// CORS and security headers would need to be implemented differently
// For now, we'll just export the router without middleware

export default http;
