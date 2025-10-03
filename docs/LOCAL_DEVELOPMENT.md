# Local Development Setup Guide

This guide will help you set up and test the Azure Functions backend locally with proper logging and debugging capabilities.

## Prerequisites

- Node.js (v18 or later)
- Azure Functions Core Tools (`npm install -g azure-functions-core-tools@4 --unsafe-perm true`)
- Docker (for Cosmos DB Emulator)
- Valid API keys for PokeData and Pokemon TCG APIs

## Environment Setup

### 1. Environment Variables

Copy the `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables to configure:

- `POKEDATA_API_KEY` - Your PokeData API key
- `POKEMON_TCG_API_KEY` - Your Pokemon TCG API key
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
cd app/backend
npm install
```

## Running the Functions Locally

### Start the Function Runtime

```bash
cd app/backend
func start
```

You should see enhanced startup logging showing:

- ✅ Environment variables status
- ✅ Service initialization
- ✅ API key validation (without exposing keys)
- ✅ Function registration

### Expected Startup Output

```
🚀 [STARTUP] Initializing Azure Functions services...
📊 [STARTUP] Environment: development
🐛 [STARTUP] Debug Mode: ENABLED
🔧 [STARTUP] Environment Variables Status:
  - COSMOS_DB_CONNECTION_STRING: ✅ SET
  - POKEDATA_API_KEY: ✅ SET
  - POKEMON_TCG_API_KEY: ✅ SET
🗄️ [STARTUP] Initializing Cosmos DB Service...
🔥 [STARTUP] Initializing PokeData API Service...
🔥 [PokeDataApiService] Base URL: https://www.pokedata.io/v0
🔥 [PokeDataApiService] API Key: SET (eyJ0eXAiOiJKV1QiLCJh...)
✅ [STARTUP] All services initialized successfully!
```

## Testing the Functions

### Option 1: Bash Script (Recommended)

```bash
# Make executable (if not already)
chmod +x test-endpoints.sh

# Run tests
./test-endpoints.sh
```

### Option 2: Node.js Test Runner

```bash
# Install axios if not already installed
npm install axios

# Run tests
node test-runner.js
```

### Option 3: Manual cURL Testing

```bash
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

```
🔥 [PokeDataApiService] Getting all sets - START
🔥 [PokeDataApiService] Making HTTP GET request:
🔥 [PokeDataApiService]   URL: https://www.pokedata.io/v0/sets
🔥 [PokeDataApiService]   Headers: {"Authorization":"Bearer eyJ0eXAiOiJKV1QiLCJh...","Content-Type":"application/json"}
🔥 [PokeDataApiService] Response received (156ms):
🔥 [PokeDataApiService]   Status: 200 OK
🔥 [PokeDataApiService]   Content-Type: application/json
🔥 [PokeDataApiService]   Data type: object
🔥 [PokeDataApiService]   Data is array: true
🔥 [PokeDataApiService] Successfully retrieved 245 sets
```

## Troubleshooting

### Common Issues

#### 1. 500 Internal Server Error

- Check the function logs for detailed error information
- Verify API keys are correctly set in `.env`
- Ensure Cosmos DB emulator is running and accessible

#### 2. Connection Refused

- Make sure `func start` is running
- Check that the function is listening on port 7071
- Verify no firewall blocking localhost connections

#### 3. API Authentication Errors

- Verify `POKEDATA_API_KEY` is valid and not expired
- Check API key format (should be a JWT token)
- Test API key directly with curl:
  ```bash
  curl -H "Authorization: Bearer YOUR_API_KEY" https://www.pokedata.io/v0/sets
  ```

#### 4. Cosmos DB Connection Issues

- Verify emulator is running: `curl -k https://cosmosdb-emulator:8081/`
- Check connection string includes `DisableServerCertificateValidation=true`
- Ensure database `pokedata` and container `cards` exist

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
app/backend/
├── .env                    # Environment variables
├── test-endpoints.sh       # Bash test script
├── test-runner.js         # Node.js test runner
├── LOCAL_DEVELOPMENT.md   # This guide
├── src/
│   ├── index.ts           # Enhanced service initialization
│   ├── functions/         # Function implementations
│   └── services/          # Enhanced API services
└── package.json
```
