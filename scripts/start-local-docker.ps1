param([switch]$Stop)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$originalPath = $env:PATH
Push-Location $repoRoot

try {
  $dockerCommand = Get-Command docker.exe -ErrorAction SilentlyContinue
  if (-not $dockerCommand) {
    $dockerCandidates = @(
      "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe",
      "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe"
    )
    foreach ($candidate in $dockerCandidates) {
      if (Test-Path -LiteralPath $candidate) {
        $env:PATH = "$(Split-Path -Parent $candidate);$env:PATH"
        $dockerCommand = Get-Command docker.exe
        break
      }
    }
  }
  if (-not $dockerCommand) { throw "Docker CLI not found. Install Docker Desktop or add its resources\bin folder to PATH." }

  $supabaseCommand = Join-Path $repoRoot "node_modules\.bin\supabase.cmd"
  if (-not (Test-Path -LiteralPath $supabaseCommand)) { throw "Supabase CLI not found. Run npm ci first." }

  if ($Stop) {
    if (Test-Path -LiteralPath ".env.docker") {
      docker compose --env-file .env.docker -f compose.local.yml down
      if ($LASTEXITCODE -ne 0) { throw "Could not stop the app containers." }
    }
    & $supabaseCommand stop
    if ($LASTEXITCODE -ne 0) { throw "Could not stop local Supabase." }
    return
  }

  Write-Host "Checking Docker's Linux engine..."
  docker info --format '{{.ServerVersion}}'
  if ($LASTEXITCODE -ne 0) { throw "Docker's engine is unavailable. Start Docker Desktop and complete its Linux engine setup before retrying." }

  Write-Host "Starting the local Supabase stack..."
  & $supabaseCommand start | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Supabase failed to start." }

  Write-Host "Applying pending local migrations..."
  & $supabaseCommand migration up --local
  if ($LASTEXITCODE -ne 0) { throw "Local database migrations failed." }

  $statusLines = & $supabaseCommand status -o env
  if ($LASTEXITCODE -ne 0) { throw "Could not read Supabase connection settings." }

  $supabaseValues = @{}
  foreach ($line in $statusLines) {
    if ($line -match '^([A-Z0-9_]+)="?(.*?)"?$') {
      $supabaseValues[$Matches[1]] = $Matches[2].Trim('"')
    }
  }

  foreach ($requiredName in @("API_URL", "SERVICE_ROLE_KEY")) {
    if (-not $supabaseValues[$requiredName]) {
      throw "Supabase status did not include $requiredName. Run 'npx supabase status -o env' to inspect the local setup."
    }
  }
  $publishableKey = $supabaseValues["PUBLISHABLE_KEY"]
  if (-not $publishableKey) { $publishableKey = $supabaseValues["ANON_KEY"] }
  if (-not $publishableKey) {
    throw "Supabase status did not include PUBLISHABLE_KEY or ANON_KEY. Run 'npx supabase status -o env' to inspect the local setup."
  }

  $internalApi = New-Object System.UriBuilder -ArgumentList $supabaseValues["API_URL"]
  $internalApi.Host = "host.docker.internal"
  $internalUrl = $internalApi.Uri.AbsoluteUri.TrimEnd('/')
  $workerToken = $null
  $googleEnabled = $env:AUTH_GOOGLE_ENABLED
  if (Test-Path -LiteralPath ".env.docker") {
    foreach ($line in Get-Content -LiteralPath ".env.docker") {
      if ($line -match '^RENDER_WORKER_TOKEN=([a-f0-9]{64})$') { $workerToken = $Matches[1] }
      if (-not $googleEnabled -and $line -match '^AUTH_GOOGLE_ENABLED=(true|false)$') { $googleEnabled = $Matches[1] }
    }
  }
  if ($googleEnabled -ne "true") { $googleEnabled = "false" }
  if (-not $workerToken) {
    $workerTokenBytes = New-Object byte[] 32
    $randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    $randomGenerator.GetBytes($workerTokenBytes)
    $randomGenerator.Dispose()
    $workerToken = [BitConverter]::ToString($workerTokenBytes).Replace("-", "").ToLowerInvariant()
  }
  $dockerEnv = @(
    "NEXT_PUBLIC_SUPABASE_URL=$($supabaseValues['API_URL'])",
    "SUPABASE_URL_INTERNAL=$internalUrl",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$publishableKey",
    "NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000",
    "AUTH_GOOGLE_ENABLED=$googleEnabled",
    "SUPABASE_SERVICE_ROLE_KEY=$($supabaseValues['SERVICE_ROLE_KEY'])",
    "RENDER_WORKER_TOKEN=$workerToken",
    "RENDER_APP_URL=http://web:3000"
  )
  Set-Content -Path ".env.docker" -Value $dockerEnv -Encoding ascii

  Write-Host "Building and starting the app and render worker..."
  docker compose --env-file .env.docker -f compose.local.yml up --build --detach --wait --wait-timeout 120
  if ($LASTEXITCODE -ne 0) { throw "Docker Compose exited with an error." }
  Write-Host "Local app ready at http://127.0.0.1:3000. Stop it with npm run docker:down."
}
finally {
  $env:PATH = $originalPath
  Pop-Location
}
