
# Local Emulators in Devcontainer  
**Azurite (Blob/Queue/Table) + Azure Cosmos DB Emulator (NoSQL)**

## Topology & Endpoints

- **Compose project**: `portfolio_devcontainer`
- **Services**
  - `azurite` → **HTTP** on 10000 (blob), 10001 (queue), 10002 (table)
  - `cosmosdb-emulator` → **HTTPS** on 8081 (+ internal service ports)
- **Inside the devcontainer (Bash)**  
  - Use **service names**:  
    - `http://azurite:10000/devstoreaccount1` (and `:10001`, `:10002`)  
    - `https://cosmosdb-emulator:8081/`
- **From Windows host or WSL**  
  - `http://localhost:10000` (…10001/10002), `https://localhost:8081`

> Note: `localhost` **inside** the devcontainer points to the devcontainer itself, not siblings.

---

## Starting / Stopping (from repo root)

### PowerShell (Windows host)
```powershell
# From C:\Users\<you>\Documents\GitHub\Portfolio
docker compose -p portfolio_devcontainer -f .devcontainer\docker-compose.yml down --remove-orphans
docker compose -p portfolio_devcontainer -f .devcontainer\docker-compose.yml up -d
docker compose -p portfolio_devcontainer -f .devcontainer\docker-compose.yml ps
```

### Bash (WSL)
```bash
cd /mnt/c/Users/<you>/Documents/GitHub/Portfolio
docker compose -p portfolio_devcontainer -f .devcontainer/docker-compose.yml down --remove-orphans
docker compose -p portfolio_devcontainer -f .devcontainer/docker-compose.yml up -d
docker compose -p portfolio_devcontainer -f .devcontainer/docker-compose.yml ps
```

---

## Recommended Compose tweak (Cosmos POST hang fix)

In `.devcontainer/docker-compose.yml` under `cosmosdb-emulator`:
```yaml
environment:
  - AZURE_COSMOS_EMULATOR_IP_ADDRESS_OVERRIDE=127.0.0.1
```

Recreate the stack (commands above).

---

## Azurite – Quick Tests

### Bash (inside devcontainer)
```bash
# Service resolves + port open
getent hosts azurite
# (Optional) nc if present: (printf '' | nc -vz azurite 10000) || true

# Minimal HTTP probe (4xx is OK—proves listener responds)
curl -v http://azurite:10000/devstoreaccount1/ | head

# Real blob round-trip via Azure CLI
export AZURE_STORAGE_CONNECTION_STRING='DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://azurite:10000/devstoreaccount1;QueueEndpoint=http://azurite:10001/devstoreaccount1;TableEndpoint=http://azurite:10002/devstoreaccount1;'
az storage container create -n testrun
echo "hello" > /tmp/hello.txt
az storage blob upload   --container-name testrun --name hello.txt --file /tmp/hello.txt --overwrite
az storage blob download --container-name testrun --name hello.txt --file /tmp/hello.out --overwrite
diff -q /tmp/hello.txt /tmp/hello.out && echo "Azurite OK (devcontainer)"
```

### PowerShell (Windows host)
```powershell
# Minimal probe (4xx is OK)
curl.exe -v http://localhost:10000/devstoreaccount1/ | Select-Object -First 5

# Real blob round-trip
$env:AZURE_STORAGE_CONNECTION_STRING = 'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;'
az storage container create -n testrun | Out-Null
"hello" | Out-File -FilePath "$env:TEMP\hello.txt" -Encoding utf8
az storage blob upload   --container-name testrun --name hello.txt --file "$env:TEMP\hello.txt" --overwrite | Out-Null
az storage blob download --container-name testrun --name hello.txt --file "$env:TEMP\hello.out" --overwrite | Out-Null
fc "$env:TEMP\hello.txt" "$env:TEMP\hello.out"
```

---

## Cosmos DB Emulator – Health & REST Tests

### Bash (inside devcontainer)

**Health (PEM):**
```bash
curl -k https://cosmosdb-emulator:8081/_explorer/emulator.pem | head
```

