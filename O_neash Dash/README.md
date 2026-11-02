# Mycelium

This directory contains the React and Tauri desktop application, adapted from [hanjae-Oneash823/Mycelium](https://github.com/hanjae-Oneash823/Mycelium) at upstream commit `eb93cd9d5b8c34569b95fff0169ffbb0b9196244`.

The maintained documentation lives at the repository level:

- [Setup, everyday use, and Windows installers](../README.md)
- [Verified project status and remaining limitations](../docs/project-status.md)
- [Architecture diagram gallery](../docs/architecture/previews.md)
- [Release notes and changes from the original application](../docs/release-notes.md)

The data parent defaults to Documents. To override it, close Mycelium and set
`data-location.json` in Tauri's app config directory (Windows:
`%APPDATA%/com.oneash.oneash-dash/`) to `{"root":"X:/GitHub/Mycelium-data"}`. The parent must
already exist and must not contain links or junctions. Release and development
continue to use separate `O-neash-data` and `O-neash-data-dev` subfolders. The
location is fixed until restart; invalid configuration stops startup. Move existing
data and update managed image paths before changing this setting; it does not
automatically migrate records. This computer's two environments were relocated
to `X:/GitHub` on 2026-10-19, then grouped with the migration backups under
`X:/GitHub/Mycelium-data` on 2026-10-21.
