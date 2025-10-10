# Token Rotation and Deployment Security Guide

## Current Deployment
- **Deployment Name**: `grateful-minnow-178`
- **Dashboard URL**: https://dashboard.convex.dev/d/grateful-minnow-178

## Security Actions Required

### 1. Rotate API Keys

#### OpenAI API Key
- **Current**: `sk-proj-...` (truncated for security)
- **Action**: Generate new API key in OpenAI dashboard
- **Steps**:
  1. Go to https://platform.openai.com/api-keys
  2. Create new API key
  3. Update `CONVEX_OPENAI_API_KEY` environment variable
  4. Revoke old key after confirming new one works

#### Serper API Key (if still in use)
- **Current**: `a540943e...` (truncated for security)
- **Action**: Generate new API key in Serper dashboard
- **Steps**:
  1. Go to https://serper.dev/dashboard
  2. Create new API key
  3. Update `CONVEX_SERPER_API_KEY` environment variable
  4. Revoke old key after confirming new one works

### 2. Rotate JWT Keys

#### JWT Private Key
- **Current**: RSA private key (2048-bit)
- **Action**: Generate new JWT key pair
- **Steps**:
  1. Generate new RSA key pair
  2. Update `JWT_PRIVATE_KEY` environment variable
  3. Update `JWKS` with new public key
  4. Force re-authentication for all users

#### JWKS (JSON Web Key Set)
- **Current**: Contains public key for JWT verification
- **Action**: Update with new public key
- **Steps**:
  1. Extract public key from new private key
  2. Update `JWKS` environment variable
  3. Ensure proper key rotation

### 3. Deployment Rotation

#### Option A: Create New Deployment
1. **Create new deployment**:
   ```bash
   npx convex deploy --prod --name "secure-nodea-v2"
   ```

2. **Update environment variables**:
   ```bash
   npx convex env set CONVEX_OPENAI_API_KEY "new-key-here"
   npx convex env set JWT_PRIVATE_KEY "new-private-key-here"
   npx convex env set JWKS "new-jwks-here"
   ```

3. **Migrate data** (if needed):
   ```bash
   npx convex export --prod
   npx convex import --prod
   ```

#### Option B: Rotate Current Deployment
1. **Update all environment variables**:
   ```bash
   npx convex env set CONVEX_OPENAI_API_KEY "new-key-here"
   npx convex env set JWT_PRIVATE_KEY "new-private-key-here"
   npx convex env set JWKS "new-jwks-here"
   ```

2. **Force re-authentication**:
   - Clear all user sessions
   - Require users to sign in again

### 4. Security Monitoring

#### Audit Log Review
- Check `auditLog` table for suspicious activity
- Look for failed authentication attempts
- Monitor API key usage patterns

#### Access Pattern Analysis
- Review `lastAccessedAt` fields
- Check for unusual access patterns
- Monitor share token usage

### 5. Implementation Steps

#### Immediate Actions (High Priority)
1. **Rotate OpenAI API key**
2. **Update environment variables**
3. **Test application functionality**
4. **Monitor for errors**

#### Medium Priority
1. **Rotate JWT keys**
2. **Force user re-authentication**
3. **Update frontend if needed**

#### Low Priority
1. **Consider deployment rotation**
2. **Implement key rotation automation**
3. **Set up monitoring alerts**

### 6. Verification Checklist

- [ ] New API keys working
- [ ] Application functionality intact
- [ ] User authentication working
- [ ] No sensitive data in logs
- [ ] Audit logs capturing access attempts
- [ ] Rate limiting functioning
- [ ] CORS headers properly configured

### 7. Emergency Procedures

#### If Compromise Detected
1. **Immediately rotate all keys**
2. **Force logout all users**
3. **Review audit logs**
4. **Check for data breaches**
5. **Notify affected users**

#### Rollback Plan
1. **Keep old keys temporarily**
2. **Test new deployment thoroughly**
3. **Have rollback procedure ready**
4. **Monitor for 24-48 hours**

### 8. Automation Recommendations

#### Key Rotation Script
```bash
#!/bin/bash
# rotate-keys.sh
echo "Rotating API keys..."

# Generate new OpenAI key (manual step)
read -p "Enter new OpenAI API key: " NEW_OPENAI_KEY

# Update environment
npx convex env set CONVEX_OPENAI_API_KEY "$NEW_OPENAI_KEY"

# Verify deployment
npx convex deploy --prod

echo "Key rotation complete!"
```

#### Monitoring Script
```bash
#!/bin/bash
# monitor-security.sh
echo "Checking security status..."

# Check for failed auth attempts
npx convex run auditLog:getFailedAttempts

# Check API key usage
npx convex run usageEvents:getRecentUsage

echo "Security check complete!"
```

### 9. Documentation Updates

After rotation:
- [ ] Update `SECURITY.md`
- [ ] Update `SECRETS_MANAGEMENT.md`
- [ ] Update deployment documentation
- [ ] Update team on new keys
- [ ] Update monitoring dashboards

### 10. Contact Information

- **Security Team**: [Your security contact]
- **DevOps Team**: [Your DevOps contact]
- **Emergency Contact**: [Your emergency contact]

---

**Note**: This guide should be reviewed and updated regularly. Keep it secure and limit access to authorized personnel only.
