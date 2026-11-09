param(
    [string]$Database = 'CNPM',
    [string]$Username = 'postgres',
    [int]$Port = 5432,
    [string]$PgBin = 'C:\Program Files\PostgreSQL\18\bin'
)

$ErrorActionPreference = 'Stop'
$psqlPath = Join-Path $PgBin 'psql.exe'
if (-not (Test-Path -LiteralPath $psqlPath)) {
    throw 'psql.exe was not found. Supply -PgBin with your PostgreSQL bin directory.'
}
$securePassword = Read-Host "PostgreSQL password for $Username (not saved)" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$previousPassword = $env:PGPASSWORD
$previousTimeout = $env:PGCONNECT_TIMEOUT
try {
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $env:PGCONNECT_TIMEOUT = '5'
    $connectionQuery = @'
SELECT quote_literal(current_database()) AS database_name, current_user AS username,
       inet_server_addr() AS server_address, inet_server_port() AS port;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
SELECT to_regclass('public.users') AS users_table,
       to_regclass('public.roles') AS roles_table,
       to_regclass('public.rooms') AS rooms_table,
       to_regclass('public.bookings') AS bookings_table,
       to_regclass('public.flyway_schema_history') AS migration_history;
'@
    & $psqlPath -X -w -h localhost -p $Port -U $Username -d $Database -v ON_ERROR_STOP=1 -c $connectionQuery
    if ($LASTEXITCODE -ne 0) { throw 'Connection failed. Check the password, database name, port and username.' }
    Write-Host 'PostgreSQL connection OK. This check did not change any data.' -ForegroundColor Green
} finally {
    $env:PGPASSWORD = $previousPassword
    $env:PGCONNECT_TIMEOUT = $previousTimeout
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    $securePassword.Dispose()
}
