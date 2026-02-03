# Configuration Guide

Complete guide for configuring the OCI Generative AI Provider.

## Quick Setup

### 1. Create OCI Config File

Create `~/.oci/config`:

```ini
[DEFAULT]
user=ocid1.user.oc1..your-user-ocid
fingerprint=your:api:key:fingerprint
key_file=~/.oci/oci_api_key.pem
tenancy=ocid1.tenancy.oc1..your-tenancy-ocid
region=eu-frankfurt-1
```

### 2. Place API Key

```bash
cp /path/to/your/api_key.pem ~/.oci/oci_api_key.pem
chmod 600 ~/.oci/oci_api_key.pem
```

### 3. Set Environment Variables

```bash
export OCI_CONFIG_PROFILE=DEFAULT
export OCI_COMPARTMENT_ID=ocid1.compartment.oc1..your-compartment-ocid
export OCI_REGION=eu-frankfurt-1
```

### 4. Use in Your Code

```typescript
import { oci } from '@acedergren/oci-genai-provider';

const model = oci.languageModel('cohere.command-r-plus');
```

## Authentication Methods

### Method 1: Config File (Default)

Uses `~/.oci/config` file for authentication.

**Pros:**
- Simple to set up
- Secure (key file permissions)
- Works with multiple profiles

**Cons:**
- Requires file system access
- Not suitable for serverless functions

```typescript
import { createOCI } from '@acedergren/oci-genai-provider';

const provider = createOCI({
  auth: 'config_file', // Default
  profile: 'DEFAULT',
  region: 'eu-frankfurt-1',
  compartmentId: process.env.OCI_COMPARTMENT_ID,
});
```

### Method 2: Instance Principal

For applications running on OCI Compute instances.

**Pros:**
- No credentials in code
- Automatic credential rotation
- Secure by default

**Cons:**
- Only works on OCI compute
- Requires instance to have correct policies

```typescript
const provider = createOCI({
  auth: 'instance_principal',
  region: 'eu-frankfurt-1',
  compartmentId: process.env.OCI_COMPARTMENT_ID,
});
```

### Method 3: Resource Principal

For applications running in OCI Functions or other OCI resources.

**Pros:**
- Fine-grained permissions
- Automatic credential rotation
- No credentials in code

**Cons:**
- Only works in OCI Functions/Kubernetes
- Requires correct policies

```typescript
const provider = createOCI({
  auth: 'resource_principal',
  region: 'eu-frankfurt-1',
  compartmentId: process.env.OCI_COMPARTMENT_ID,
});
```

## Environment Variables

The provider reads these environment variables:

```bash
# Required
OCI_COMPARTMENT_ID=ocid1.compartment.oc1..aaa...

# Optional (defaults shown)
OCI_CONFIG_PROFILE=DEFAULT
OCI_REGION=eu-frankfurt-1
OCI_CONFIG_FILE=~/.oci/config
OCI_CLI_AUTH=api_key
```

## Region Configuration

### Available Regions

OCI services are available in multiple regions. Choose the region closest to your users.

| Region Code | Location |
|-------------|----------|
| `us-phoenix-1` | Phoenix, AZ (USA) |
| `us-ashburn-1` | Ashburn, VA (USA) |
| `eu-frankfurt-1` | Frankfurt (Germany) |
| `eu-stockholm-1` | Stockholm (Sweden) |
| `uk-london-1` | London (UK) |
| `ap-tokyo-1` | Tokyo (Japan) |
| `ap-mumbai-1` | Mumbai (India) |

### Regional Service Availability

⚠️ **Important:** Speech and Transcription services are only available in `us-phoenix-1`.

```typescript
// Language models - All regions
oci.languageModel('cohere.command-r-plus', {
  region: 'eu-frankfurt-1',
});

// Speech - Phoenix only
oci.speechModel('oci-tts-standard', {
  region: 'us-phoenix-1', // Required
});
```

## Multiple Profiles

If you work with multiple OCI accounts, configure multiple profiles:

**~/.oci/config:**

```ini
[DEFAULT]
user=ocid1.user.oc1..aaaaaaaa...
fingerprint=12:34:56:...
key_file=~/.oci/default_key.pem
tenancy=ocid1.tenancy.oc1..aaaaaaaa...
region=us-phoenix-1

[PRODUCTION]
user=ocid1.user.oc1..bbbbbbbb...
fingerprint=ab:cd:ef:...
key_file=~/.oci/prod_key.pem
tenancy=ocid1.tenancy.oc1..bbbbbbbb...
region=eu-frankfurt-1

[DEVELOPMENT]
user=ocid1.user.oc1..cccccccc...
fingerprint=11:22:33:...
key_file=~/.oci/dev_key.pem
tenancy=ocid1.tenancy.oc1..cccccccc...
region=us-ashburn-1
```

**Usage:**

```typescript
// Use production profile
const prodProvider = createOCI({
  profile: 'PRODUCTION',
  compartmentId: 'ocid1.compartment.prod...',
});

// Use development profile
const devProvider = createOCI({
  profile: 'DEVELOPMENT',
  compartmentId: 'ocid1.compartment.dev...',
});
```

## Custom Endpoints

For testing or dedicated clusters:

```typescript
const provider = createOCI({
  endpoint: 'https://custom-endpoint.oci.com',
  region: 'us-phoenix-1',
});
```

## Configuration Priority

The provider resolves configuration in this order (highest to lowest priority):

1. **Model-specific settings** passed to `languageModel()`, etc.
2. **Provider configuration** passed to `createOCI()`
3. **Environment variables** (`OCI_*`)
4. **OCI config file** (`~/.oci/config`)

**Example:**

```typescript
// Region precedence example
const provider = createOCI({
  region: 'eu-frankfurt-1', // Priority 2
});

const model = oci.languageModel('cohere.command-r-plus', {
  region: 'us-phoenix-1', // Priority 1 - this wins
});
```

## Best Practices

### Development

- Use config file authentication
- Store credentials in `~/.oci/config`
- Use `.env` file for compartment ID
- Never commit credentials to git

### Production

- Use instance principal or resource principal
- Store compartment ID in environment variables
- Use different profiles for different environments
- Rotate API keys regularly

### Security

- Never expose API keys in code
- Use `.gitignore` for `.env` files
- Restrict file permissions on `~/.oci/config` (chmod 600)
- Use OCI Vault for sensitive configuration

## Troubleshooting

### "Authentication failed"

- Verify `~/.oci/config` exists and has correct format
- Check file permissions (should be 600)
- Ensure API key file exists and path is correct
- Verify fingerprint matches the key

### "Compartment not found"

- Check `OCI_COMPARTMENT_ID` is set correctly
- Verify you have access to the compartment
- Ensure compartment OCID is valid

### "Region not available"

- Check service availability in your region
- Use `us-phoenix-1` for speech/transcription
- Verify region code is correct

See [Troubleshooting Guide](./troubleshooting.md) for more solutions.
