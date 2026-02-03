# Troubleshooting Guide

Common issues and solutions for OCI Generative AI Provider.

## Authentication Issues

### Error: "Authentication failed"

**Symptoms:**
```
Error: Authentication failed
```

**Causes:**
- Invalid OCI config file
- Missing API key file
- Incorrect fingerprint
- Missing environment variables

**Solutions:**

1. **Verify config file exists:**
   ```bash
   cat ~/.oci/config
   ```

2. **Check file permissions:**
   ```bash
   chmod 600 ~/.oci/config
   chmod 600 ~/.oci/oci_api_key.pem
   ```

3. **Verify fingerprint:**
   ```bash
   openssl rsa -pubout -outform DER -in ~/.oci/oci_api_key.pem | openssl md5 -c | awk '{print $2}'
   ```

4. **Check environment variables:**
   ```bash
   echo $OCI_CONFIG_PROFILE
   echo $OCI_COMPARTMENT_ID
   ```

5. **Test OCI CLI:**
   ```bash
   oci iam region list
   ```

### Error: "Compartment not found"

**Symptoms:**
```
Error: Compartment ocid1.compartment... not found
```

**Solutions:**

1. **Verify compartment exists:**
   ```bash
   oci iam compartment get --compartment-id <OCID>
   ```

2. **Check permissions:**
   ```bash
   oci iam policy list --compartment-id <TENANCY_OCID>
   ```

3. **Use correct compartment ID:**
   ```typescript
   const provider = createOCI({
     compartmentId: 'ocid1.compartment.oc1..correct-id',
   });
   ```

## Model Issues

### Error: "Invalid model ID"

**Symptoms:**
```
Error: Invalid model ID: my-model
```

**Solutions:**

1. **Check available models:**
   ```typescript
   import { getAllModels } from '@acedergren/oci-genai-provider';

   const models = getAllModels();
   console.log(models.map(m => m.id));
   ```

2. **Use correct model ID format:**
   ```typescript
   // Correct
   oci.languageModel('cohere.command-r-plus');

   // Wrong
   oci.languageModel('command-r-plus'); // Missing family prefix
   ```

3. **Verify model type:**
   ```typescript
   // Language models
   oci.languageModel('cohere.command-r-plus');

   // Embedding models
   oci.embeddingModel('cohere.embed-multilingual-v3.0');
   ```

### Error: "Model not available in region"

**Symptoms:**
```
Error: Model not available in region eu-frankfurt-1
```

**Solutions:**

1. **Check model availability:**
   - All language models: Available in all regions
   - Speech/Transcription: Only `us-phoenix-1`

2. **Use correct region for speech:**
   ```typescript
   oci.speechModel('oci-tts-standard', {
     region: 'us-phoenix-1', // Required
   });
   ```