**REST signer (bash) + Create DB → List DBs**  
(Uses `jq` for URL-encode; forces a “safe” HTTP/1.1 POST path.)
```bash
COSMOS_HOST="https://cosmosdb-emulator:8081"
COSMOS_KEY_B64='C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=='
XMS_VERSION="2023-11-15"

sign() {  # usage: sign <VERB> <resType> <resId>
  local verb="$(echo "$1" | tr '[:upper:]' '[:lower:]')"
  local rtype="$(echo "$2" | tr '[:upper:]' '[:lower:]')"
  local rid="$(echo "$3" | tr '[:upper:]' '[:lower:]')"
  DATE_RFC=$(LC_ALL=C date -u +"%a, %d %b %Y %H:%M:%S GMT" | tr '[:upper:]' '[:lower:]')
  local sts="${verb}
${rtype}
${rid}
${DATE_RFC}

"
  KEY_HEX=$(printf %s "$COSMOS_KEY_B64" | base64 -d | xxd -p -c 256)
  SIG_B64=$(printf "%b" "$sts" | openssl dgst -sha256 -mac HMAC -macopt hexkey:$KEY_HEX -binary | base64)
  SIG_ENC=$(jq -rn --arg v "$SIG_B64" '$v|@uri')
  printf '%s|type=master&ver=1.0&sig=%s' "$DATE_RFC" "$SIG_ENC"
}

# Create DB (forces HTTP/1.1, no Expect/chunked, closes socket)
IFS='|' read DATE_RFC AUTH <<<"$(sign POST dbs)"
curl -sS -k -i --http1.1   -H "Expect:" -H "Connection: close" -H "Transfer-Encoding:"   -H "x-ms-date: $DATE_RFC" -H "x-ms-version: $XMS_VERSION"   -H "Authorization: $AUTH" -H "Content-Type: application/json"   --data-binary '{"id":"TestDb"}'   "$COSMOS_HOST/dbs" | sed -n '1,80p'

# List DBs
IFS='|' read DATE_RFC AUTH <<<"$(sign GET dbs)"
curl -sS -k -i --http1.1   -H "x-ms-date: $DATE_RFC" -H "x-ms-version: $XMS_VERSION"   -H "Authorization: $AUTH"   "$COSMOS_HOST/dbs" | sed -n '1,80p'
```

> If POSTs ever stall with the service name, try:
> ```bash
> EMULATOR_IP=$(getent hosts cosmosdb-emulator | awk '{print $1}')
> curl -sS -k -i --http1.1 --resolve localhost:8081:$EMULATOR_IP >   -H "Expect:" -H "Connection: close" -H "Transfer-Encoding:" >   -H "x-ms-date: $DATE_RFC" -H "x-ms-version: $XMS_VERSION" >   -H "Authorization: $AUTH" -H "Content-Type: application/json" >   --data-binary '{"id":"TestDb"}' >   https://localhost:8081/dbs
> ```
> With the **IP override** set to `127.0.0.1`, this is rarely needed.

### PowerShell (Windows host)

**Health (PEM):**
```powershell
curl.exe -k https://localhost:8081/_explorer/emulator.pem | Select-Object -First 5
```

**REST signer (PowerShell) + Create DB → List DBs**
```powershell
$CosmosKeyB64 = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=='
$XmsVersion  = '2023-11-15'

function New-CosmosAuthHeader {
  param([string]$Method,[string]$ResourceType,[string]$ResourceId,[string]$KeyB64,[string]$RfcDateLower)
  $verb  = $Method.ToLower()
  $rtype = $ResourceType.ToLower()
  $rid   = $ResourceId.ToLower()
  $toSign = "$verb`n$rtype`n$rid`n$RfcDateLower`n`n"
  $keyBytes = [Convert]::FromBase64String($KeyB64)
  $hmac = [System.Security.Cryptography.HMACSHA256]::new($keyBytes)
  $sigB64 = [Convert]::ToBase64String($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($toSign)))
  $sigEnc = [uri]::EscapeDataString($sigB64)
  "type=master&ver=1.0&sig=$sigEnc"
}

# Create DB
$Rfc = ([DateTime]::UtcNow.ToString('r')).ToLower()
$Auth = New-CosmosAuthHeader -Method 'POST' -ResourceType 'dbs' -ResourceId '' -KeyB64 $CosmosKeyB64 -RfcDateLower $Rfc
curl.exe -k -i https://localhost:8081/dbs `
  -H "x-ms-date: $Rfc" -H "x-ms-version: $XmsVersion" -H "Authorization: $Auth" -H "Content-Type: application/json" `
  --http1.1 -H "Expect:" -H "Connection: close" -H "Transfer-Encoding:" `
  --data-binary '{"id":"TestDb"}' | Select-Object -First 20

