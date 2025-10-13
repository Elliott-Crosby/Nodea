# Secrets Management Guide

## Overview

This document outlines the security practices for managing secrets in Nodea MVP 2.1, ensuring no sensitive data is exposed in source code or logs.

## Security Principles

### 1. No Secrets in Source Code
- ❌ Never commit API keys, passwords, or tokens to version control
- ✅ Use environment variables for all sensitive configuration
- ✅ Store secrets in Convex environment variables
- ✅ Use encryption for stored API keys

### 2. No Sensitive Data in Logs
- ❌ Never log API keys, passwords, or user content
- ❌ Never log prompts, messages, or responses
- ❌ Never log authentication tokens
- ✅ Log only error types and operation status
- ✅ Use structured logging without sensitive data

### 3. Input Validation and Sanitization
- ✅ Validate all user inputs
- ✅ Sanitize content before storage
- ✅ Use DOMPurify for HTML sanitization
- ✅ Block dangerous patterns and scripts

## Environment Variables

### Required Secrets (Set in Convex Dashboard)

```bash
# OpenAI API Key
CONVEX_OPENAI_API_KEY=sk-...

# Optional: Additional API keys
CONVEX_ANTHROPIC_API_KEY=sk-ant-...
CONVEX_GOOGLE_API_KEY=...

# Security Configuration
ALLOWED_ORIGINS=https://yourdomain.com
RATE_LIMIT_REQUESTS_PER_MINUTE=1000
RATE_LIMIT_LLM_REQUESTS_PER_HOUR=50
```

### Setting Environment Variables

```bash
# Set in Convex dashboard or via CLI
npx convex env set CONVEX_OPENAI_API_KEY sk-your-key-here
npx convex env set ALLOWED_ORIGINS https://yourdomain.com
```

## API Key Management

### User API Keys
- Stored encrypted in database
- Only last 4 characters displayed
- Validated before storage
- Revocable by users

### System API Keys
- Stored in Convex environment variables
- Never logged or exposed
- Used for system operations only

## Logging Security

### What NOT to Log
```typescript
// ❌ NEVER DO THIS
console.log('API Key:', apiKey);
console.log('User message:', message);
console.log('Prompt:', prompt);
console.log('Response:', response);
console.log('Token:', token);
```

### What TO Log
```typescript
// ✅ SECURE LOGGING
console.log('Operation completed successfully');
console.log('Rate limit exceeded');
console.error('Authentication failed');
console.error('Validation error');
```

### Error Logging
```typescript
// ❌ NEVER DO THIS
console.error('Error:', error); // May contain sensitive data

// ✅ SECURE ERROR LOGGING
console.error('Operation failed');
console.error('Validation error');
console.error('Rate limit exceeded');
```

## Input Validation

### Server-Side Validation
```typescript
import { validateNodeContent, validateBoardTitle } from "./validation";

// Validate user input
const sanitizedContent = validateNodeContent(userInput);
const sanitizedTitle = validateBoardTitle(userTitle);
```

### Client-Side Sanitization
```typescript
import { sanitizeForDisplay, sanitizeForStorage } from '../lib/sanitization';

// Sanitize for display
const safeContent = sanitizeForDisplay(userContent);

// Sanitize for storage
const safeStorage = sanitizeForStorage(userContent);
```

## Content Security Policy

### HTML Sanitization
- Remove dangerous HTML tags
- Block JavaScript execution
- Prevent XSS attacks
- Allow only safe formatting tags

### Allowed HTML Tags
```typescript
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'code', 'pre'
];
```

### Blocked Patterns
```typescript
const DANGEROUS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /javascript:/gi,
  /onload=/gi,
  /onerror=/gi,
  // ... more patterns
];
```

## Security Monitoring

### What to Monitor
- Rate limit violations
- Authentication failures
- Input validation errors
- API key usage patterns
- Error rates and types

### What NOT to Monitor
- User content
- API keys or tokens
- Personal information
- Sensitive business data

## Best Practices

### 1. Development
- Use `.env.local` for local development
- Never commit `.env` files
- Use different API keys for dev/staging/prod
- Review API key access periodically

### 2. Production
- Store all secrets in Convex environment variables
- Use strong, unique API keys
- Monitor for unusual activity
- Implement proper access controls

### 3. Code Review
- Check for hardcoded secrets
- Verify input validation
- Review logging statements
- Ensure proper error handling

## Incident Response

### If Secrets Are Exposed
1. Disable affected API keys in provider dashboards
2. Review logs for unauthorized access
3. Update environment variables once new keys are issued
4. Notify affected users if necessary
5. Document the incident

### If Sensitive Data Is Logged
1. Remove sensitive data from logs
2. Review log retention policies
3. Implement additional validation
4. Update logging practices

## Compliance

### Data Protection
- No personal data in logs
- Encrypted storage of sensitive data
- User consent for data processing
- Right to deletion

### Security Standards
- OWASP security guidelines
- Input validation best practices
- Secure coding standards
- Regular security audits

## Tools and Resources

### Security Tools
- DOMPurify for HTML sanitization
- Convex environment variables
- Input validation utilities
- Rate limiting mechanisms

### Documentation
- OWASP Top 10
- Convex security documentation
- React security best practices
- TypeScript security guidelines

## Contact

For security concerns or questions about secrets management, contact the development team or create a security issue in the repository.