3. **Check OCI documentation:**
   Visit [OCI Service Availability](https://docs.oracle.com/iaas/Content/General/Concepts/serviceavailability.htm)

## Regional Issues

### Error: "Speech services not available in this region"

**Symptoms:**
```
Error: Speech services are only available in us-phoenix-1
```

**Solution:**

Always use `us-phoenix-1` for speech and transcription:

```typescript
const provider = createOCI({
  region: 'us-phoenix-1', // Required for speech
});

const speechModel = provider.speechModel('oci-tts-standard');
const transcriptionModel = provider.transcriptionModel('oci-stt-standard');
```

### Error: "Region not configured"

**Symptoms:**
```
Error: Region must be specified
```

**Solutions:**

1. **Set region in config:**
   ```typescript
   const provider = createOCI({
     region: 'us-phoenix-1',
   });
   ```

2. **Set environment variable:**
   ```bash
   export OCI_REGION=us-phoenix-1
   ```

3. **Add to OCI config file:**
   ```ini
   [DEFAULT]
   region=us-phoenix-1
   ```

## Network Issues

### Error: "Connection timeout"

**Symptoms:**
```
Error: Request timeout after 30000ms
```

**Solutions:**

1. **Increase timeout:**
   ```typescript
   oci.languageModel('cohere.command-r-plus', {
     requestOptions: {
       timeoutMs: 60000, // 60 seconds
     },
   });
   ```

2. **Check network connectivity:**
   ```bash
   ping inference.generativeai.us-phoenix-1.oci.oraclecloud.com
   ```

3. **Check firewall rules:**
   - Allow outbound HTTPS (443)
   - Allow access to `*.oraclecloud.com`

### Error: "Rate limit exceeded"

**Symptoms:**
```
Error: Rate limit exceeded. Retry after 60 seconds
```

**Solutions:**

1. **Implement retry logic:**
   ```typescript
   import { RateLimitError } from '@acedergren/oci-genai-provider';

   try {
     await generateText({ model, prompt });
   } catch (error) {
     if (error instanceof RateLimitError) {
       const retryAfter = error.retryAfter || 60;
       await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
       // Retry request
     }
   }
   ```

2. **Enable automatic retry:**
   ```typescript
   oci.languageModel('cohere.command-r-plus', {
     requestOptions: {
       retry: {
         enabled: true,
         maxRetries: 3,
       },
     },
   });
   ```

3. **Request rate limit increase:**
   - Contact OCI support
   - Request service limit increase

## Embedding Issues

### Error: "Batch size exceeds maximum"

**Symptoms:**
```
Error: Batch size (100) exceeds maximum allowed (96)
```

**Solution:**

Batch embeddings in groups of 96 or less:

```typescript
const texts = [...]; // 100+ texts

const batchSize = 96;
const batches = [];

for (let i = 0; i < texts.length; i += batchSize) {
  const batch = texts.slice(i, i + batchSize);
  batches.push(batch);
}

for (const batch of batches) {
  const { embeddings } = await embedMany({
    model: oci.embeddingModel('cohere.embed-multilingual-v3.0'),
    values: batch,
  });
}
```

### Error: "Text exceeds maximum length"

**Symptoms:**
```
Error: Input text exceeds 512 tokens
```

**Solutions:**

1. **Use truncation:**
   ```typescript
   oci.embeddingModel('cohere.embed-multilingual-v3.0', {
     truncate: 'END', // Truncate from end
   });
   ```

2. **Split long texts:**
   ```typescript
   function splitText(text: string, maxLength: number): string[] {
     const chunks = [];
     for (let i = 0; i < text.length; i += maxLength) {
       chunks.push(text.slice(i, i + maxLength));
     }
     return chunks;
   }
   ```

## TypeScript Issues

### Error: "Type 'OCIProvider' is not assignable..."

**Symptoms:**
```
Type 'OCIProvider' is not assignable to type 'ProviderV1'
```

**Solutions:**

1. **Update AI SDK:**
   ```bash
   npm install ai@^6.0.0
   ```

2. **Update TypeScript:**
   ```bash
   npm install -D typescript@^5.6.0
   ```

3. **Check tsconfig.json:**
   ```json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "ESNext",
       "moduleResolution": "bundler",
       "strict": true
     }
   }
   ```

## Build Issues

### Error: "Cannot find module '@acedergren/oci-genai-provider'"

**Solutions:**

1. **Reinstall dependencies:**
   ```bash
   rm -rf node_modules pnpm-lock.yaml
   pnpm install
   ```

2. **Clear build cache:**
   ```bash
   pnpm build
   rm -rf dist
   pnpm build
   ```

3. **Check package.json:**
   ```json
   {
     "dependencies": {
       "@acedergren/oci-genai-provider": "^2.0.0",
       "ai": "^6.0.0"
     }
   }
   ```

## Getting More Help

If your issue isn't covered here:

1. **Check documentation:**
   - [API Reference](./api-reference.md)
   - [Configuration Guide](./configuration.md)
   - [Migration Guide](./migration.md)

2. **Search existing issues:**
   - [GitHub Issues](https://github.com/acedergren/opencode-oci-genai/issues)

3. **Create a new issue:**
   - Include error messages
   - Provide minimal reproduction
   - Share environment details (Node.js version, OS, etc.)

4. **Check OCI status:**
   - [OCI Service Health](https://ocistatus.oraclecloud.com/)

## Debug Mode

Enable debug logging:

```typescript
// Set environment variable
process.env.DEBUG = 'oci-genai:*';

// Or in code
import { createOCI } from '@acedergren/oci-genai-provider';

const provider = createOCI({
  // Config
});
```

This will output detailed logs to help diagnose issues.
