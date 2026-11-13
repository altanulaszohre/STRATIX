#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
app="$work/STRATIX.app"
res="$app/Contents/Resources"
mkdir -p "$res" "$app/Contents/MacOS" downloads
cp macos/Info.plist "$app/Contents/Info.plist"
mkdir -p "$res/game"
rsync -a --exclude=".DS_Store" --exclude="._*" dist/ "$res/game/"

cp macos/STRATIX.icns "$res/STRATIX.icns"
for arch in arm64 x86_64; do
    xcrun swiftc -O -swift-version 5 -module-cache-path "$work/modules" -target "${arch}-apple-macos13.0" macos/Launcher.swift -o "$work/$arch"
done
lipo -create "$work/arm64" "$work/x86_64" -output "$app/Contents/MacOS/STRATIX"
codesign --force --sign - --timestamp=none "$app"
codesign --verify --strict "$app"
(cd "$work" && /usr/bin/zip -q -X -r STRATIX-macOS.zip STRATIX.app)
# Replace the complete old bundle so stale assets cannot survive a new build.
if [ -e STRATIX.app ]; then mv STRATIX.app "$work/previous.app"; fi
mv "$app" STRATIX.app
mv "$work/STRATIX-macOS.zip" downloads/STRATIX-macOS.zip
