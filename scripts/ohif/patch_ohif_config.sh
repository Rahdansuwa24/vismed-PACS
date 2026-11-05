#!/bin/bash
TARGET="/var/www/html/ohif/app-config.js"

if [ "$EUID" -ne 0 ]; then
  echo "Please run this script with sudo: sudo $0"
  exit 1
fi

if [ ! -f "$TARGET" ]; then
  echo "Error: App config not found at $TARGET"
  exit 1
fi

# Backup original config if backup doesn't exist
if [ ! -f "${TARGET}.bak" ]; then
  cp "$TARGET" "${TARGET}.bak"
fi

python3 -c '
path = "/var/www/html/ohif/app-config.js"
with open(path, "r") as f:
    content = f.read()

# 1. Patch the transform function to avoid double-slash path duplication
target_transform = "transform:o=>o.replace(\"http://10.9.23.18\",\"\")"
replacement_transform = "transform:o=>o.replace(\"http://10.9.23.18\",\"\").replace(/^\/dicom-web\/studies\/[^/]+\\//, \"\")"

# 2. Add video configuration near pdf under singlepart option
target_singlepart = "singlepart:\"bulkdata,pdf\""
replacement_singlepart = "singlepart:\"bulkdata,pdf,video\""

modified = False

if target_transform in content:
    content = content.replace(target_transform, replacement_transform)
    modified = True
    print("✅ Patch 1/2 (URL transform) configured for replacement.")

if target_singlepart in content:
    content = content.replace(target_singlepart, replacement_singlepart)
    modified = True
    print("✅ Patch 2/2 (singlepart video) configured for replacement.")

if modified:
    with open(path, "w") as f:
        f.write(content)
    print("✅ OHIF app-config.js patched successfully using Python!")
else:
    print("ℹ️ Note: Target strings already replaced or not found in app-config.js.")
'
