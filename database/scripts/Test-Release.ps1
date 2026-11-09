param(
 [string]$PgBin='C:\Program Files\PostgreSQL\18\bin',
 [string]$Server='127.0.0.1', [int]$Port=55439, [string]$Username='postgres',
 [string]$EvidencePath=(Join-Path $PSScriptRoot '../evidence'),
 [string]$BackupDirectory=(Join-Path $env:TEMP 'campus-release-backups')
)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
New-Item -ItemType Directory -Force $EvidencePath,$BackupDirectory | Out-Null
$id=[guid]::NewGuid().ToString('N').Substring(0,12)
$sourceDb="campus_rc_$id"
$restoredDb="campus_restore_$id"
$connection=@('-h',$Server,'-p',"$Port",'-U',$Username)
function Invoke-Pg([string]$Tool,[string[]]$Arguments,[string]$Log) {
 $result=& (Join-Path $PgBin "$Tool.exe") @Arguments 2>&1
 $code=$LASTEXITCODE
 $result | Out-File (Join-Path $EvidencePath $Log) -Append -Encoding utf8
 if($code -ne 0){throw "$Tool failed; see $Log"}
}
# Creates only new randomly named databases. Never migrates an existing project DB.
Invoke-Pg 'createdb' ($connection+@($sourceDb)) 'release-run.log'
foreach($file in (Get-ChildItem "$root/migrations/*.sql" | Sort-Object Name)) {
 Invoke-Pg 'psql' ($connection+@('-X','-w','-d',$sourceDb,'-v','ON_ERROR_STOP=1','-f',$file.FullName)) 'release-run.log'
}
foreach($test in @('verify_reservation_constraints','verify_checkin_codes','verify_seat_holds','release_rls','release_integrity','release_query_plan')) {
 Invoke-Pg 'psql' ($connection+@('-X','-w','-d',$sourceDb,'-v','ON_ERROR_STOP=1','-f',"$root/tests/$test.sql")) "$test.log"
}
& (Join-Path $PSScriptRoot 'Test-SeatHoldRace.ps1') -Database $sourceDb -PgBin $PgBin -Server $Server -Port $Port -Username $Username *> (Join-Path $EvidencePath 'seat-hold-race.log')
$backup=Join-Path $BackupDirectory "$sourceDb.dump"
Invoke-Pg 'pg_dump' ($connection+@('-w','-d',$sourceDb,'-Fc','-f',$backup)) 'release-run.log'
Invoke-Pg 'createdb' ($connection+@($restoredDb)) 'release-run.log'
Invoke-Pg 'pg_restore' ($connection+@('-w','-d',$restoredDb,'--exit-on-error',$backup)) 'release-run.log'
foreach($item in @(@($sourceDb,'source'),@($restoredDb,'restored'))) {
 $db=$item[0]; $label=$item[1]
 $fingerprint=& (Join-Path $PgBin 'psql.exe') @connection -X -w -q -A -t -d $db -v ON_ERROR_STOP=1 -f "$root/scripts/release_fingerprint.sql" 2>&1
 if($LASTEXITCODE -ne 0){throw 'Fingerprint failed'}
 $fingerprint | Set-Content (Join-Path $EvidencePath "$label-fingerprint.txt") -Encoding utf8
 Invoke-Pg 'psql' ($connection+@('-X','-w','-d',$db,'-v','ON_ERROR_STOP=1','-f',"$root/tests/release_integrity.sql")) "$label-integrity.log"
}
if(Compare-Object (Get-Content (Join-Path $EvidencePath 'source-fingerprint.txt')) (Get-Content (Join-Path $EvidencePath 'restored-fingerprint.txt'))) {throw 'Restore fingerprint mismatch'}
@("PASS: migrations 001-016, constraint/fixed-room-resource/check-in/seat-hold tests, concurrent seat-hold race, limited RLS test, integrity, backup/restore.",
 "UTC: $([DateTime]::UtcNow.ToString('o'))", "Server: ${Server}:$Port", "Source: $sourceDb", "Restored: $restoredDb",
 "Backup: $backup", "SHA256: $((Get-FileHash $backup -Algorithm SHA256).Hash)",
 'PASS: every public table row count/digest and sequence state matches restored DB.',
 'Scope: isolated seeded DB; not evidence for existing CNPM data or API authentication.') |
 Set-Content (Join-Path $EvidencePath 'RESULT.txt') -Encoding utf8
Get-Content (Join-Path $EvidencePath 'RESULT.txt')


