<# : batch part
@echo off
chcp 65001 >nul
title Loopy Office 설치
set "LOOPY_SELF=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ([IO.File]::ReadAllText($env:LOOPY_SELF,[Text.Encoding]::UTF8))"
echo.
pause
exit /b
#>
# Loopy Office 설치 도우미 (Windows)
# 이 파일은 설치본을 담고 있지 않아요. 더블클릭하면 이 프로젝트의 GitHub Releases에서 최신 Windows
# 설치본을 받아, latest.yml에 적힌 SHA-512와 맞는지 확인한 뒤 설치 프로그램을 실행해요.
# 버전이 바뀌어도 이 파일 하나로 늘 최신 버전이 설치돼요.
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$releases='https://github.com/yjkim-9412/loopy-office-pet/releases/latest'
$base="$releases/download"
$dir=Join-Path $env:TEMP ('loopy-office-'+[guid]::NewGuid().ToString('N'))
Write-Host ''
Write-Host '  Loopy Office 설치 도우미' -ForegroundColor Magenta
Write-Host '  루피를 참고해 만든 비상업용 팬 제작 데스크톱 펫이에요. 판매하거나 다른 곳에 올리지 말아 주세요.'
Write-Host ''
try{
  New-Item -ItemType Directory -Path $dir | Out-Null
  $yml=Join-Path $dir 'latest.yml'
  Write-Host '  1/3 최신 버전을 확인하고 있어요...'
  Invoke-WebRequest -Uri "$base/latest.yml" -OutFile $yml -UseBasicParsing
  $info=[IO.File]::ReadAllText($yml)
  $version=([regex]'(?m)^version:\s*(\S+)').Match($info).Groups[1].Value
  $name=([regex]'(?m)^path:\s*(\S+)').Match($info).Groups[1].Value
  $sha=([regex]'(?m)^sha512:\s*(\S+)').Match($info).Groups[1].Value
  if(-not $version -or -not $name -or -not $sha -or $name -notmatch '^LoopyOffice-Setup-[\w.-]+\.exe$'){throw '최신 버전 정보를 읽지 못했어요.'}
  Write-Host "  2/3 Loopy Office $version 설치 파일을 받고 있어요. 1~2분쯤 걸려요..."
  $exe=Join-Path $dir $name
  Invoke-WebRequest -Uri "$base/$name" -OutFile $exe -UseBasicParsing
  $stream=[IO.File]::OpenRead($exe)
  try{$got=[Convert]::ToBase64String([Security.Cryptography.SHA512]::Create().ComputeHash($stream))}finally{$stream.Dispose()}
  if($got -ne $sha){throw '받은 파일이 GitHub Releases에 올라간 파일과 달라요. 다시 실행해 주세요.'}
  Write-Host '  3/3 확인 끝! 설치 창이 잠깐 떴다가 닫히면 루피가 화면에 나타나요.'
  if($env:LOOPY_SHARE_DRYRUN){Write-Host "  (확인용 실행이라 설치는 건너뛰었어요: $name)";return}
  $setup=Start-Process -FilePath $exe -PassThru
  $setup.WaitForExit()
  if($setup.ExitCode -ne 0){throw "설치 프로그램이 오류 코드 $($setup.ExitCode)로 끝났어요."}
  Write-Host ''
  Write-Host '  설치가 끝났어요! 앞으로 새 버전은 루피가 알아서 받아요. 이 창은 닫아도 돼요.' -ForegroundColor Green
}catch{
  Write-Host ''
  Write-Host ('  설치하지 못했어요: '+$_.Exception.Message) -ForegroundColor Red
  Write-Host "  인터넷 연결을 확인하고 다시 실행하거나, $releases 에서 LoopyOffice-Setup 파일을 직접 받아 주세요."
}finally{
  if(Test-Path $dir){Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue}
}