# List DBs
$Rfc = ([DateTime]::UtcNow.ToString('r')).ToLower()
$Auth = New-CosmosAuthHeader -Method 'GET' -ResourceType 'dbs' -ResourceId '' -KeyB64 $CosmosKeyB64 -RfcDateLower $Rfc
curl.exe -k -i https://localhost:8081/dbs `
  -H "x-ms-date: $Rfc" -H "x-ms-version: $XmsVersion" -H "Authorization: $Auth" --http1.1 |
  Select-Object -First 40
```

---

## App Configuration (inside devcontainer)

- **Azurite (HTTP)** – example connection string:
```
DefaultEndpointsProtocol=http;
AccountName=devstoreaccount1;
AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;
BlobEndpoint=http://azurite:10000/devstoreaccount1;
QueueEndpoint=http://azurite:10001/devstoreaccount1;
TableEndpoint=http://azurite:10002/devstoreaccount1;
```

- **Cosmos Emulator (HTTPS)**:
  - Endpoint: `https://cosmosdb-emulator:8081/`
  - Key: same as `$CosmosKeyB64`
  - Cert: either trust the PEM **in the container**:
    ```bash
    curl -k https://cosmosdb-emulator:8081/_explorer/emulator.pem -o /usr/local/share/ca-certificates/cosmos.pem
    sudo update-ca-certificates
    ```
    …or disable SSL validation in your SDK for local dev.

---

## Troubleshooting Cheatsheet

### Ports already in use (Windows host)
```powershell
netstat -aon | findstr LISTENING | findstr :10000
Get-NetTCPConnection -LocalPort 10000 -State Listen | Select LocalAddress,LocalPort,OwningProcess
Get-Process -Id <PID>
docker ps --filter "publish=10000"
docker stop <id>; docker rm <id>
```

### Verify listeners
```powershell
Test-NetConnection 127.0.0.1 -Port 10000
Test-NetConnection 127.0.0.1 -Port 8081
```
```bash
ss -ltn | grep -E ':10000|:10001|:10002|:8081'
```

### Compose status & logs
```powershell
docker compose -p portfolio_devcontainer -f .devcontainer\docker-compose.yml ps
docker compose -p portfolio_devcontainer -f .devcontainer\docker-compose.yml logs azurite --no-color --tail=200
docker compose -p portfolio_devcontainer -f .devcontainer\docker-compose.yml logs cosmosdb-emulator --no-color --tail=200
```

### Proxy vars can break POSTs
```bash
env | grep -i _proxy || true
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY all_proxy ALL_PROXY
```

### Clean reset
```powershell
docker compose -p portfolio_devcontainer -f .devcontainer\docker-compose.yml down --remove-orphans
docker container prune -f
# Optional:
Stop-Service com.docker.service -Force; Start-Service com.docker.service
```

---

## Optional: Healthchecks + Startup Ordering (compose)

```yaml
services:
  azurite:
    image: mcr.microsoft.com/azure-storage/azurite
    command: azurite --blobHost 0.0.0.0 --queueHost 0.0.0.0 --tableHost 0.0.0.0
    ports: ["10000:10000","10001:10001","10002:10002"]
    healthcheck:
      test: ["CMD", "sh", "-c", "apk add --no-cache curl >/dev/null 2>&1 || true; curl -s -o /dev/null http://localhost:10000/devstoreaccount1/"]
      interval: 3s
      timeout: 2s
      retries: 20

  cosmosdb-emulator:
    image: mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest
    environment:
      - AZURE_COSMOS_EMULATOR_IP_ADDRESS_OVERRIDE=127.0.0.1
    ports: ["8081:8081","8900-8902:8900-8902","10250-10256:10250-10256","10350:10350"]
    healthcheck:
      test: ["CMD", "sh", "-lc", "curl -k -s https://localhost:8081/_explorer/emulator.pem >/dev/null"]
      interval: 3s
      timeout: 2s
      retries: 20

  devcontainer:
    # your app container …
    depends_on:
      azurite:
        condition: service_healthy
      cosmosdb-emulator:
        condition: service_healthy
```
