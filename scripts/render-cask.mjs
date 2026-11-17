// Writes Clipboard's Homebrew cask for a release, pinned to its version and zip checksum.
// usage: node scripts/render-cask.mjs <cask.rb> <version> <sha256>
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { compareVersions } from './next-version.mjs'

export function renderCask({ version, sha256 }) {
  compareVersions(version, version) // throws unless it's X.Y.Z
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error(`Not a sha256: ${sha256}`)
  return `cask "clipboard" do
  version "${version}"
  sha256 "${sha256}"

  url "https://github.com/devbymak/clipboard/releases/download/v#{version}/Clipboard-#{version}.zip"
  name "Clipboard"
  desc "Menu bar clipboard history that keeps text and images"
  homepage "https://github.com/devbymak/clipboard"

  depends_on arch: :arm64
  depends_on macos: :ventura

  app "Clipboard.app"

  postflight_steps do
    # Clipboard is distributed outside Apple's notarization service.
    run "/usr/bin/xattr", args: ["-dr", "com.apple.quarantine", "{{appdir}}/Clipboard.app"]
  end

  # Quitting saves the history before the app is removed.
  uninstall quit: "local.clipboard"

  # History, pins and preferences all live in the app's sandbox container.
  zap trash: "~/Library/Containers/local.clipboard"
end
`
}

/** The version a cask is pinned to; null when there's no cask yet. */
export function caskVersion(text) {
  return /^\s*version "(\d+\.\d+\.\d+)"/m.exec(text)?.[1] ?? null
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, version, sha256] = process.argv.slice(2)
  const current = existsSync(file) ? caskVersion(readFileSync(file, 'utf8')) : null
  // Re-running an old release's job must not move Homebrew users back.
  if (current && compareVersions(version, current) < 0) throw new Error(`The cask is already at ${current}, newer than ${version}`)
  writeFileSync(file, renderCask({ version, sha256 }))
}
