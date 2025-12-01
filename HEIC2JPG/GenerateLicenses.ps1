$ErrorActionPreference = "Stop"
$env:DOTNET_ROLL_FORWARD = 'Major'

# Run the tool and capture output
$output = dotnet tool run dotnet-project-licenses -i .

# Parse the output
$licenses = @()
$startParsing = $false

foreach ($line in $output) {
    if ($line -match "\|\s*Reference\s*\|\s*Version\s*\|") {
        $startParsing = $true
        continue
    }
    if (-not $startParsing) { continue }
    if ($line -match "^\s*\|-") { continue } # Skip separator line
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    $parts = $line.Split('|')
    if ($parts.Count -ge 5) {
        $name = $parts[1].Trim()
        $version = $parts[2].Trim()
        $licenseType = $parts[3].Trim()
        $url = $parts[4].Trim()

        if (-not [string]::IsNullOrEmpty($name)) {
            $licenses += @{
                PackageName = $name
                Version = $version
                LicenseType = $licenseType
                LicenseUrl = $url
            }
        }
    }
}

# Manual licenses
$manualLicenses = @(
    @{
        PackageName = "ffmpeg.wasm"
        Version = "0.12.15" # From CDN URL in index.html
        LicenseType = "LGPL-2.1 / GPL (may contain GPL components)"
        LicenseUrl = "https://github.com/ffmpegwasm/ffmpeg.wasm/blob/master/LICENSE"
    },
    @{
        PackageName = "libheif-wasm"
        Version = "1.17.1" # Verify version if possible
        LicenseType = "LGPL-3.0"
        LicenseUrl = "https://github.com/strukturag/libheif/blob/master/COPYING"
    },
    @{
        PackageName = "Bootstrap"
        Version = "5.3.2" # Verify version if possible
        LicenseType = "MIT"
        LicenseUrl = "https://github.com/twbs/bootstrap/blob/main/LICENSE"
    },
    @{
        PackageName = "JSZip"
        Version = "3.10.1" # Verify version if possible
        LicenseType = "MIT"
        LicenseUrl = "https://github.com/Stuk/jszip/blob/master/LICENSE.markdown"
    },
    @{
        PackageName = "HeroIcons"
        Version = "2.0.18" # Verify version if possible
        LicenseType = "MIT"
        LicenseUrl = "https://github.com/tailwindlabs/heroicons/blob/master/LICENSE"
    }
)

$licenses += $manualLicenses

# Convert to JSON
$json = $licenses | ConvertTo-Json -Depth 2

# Write to file
$outputPath = Join-Path "wwwroot" "licenses.json"
$json | Out-File $outputPath -Encoding utf8

Write-Host "Generated $outputPath with $($licenses.Count) licenses."
