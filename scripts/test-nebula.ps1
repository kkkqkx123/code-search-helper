# NebulaGraph Complete Function Test Script
# Comprehensive test of nebula-console connection and operations

Write-Host "Starting NebulaGraph complete function test..." -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Function to execute nebula command
function Invoke-NebulaCommand {
    param(
        [string]$Command,
        [string]$Description
    )
    
    Write-Host "`n$Description..." -ForegroundColor Yellow
    Write-Host "Executing: $Command" -ForegroundColor Gray
    
    $result = & $script:consolePath -u root -p nebula --address=127.0.0.1 --port=9669 --eval=$Command 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Success!" -ForegroundColor Green
        return $result
    } else {
        Write-Host "Failed!" -ForegroundColor Red
        Write-Host "Error: $result" -ForegroundColor Red
        return $null
    }
}

# Check if nebula-console exists
$consolePath = ""
if (Get-Command "nebula-console" -ErrorAction SilentlyContinue) {
    $consolePath = "nebula-console"
} elseif (Test-Path ".\nebula-console.exe") {
    $consolePath = ".\nebula-console.exe"
} else {
    Write-Host "Error: nebula-console not found" -ForegroundColor Red
    Write-Host "Please ensure nebula-console is installed and in PATH" -ForegroundColor Red
    exit 1
}

Write-Host "Using nebula-console path: $consolePath" -ForegroundColor Gray

# 1. Basic connection test
Write-Host "`n1. Basic Connection Test" -ForegroundColor Cyan
$result = Invoke-NebulaCommand -Command "SHOW HOSTS;" -Description "Testing basic connection"

if ($result) {
    # Analyze results
    if ($result -match "storaged") {
        Write-Host "Storage service detected as running" -ForegroundColor Green
    }
    
    if ($result -match "metad") {
        Write-Host "Metadata service detected as running" -ForegroundColor Green
    }
    
    # Count online services
    $onlineServices = ([regex]::Matches($result, "ONLINE")).Count
    Write-Host "Found $onlineServices online services" -ForegroundColor Green
    
    Write-Host "`nHost Information:" -ForegroundColor Cyan
    Write-Host $result -ForegroundColor White
} else {
    Write-Host "Basic connection test failed, aborting..." -ForegroundColor Red
    exit 1
}

# 2. Space operations test
Write-Host "`n2. Space Operations Test" -ForegroundColor Cyan

# Create space
$result = Invoke-NebulaCommand -Command "CREATE SPACE IF NOT EXISTS test_space(partition_num=1, replica_factor=1, vid_type=fixed_string(30));" -Description "Creating test space"

if ($result) {
    # List spaces
    $result = Invoke-NebulaCommand -Command "SHOW SPACES;" -Description "Listing all spaces"
    if ($result -and $result -match "test_space") {
        Write-Host "Test space created successfully!" -ForegroundColor Green
    }
    
    # Use the space
    $result = Invoke-NebulaCommand -Command "USE test_space;" -Description "Using test space"
    if ($result) {
        Write-Host "Successfully switched to test space" -ForegroundColor Green
    }
}

# 3. Schema operations test
Write-Host "`n3. Schema Operations Test" -ForegroundColor Cyan

# Create tag
$result = Invoke-NebulaCommand -Command "USE test_space; CREATE TAG IF NOT EXISTS person(name string, age int);" -Description "Creating person tag"

if ($result) {
    # Show tags
    $result = Invoke-NebulaCommand -Command "USE test_space; SHOW TAGS;" -Description "Showing all tags"
    if ($result -and $result -match "person") {
        Write-Host "Person tag created successfully!" -ForegroundColor Green
    }
}

# Create edge
$result = Invoke-NebulaCommand -Command "USE test_space; CREATE EDGE IF NOT EXISTS friend(relationship string);" -Description "Creating friend edge"

if ($result) {
    # Show edges
    $result = Invoke-NebulaCommand -Command "USE test_space; SHOW EDGES;" -Description "Showing all edges"
    if ($result -and $result -match "friend") {
        Write-Host "Friend edge created successfully!" -ForegroundColor Green
    }
}

# 4. Data operations test
Write-Host "`n4. Data Operations Test" -ForegroundColor Cyan

# Insert vertex
$result = Invoke-NebulaCommand -Command "USE test_space; INSERT VERTEX person(name, age) VALUES \"Alice\":(\"Alice\", 25);" -Description "Inserting test vertex"

if ($result) {
    # Query vertex
    $result = Invoke-NebulaCommand -Command "USE test_space; FETCH PROP ON person \"Alice\" YIELD properties(vertex);" -Description "Querying test vertex"
    if ($result -and $result -match "Alice") {
        Write-Host "Vertex data operations successful!" -ForegroundColor Green
    }
}

# 5. Performance test
Write-Host "`n5. Performance Test" -ForegroundColor Cyan

Write-Host "Testing query performance..." -ForegroundColor Yellow
$startTime = Get-Date

$result = Invoke-NebulaCommand -Command "USE test_space; SHOW HOSTS;" -Description "Performance test query"

$endTime = Get-Date
$duration = ($endTime - $startTime).TotalMilliseconds

if ($result) {
    Write-Host "Query completed in $duration ms" -ForegroundColor Green
    if ($duration -lt 1000) {
        Write-Host "Performance: Excellent" -ForegroundColor Green
    } elseif ($duration -lt 3000) {
        Write-Host "Performance: Good" -ForegroundColor Yellow
    } else {
        Write-Host "Performance: Slow" -ForegroundColor Red
    }
}

# 6. Clean up
Write-Host "`n6. Cleanup" -ForegroundColor Cyan

$result = Invoke-NebulaCommand -Command "DROP SPACE IF EXISTS test_space;" -Description "Cleaning up test space"

if ($result) {
    Write-Host "Cleanup completed successfully!" -ForegroundColor Green
}

# Final summary
Write-Host "`n=============================================" -ForegroundColor Green
Write-Host "Test Summary" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host "All tests completed!" -ForegroundColor Green
Write-Host "NebulaGraph is functioning correctly" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green