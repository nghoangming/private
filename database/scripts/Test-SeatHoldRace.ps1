param([string]$Database,[string]$PgBin='C:\Program Files\PostgreSQL\18\bin',
 [string]$Server='127.0.0.1',[int]$Port=55439,[string]$Username='postgres')
$ErrorActionPreference='Stop'
if($Database -notmatch '^campus_rc_[a-f0-9]+$'){throw 'Only isolated release-test databases are allowed'}
$psql=Join-Path $PgBin 'psql.exe'
$connection=@('-X','-w','-h',$Server,'-p',"$Port",'-U',$Username,'-d',$Database,'-v','ON_ERROR_STOP=1')
$fixture=@'
INSERT INTO users(user_code,full_name,email,password_hash) VALUES('race-student','Race','race@test.invalid','test');
INSERT INTO user_roles SELECT u.user_id,r.role_id FROM users u CROSS JOIN roles r WHERE u.user_code='race-student' AND r.role_name='STUDENT';
INSERT INTO rooms(room_code,name,status) VALUES('A-RACE','Race','ACTIVE');
INSERT INTO seats(room_id,seat_number,status) SELECT room_id,1,'AVAILABLE' FROM rooms WHERE room_code='A-RACE';
INSERT INTO bookings(user_id,room_id,start_time,end_time,status)
 SELECT u.user_id,r.room_id,'2097-01-01 08:00+07','2097-01-01 10:00+07','CONFIRMED' FROM users u CROSS JOIN rooms r WHERE u.user_code='teacher' AND r.room_code='A-RACE';
INSERT INTO class_sessions(booking_id,course_code,title,room_id,start_time,end_time)
 SELECT b.booking_id,'RACE','Race',b.room_id,b.start_time,b.end_time FROM bookings b JOIN rooms r USING(room_id) WHERE r.room_code='A-RACE';
'@
& $psql @connection -c $fixture
if($LASTEXITCODE -ne 0){throw 'Race fixture failed'}
$jobs=@()
try {
 foreach($student in @('student','race-student')) {
  $sql="BEGIN; SELECT hold_class_seat(cs.class_session_id,s.seat_id,u.user_id) FROM class_sessions cs JOIN rooms r USING(room_id) JOIN seats s USING(room_id) CROSS JOIN users u WHERE r.room_code='A-RACE' AND u.user_code='$student'; SELECT pg_sleep(1); COMMIT;"
  $jobs+=Start-Job -ScriptBlock {
   param($exe,$arguments,$query)
   $out=& $exe @arguments -v VERBOSITY=verbose -c $query 2>&1
   [pscustomobject]@{Code=$LASTEXITCODE;Output=($out -join "`n")}
  } -ArgumentList $psql,$connection,$sql
 }
 $results=@($jobs | Wait-Job | Receive-Job)
 $results | Format-List Code,Output
 if(@($results | Where-Object Code -eq 0).Count -ne 1){throw 'Expected exactly one winning transaction'}
 if(@($results | Where-Object { $_.Code -ne 0 -and $_.Output -match '23505' }).Count -ne 1){throw 'Expected losing transaction to fail with unique violation'}
 $count=& $psql @connection -q -A -t -c "SELECT count(*) FROM seat_reservations sr JOIN rooms r USING(room_id) WHERE r.room_code='A-RACE' AND sr.status IN ('PENDING','CONFIRMED');"
 if($LASTEXITCODE -ne 0 -or "$count".Trim() -ne '1'){throw 'Expected exactly one active seat reservation'}
 'PASS: two concurrent connections, exactly one hold commits; loser receives SQLSTATE 23505; no double booking.'
} finally {
 $jobs | Remove-Job -Force
 $cleanup=@'
DELETE FROM seat_reservations WHERE room_id IN(SELECT room_id FROM rooms WHERE room_code='A-RACE');
DELETE FROM class_sessions WHERE room_id IN(SELECT room_id FROM rooms WHERE room_code='A-RACE');
DELETE FROM bookings WHERE room_id IN(SELECT room_id FROM rooms WHERE room_code='A-RACE');
DELETE FROM seats WHERE room_id IN(SELECT room_id FROM rooms WHERE room_code='A-RACE');
DELETE FROM rooms WHERE room_code='A-RACE';
DELETE FROM user_roles WHERE user_id IN(SELECT user_id FROM users WHERE user_code='race-student');
DELETE FROM users WHERE user_code='race-student';
'@
 & $psql @connection -c $cleanup
 if($LASTEXITCODE -ne 0){throw 'Race fixture cleanup failed'}
}
