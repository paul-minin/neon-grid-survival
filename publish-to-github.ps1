# Run this in PowerShell in the project folder to initialize a repo and push to GitHub
# Usage:
# 1. Create a repo on GitHub (no README required) and copy the remote URL (HTTPS or SSH)
# 2. Run: .\publish-to-github.ps1 -RemoteUrl "https://github.com/USERNAME/REPO.git"
param(
  [Parameter(Mandatory=$true)] [string] $RemoteUrl
)
if(-not (Test-Path .git)){
  git init
  git add .
  git commit -m "Add Neon Grid Survival"
  git branch -M main
  git remote add origin $RemoteUrl
}

git push -u origin main
Write-Host "Push complete. Enable GitHub Pages in repo settings (Branch: main, root /)." -ForegroundColor Green