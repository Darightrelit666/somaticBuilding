param(
  [string]$BaselineDir = "D:\somaticBuilding\docs\performance\baseline",
  [string]$OptimizedDir = "D:\somaticBuilding\docs\performance\optimized",
  [string]$OutCsv = "D:\somaticBuilding\docs\performance\reports\exercise_list_comparison.csv",
  [string]$OutMd = "D:\somaticBuilding\docs\performance\reports\exercise_list_comparison.md"
)

function Read-Metrics {
  param([string]$Path)
  $json = Get-Content -Path $Path -Raw | ConvertFrom-Json
  return [pscustomobject]@{
    AvgMs = [double]$json.metrics.http_req_duration.avg
    P95Ms = [double]$json.metrics.http_req_duration.'p(95)'
    ErrRatePct = [double]$json.metrics.http_req_failed.value * 100
    Rps = [double]$json.metrics.http_reqs.rate
    TotalReqs = [int64]$json.metrics.http_reqs.count
  }
}

$vusLevels = 20, 50, 100
$rows = @()
foreach ($vus in $vusLevels) {
  $beforePath = Join-Path $BaselineDir ("exercise_list_v{0}_before.json" -f $vus)
  $afterPath = Join-Path $OptimizedDir ("exercise_list_v{0}_after.json" -f $vus)
  if (!(Test-Path $beforePath) -or !(Test-Path $afterPath)) {
    Write-Warning "Missing report files for VUS=$vus"
    continue
  }

  $before = Read-Metrics -Path $beforePath
  $after = Read-Metrics -Path $afterPath

  $rows += [pscustomobject]@{
    VUS = $vus
    AvgMs_Before = [math]::Round($before.AvgMs, 2)
    AvgMs_After = [math]::Round($after.AvgMs, 2)
    AvgMs_ImprovePct = [math]::Round((($before.AvgMs - $after.AvgMs) / $before.AvgMs) * 100, 2)
    P95Ms_Before = [math]::Round($before.P95Ms, 2)
    P95Ms_After = [math]::Round($after.P95Ms, 2)
    P95Ms_ImprovePct = [math]::Round((($before.P95Ms - $after.P95Ms) / $before.P95Ms) * 100, 2)
    ErrorRatePct_Before = [math]::Round($before.ErrRatePct, 4)
    ErrorRatePct_After = [math]::Round($after.ErrRatePct, 4)
    Rps_Before = [math]::Round($before.Rps, 2)
    Rps_After = [math]::Round($after.Rps, 2)
    Rps_GainPct = [math]::Round((($after.Rps - $before.Rps) / $before.Rps) * 100, 2)
    TotalReqs_Before = $before.TotalReqs
    TotalReqs_After = $after.TotalReqs
  }
}

if ($rows.Count -eq 0) {
  throw "No comparison rows generated."
}

$rows | Export-Csv -NoTypeInformation -Encoding UTF8 -Path $OutCsv

$md = @(
  "# Exercise List Performance Comparison",
  "",
  "| VUS | Avg(ms) Before | Avg(ms) After | Avg Improve | P95(ms) Before | P95(ms) After | P95 Improve | Error% Before | Error% After | RPS Before | RPS After | RPS Gain |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
)

foreach ($row in $rows) {
  $md += ("| {0} | {1} | {2} | {3}% | {4} | {5} | {6}% | {7}% | {8}% | {9} | {10} | {11}% |" -f `
    $row.VUS, `
    $row.AvgMs_Before, `
    $row.AvgMs_After, `
    $row.AvgMs_ImprovePct, `
    $row.P95Ms_Before, `
    $row.P95Ms_After, `
    $row.P95Ms_ImprovePct, `
    $row.ErrorRatePct_Before, `
    $row.ErrorRatePct_After, `
    $row.Rps_Before, `
    $row.Rps_After, `
    $row.Rps_GainPct)
}

$md += ""
$md += ("Generated at: {0}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss K"))

$md | Set-Content -Path $OutMd -Encoding UTF8

Write-Host "CSV: $OutCsv"
Write-Host "MD:  $OutMd"
