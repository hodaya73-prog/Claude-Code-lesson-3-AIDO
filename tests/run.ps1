<#
  Runs tests/ and evals/ in a headless Chrome or Edge and exits with code 1 if either fails.

  The same script is used by a developer (powershell -File tests/run.ps1), by the pre-push hook (.githooks/pre-push) and
  by CI (.github/workflows/test.yml, which runs it with pwsh on Linux). It starts tools/serve.ps1 on a spare port, opens
  tests/ and evals/ in the browser, and reads the tab title the pages set when they finish:
  "PASSED <n>" / "EVALS PASSED <n>" on success, "... FAILED" when a check fails.

  Options:  -Port 5199        port for the temporary server
            -Browser <path>   chrome.exe / msedge.exe / google-chrome (default: look for one)
#>
param([int]$Port = 5199, [string]$Browser = '')

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8   # the pages print Hebrew
$root = Split-Path -Parent $PSScriptRoot

function Find-Browser {
  $candidates = @(
    $Browser, $env:CHROME_BIN,
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser')
  foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
  foreach ($n in 'google-chrome', 'chromium', 'chrome', 'msedge') {
    $cmd = Get-Command $n -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
  }
  throw 'No Chrome or Edge found. Install one, or pass -Browser <path>.'
}

$clock = [System.Diagnostics.Stopwatch]::StartNew()
$browser = Find-Browser
Write-Host "browser: $browser"

# static server in the background (a job, so it is stopped even when something below throws)
$serve = Join-Path $root 'tools/serve.ps1'
$isWindows = $env:OS -eq 'Windows_NT'
$psExe = (Get-Process -Id $PID).Path      # the PowerShell that is running this script (powershell.exe or pwsh)
$serverArgs = @('-NoProfile', '-File', "`"$serve`"", '-Port', $Port)   # quoted: the repo path may contain spaces
if ($isWindows) { $serverArgs = @('-ExecutionPolicy', 'Bypass') + $serverArgs }
$serverStart = @{ FilePath = $psExe; ArgumentList = $serverArgs; PassThru = $true }
if ($isWindows) { $serverStart.WindowStyle = 'Hidden' }
# a separate process, not a job: the server sits in a blocking GetContext() call that Stop-Job cannot interrupt (it took ~2 minutes)
$server = Start-Process @serverStart
$failed = $false
try {
  $ready = $false
  for ($i = 0; $i -lt 40 -and -not $ready; $i++) {
    try { $ready = (Invoke-WebRequest -Uri "http://localhost:$Port/tests/" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 }
    catch { Start-Sleep -Milliseconds 250 }
  }
  if (-not $ready) { throw "the test server did not start on port $Port (is the port in use?)" }
  Write-Host ("server ready after {0:N1}s" -f $clock.Elapsed.TotalSeconds)

  foreach ($page in @('tests/', 'evals/')) {
    $tag = [guid]::NewGuid().ToString('N')
    $profileDir = Join-Path ([System.IO.Path]::GetTempPath()) "studyplanner-$tag"
    $domFile = Join-Path ([System.IO.Path]::GetTempPath()) "studyplanner-$tag.html"
    $errFile = Join-Path ([System.IO.Path]::GetTempPath()) "studyplanner-$tag.err"
    $browserArgs = @('--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--disable-extensions',
                     "--user-data-dir=$profileDir", '--virtual-time-budget=15000', '--dump-dom', "http://localhost:$Port/$page")
    # Start-Process with redirected files: on Windows the browser's stdout is lost when it is called with & and piped
    $proc = @{ FilePath = $browser; ArgumentList = $browserArgs; RedirectStandardOutput = $domFile; RedirectStandardError = $errFile; Wait = $true }
    if ($env:OS -eq 'Windows_NT') { $proc.WindowStyle = 'Hidden' }
    Start-Process @proc
    $dom = if (Test-Path $domFile) { [System.IO.File]::ReadAllText($domFile, [System.Text.Encoding]::UTF8) } else { '' }
    Remove-Item $profileDir, $domFile, $errFile -Recurse -Force -ErrorAction SilentlyContinue

    $title = [regex]::Match($dom, '<title>([^<]*)</title>').Groups[1].Value
    $ok = $title -match '^(EVALS )?PASSED \d+$'
    Write-Host ("{0,-8} {1}   ({2:N1}s)" -f $page, $title, $clock.Elapsed.TotalSeconds)
    foreach ($m in [regex]::Matches($dom, '<li class="info">([^<]*)</li>')) {
      Write-Host ('  ' + [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value).Split("`n")[0])   # the headline of each eval score
    }
    if (-not $ok) {
      $failed = $true
      $fails = [regex]::Matches($dom, '<li class="fail">([^<]*)</li>')
      if ($fails.Count -eq 0) { Write-Host '  the page did not finish (a script error or a timeout) - open it in a browser to see why' }
      foreach ($m in $fails) { Write-Host ('  ' + [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value)) }
    }
  }
}
finally {
  if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
}

Write-Host ("total {0:N1}s" -f $clock.Elapsed.TotalSeconds)
if ($failed) { Write-Host 'RESULT: FAILED'; exit 1 }
Write-Host 'RESULT: all tests and evals passed'
exit 0
