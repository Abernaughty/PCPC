# Local Development Setup Guide

This guide will help you set up and test the Azure Functions backend locally with proper logging and debugging capabilities.

## Prerequisites

- Node.js (v22 or later)
- Azure Functions Core Tools (`npm install -g azure-functions-core-tools@4 --unsafe-perm true`)
- Docker (for Cosmos DB Emulator)
- A valid Scrydex API key and team ID

## Environment Setup

### 1. Environment Variables

Copy the `local.settings.json.example` to `local.settings.json` and configure:

```bash
cp local.settings.json.example local.settings.json
```

Key variables to configure:

- `SCRYDEX_API_KEY` - Your Scrydex API key
- `SCRYDEX_TEAM_ID` - Your Scrydex team ID
- `SCRYDEX_API_BASE_URL` - Scrydex API base URL (defaults to `https://api.scrydex.com/pokemon/v1`)
- `COSMOS_DB_CONNECTION_STRING` - Points to local emulator
- `DEBUG_MODE=true` - Enables enhanced logging

### 2. Cosmos DB Emulator

The configuration is set up to use the Cosmos DB emulator in your devcontainer:

```bash
# Test emulator connectivity
curl -k https://cosmosdb-emulator:8081/_explorer/emulator.pem
```

The connection string includes `DisableServerCertificateValidation=true` for the emulator.

### 3. Install Dependencies

```bash
cd backend/functions
npm install
```

## Running the Functions Locally

### Start the Function Runtime

```bash
cd backend/functions
func start
```

You should see enhanced startup logging showing:

- ✅ Environment variables status
- ✅ Service initialization
- ✅ API key validation (without exposing keys)
- ✅ Function registration

### Expected Startup Output

Startup logging is emitted through the leveled `logger` in `src/index.ts`. With
`DEBUG_MODE=true` you will see an environment-variable status block followed by
service initialization, for example:

```
[INFO] Initializing Azure Functions services (env: development)
[DEBUG] Environment variable status {
  COSMOS_DB_CONNECTION_STRING: true,
  COSMOS_DB_DATABASE_NAME: 'PokemonCards',
  COSMOS_DB_CARDS_CONTAINER_NAME: 'Cards',
  COSMOS_DB_SETS_CONTAINER_NAME: 'Sets',
  SCRYDEX_API_KEY: true,
  SCRYDEX_TEAM_ID: true,
  SCRYDEX_API_BASE_URL: 'https://api.scrydex.com/pokemon/v1',
  REDIS_CACHE_ENABLED: false
}
[INFO] All services initialized
```

## Testing the Functions

### Option 1: Bash Script (Recommended)

```bash
# Make executable (if not already)
chmod +x test-endpoints.sh

# Run tests
./test-endpoints.sh
```

### Option 2: Manual cURL Testing

```bash
# Health check
curl http://localhost:7071/api/health

# Basic sets endpoint
curl http://localhost:7071/api/sets

# With parameters
curl "http://localhost:7071/api/sets?language=ENGLISH&page=1&pageSize=5"

# All sets
curl "http://localhost:7071/api/sets?all=true"
```

## Enhanced Logging Features

### Service Initialization Logging

- Environment variable validation
- Service startup confirmation
- API key presence verification (without exposing values)

### API Request/Response Logging

- Detailed HTTP request information
- Response status and timing
- Error details with context
- Request/response headers (sanitized)

### Example API Call Logs

External data is fetched through `ScrydexApiService`. With debug logging enabled,
outbound calls and their responses are logged (URLs and timing logged; the API
key and team ID are never printed), for example:

```
[INFO] [ScrydexApiService] Getting all sets
[DEBUG] [ScrydexApiService] GET https://api.scrydex.com/pokemon/v1/sets
[DEBUG] [ScrydexApiService] Response 200 OK (156ms)
[INFO] [ScrydexApiService] Retrieved 245 sets
```

## Troubleshooting

### Common Issues

#### 1. 500 Internal Server Error

- Check the function logs for detailed error information
- Verify API keys are correctly set in `local.settings.json`
- Ensure Cosmos DB emulator is running and accessible

#### 2. Connection Refused

- Make sure `func start` is running
- Check that the function is listening on port 7071
- Verify no firewall blocking localhost connections

#### 3. API Authentication Errors

- Verify `SCRYDEX_API_KEY` and `SCRYDEX_TEAM_ID` are valid and not expired
- Confirm `SCRYDEX_API_BASE_URL` points at the correct Scrydex endpoint
- Test the API key directly with curl:
  ```bash
  curl -H "X-Api-Key: YOUR_API_KEY" -H "X-Team-ID: YOUR_TEAM_ID" https://api.scrydex.com/pokemon/v1/sets
  ```

#### 4. Cosmos DB Connection Issues

- Verify emulator is running: `curl -k https://cosmosdb-emulator:8081/`
- Check connection string includes `DisableServerCertificateValidation=true`
- Ensure database `PokemonCards` and containers `Cards`/`Sets` exist

### Debug Mode Features

When `DEBUG_MODE=true`:

- Enhanced request/response logging
- Detailed error stack traces
- Performance timing information
- Service initialization details

### Log Levels

The enhanced logging provides different levels:

- 🚀 **Startup**: Service initialization
- 🔥 **API Calls**: External API requests
- 🗄️ **Database**: Cosmos DB operations
- ❌ **Errors**: Error conditions with context
- ✅ **Success**: Successful operations

## Performance Monitoring

The logging includes timing information:

- API request duration
- Service initialization time
- End-to-end request processing

## Security Notes

- API keys are partially masked in logs (first 20 characters shown)
- Sensitive headers are sanitized
- Connection strings show only presence, not values
- Debug mode should be disabled in production

## Next Steps

Once local development is working:

1. Test all endpoints with the provided scripts
2. Verify Cosmos DB operations
3. Test error scenarios
4. Deploy to Azure and compare behavior

## File Structure

```
backend/functions/
├── local.settings.json          # Local config (gitignored)
├── local.settings.json.example  # Config template
├── src/
│   ├── index.ts                 # Service initialization + function registration
│   ├── functions/               # Function implementations
│   └── services/                # API and data services
└── package.json
```
