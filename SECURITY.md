# Security Configuration

## Environment Variables

Set these environment variables in your Convex dashboard:

### Required
- `CONVEX_OPENAI_API_KEY`: Your OpenAI API key

### Security Settings
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS (defaults to http://localhost:5173 for local development)
- `RATE_LIMIT_REQUESTS_PER_MINUTE`: HTTP requests per minute (default: 1000)
- `RATE_LIMIT_LLM_REQUESTS_PER_HOUR`: LLM requests per hour (default: 50)
- `SHARE_TOKEN_EXPIRY_HOURS`: Share token expiry in hours (default: 24)

## Security Features Implemented

### 1. Authentication
- ✅ Anonymous authentication disabled
- ✅ All server functions require real user identity
- ✅ User ownership verification for all resources

### 2. Server-Side Security
- ✅ LLM calls moved server-side only
- ✅ Web search calls server-side only
- ✅ Export functions server-side only
- ✅ API key encryption and secure storage

### 3. HTTP Security
- ✅ CORS allow-list configuration
- ✅ Rate limiting on all HTTP routes
- ✅ Security headers on all responses
- ✅ Preflight request handling

### 4. Share Links
- ✅ Expiring, unguessable tokens
- ✅ Access count limits
- ✅ User ownership verification
- ✅ Automatic cleanup of expired tokens

### 5. Frontend Security
- ✅ Strict Content Security Policy
- ✅ Security headers in HTML
- ✅ XSS protection
- ✅ Clickjacking protection
- ✅ MIME type sniffing protection

## Usage

### Creating Share Links
```typescript
// Create a share link that expires in 24 hours
const shareLink = await ctx.runMutation(api.shares.createShareLink, {
  boardId: "your-board-id",
  expiresInHours: 24,
  maxAccesses: 100, // Optional access limit
});
```

### Accessing Shared Content
```typescript
// Get shared board data
const sharedData = await ctx.runQuery(api.shares.getSharedBoard, {
  token: "share-token",
});
```

### Rate Limiting
Rate limits are automatically applied:
- HTTP requests: 1000 per minute per IP
- LLM requests: 50 per hour per user
- LLM streaming: 30 per hour per user

## Security Best Practices

1. **Never expose API keys** in client-side code
2. **Use HTTPS** in production
3. **Monitor** rate limit violations
4. **Clean up** expired share tokens
5. **Validate** all user inputs
6. **Use** the secure LLM functions (`llm-secure.ts`)

## Monitoring

Monitor these metrics for security:
- Rate limit violations
- Failed authentication attempts
- Share token usage
- API key usage patterns
- Error rates

## Updates

To update security settings:
1. Modify `convex/security.ts` for rate limits
2. Update `convex/http.ts` for CORS settings
3. Adjust `index.html` for CSP policies
4. Update environment variables in Convex dashboard
