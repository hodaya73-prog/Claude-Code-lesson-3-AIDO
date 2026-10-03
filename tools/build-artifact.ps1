# Builds dist/artifact.html: the whole site as ONE self-contained HTML file for a Claude Artifact.
# (Artifacts allow only inline CSS/JS and Google Fonts, so styles and scripts are inlined.)
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File tools/build-artifact.ps1
$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Read($p) { [System.IO.File]::ReadAllText((Join-Path $root $p), $utf8) }

$index = Read 'index.html'
$body = [regex]::Match($index, '(?s)<body>(.*?)<script src="js/logic\.js">').Groups[1].Value
$css = Read 'css/styles.css'
$scripts = ('logic', 'sheets', 'apify', 'sample', 'i18n', 'app') | ForEach-Object { "<script>`n" + (Read "js/$_.js") + "`n</script>" }
if ($scripts -match '</script>.*</script>') { }  # scripts must not contain a closing tag inside: checked below
foreach ($s in ('logic', 'sheets', 'apify', 'sample', 'i18n', 'app')) { if ((Read "js/$s.js") -match '</script') { throw "js/$s.js contains </script" } }

$html = @"
<title>StudyPlanner</title>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
$css
</style>
$body
<script>window.SP_HOSTED = true;</script>
$($scripts -join "`n")
"@

New-Item -ItemType Directory -Force (Join-Path $root 'dist') | Out-Null
$out = Join-Path $root 'dist/artifact.html'
[System.IO.File]::WriteAllText($out, $html, $utf8)
"{0} ({1:N0} KB)" -f $out, ((Get-Item $out).Length / 1KB)
