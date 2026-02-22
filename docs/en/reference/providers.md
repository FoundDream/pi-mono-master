# Providers & Authentication

Pi supports multiple LLM providers through two authentication methods: subscription-based and API key-based.

## Authentication Methods

### Subscription Providers

Subscription providers use OAuth to authenticate through your existing service account. No API key is needed.

| Provider | Subscription | Command |
|----------|-------------|---------|
| Anthropic | Claude Pro / Max | `pi --provider anthropic` |
| OpenAI | ChatGPT Plus / Pro | `pi --provider openai` |
| GitHub Copilot | GitHub Copilot subscription | `pi --provider github-copilot` |
| Google | Google AI subscription | `pi --provider google` |

On first use, Pi opens a browser window for OAuth login. Credentials are stored securely and refreshed automatically.

### API Keys

For direct API access, configure keys via environment variables or the auth file.

## API Key Configuration

### Environment Variables

Set the appropriate environment variable for your provider:

| Provider | Environment Variable |
|----------|---------------------|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Google | `GOOGLE_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` |
| Amazon Bedrock | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` |
| Google Vertex AI | `GOOGLE_APPLICATION_CREDENTIALS` |

### Auth File

Store keys in `~/.pi/agent/auth.json`:

```json
{
  "anthropic": "sk-ant-xxx",
  "openai": "$OPENAI_API_KEY",
  "google": "!gcloud auth print-access-token"
}
```

### Key Formats

Values in `auth.json` support three formats:

| Format | Example | Description |
|--------|---------|-------------|
| Literal | `"sk-ant-xxx"` | Key value used directly |
| Environment variable | `"$OPENAI_API_KEY"` | Reads from environment at runtime |
| Shell command | `"!gcloud auth print-access-token"` | Executes command, uses stdout |

## Credential Resolution Priority

Pi resolves credentials in this order (first match wins):

1. **CLI flags** -- `--api-key` passed on the command line
2. **auth.json** -- Key for the provider in `~/.pi/agent/auth.json`
3. **Environment variables** -- Provider-specific env var (e.g., `ANTHROPIC_API_KEY`)
4. **Custom provider** -- Key defined in `models.json` provider configuration
5. **OAuth** -- Subscription-based authentication (if available for the provider)

## Provider-Specific Configuration

### Azure OpenAI

Azure OpenAI requires additional configuration for your deployment:

```bash
export AZURE_OPENAI_API_KEY="your-key"
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
export AZURE_OPENAI_API_VERSION="2024-12-01-preview"
```

Or configure via `models.json`:

```json
{
  "providers": {
    "azure": {
      "baseUrl": "https://your-resource.openai.azure.com/openai/deployments/your-deployment",
      "api": "openai-completions",
      "apiKey": "$AZURE_OPENAI_API_KEY",
      "headers": {
        "api-key": "$AZURE_OPENAI_API_KEY"
      },
      "models": {
        "gpt-4o": {
          "name": "GPT-4o (Azure)"
        }
      }
    }
  }
}
```

### Amazon Bedrock

Configure AWS credentials using standard AWS credential chain:

```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
```

Or use an AWS profile:

```bash
export AWS_PROFILE="my-profile"
export AWS_REGION="us-east-1"
```

### Google Vertex AI

For Vertex AI, authenticate via service account or application default credentials:

```bash
# Application default credentials
gcloud auth application-default login

# Or set service account key
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
export GOOGLE_CLOUD_PROJECT="your-project-id"
export GOOGLE_CLOUD_LOCATION="us-central1"
```

## Custom Providers

For custom or self-hosted providers, use `models.json` to define the provider configuration. See the [Custom Models](/reference/models) reference for details.

For programmatic provider registration in extensions, use `pi.registerProvider()`. See the [Custom Provider](/reference/custom-provider) reference for the full API.
