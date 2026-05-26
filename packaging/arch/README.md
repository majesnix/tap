# Arch Linux packaging

This directory contains an Arch Linux `PKGBUILD` for building Tap as a native pacman package.

## Install from source (local build)

```bash
git clone https://github.com/majesnix/tap.git
cd tap/packaging/arch
makepkg -si
```

`makepkg -si` builds from the current working tree and then installs the resulting `tap-<version>-1-x86_64.pkg.tar.zst` via `pacman -U`.

## Install pre-built package (GitHub Release)

Each tagged release publishes a pre-built `tap-<version>-1-x86_64.pkg.tar.zst` alongside the macOS and AppImage artifacts.

```bash
curl -LO https://github.com/majesnix/tap/releases/latest/download/tap-1.8.2-1-x86_64.pkg.tar.zst
sudo pacman -U tap-1.8.2-1-x86_64.pkg.tar.zst
```

## Runtime dependencies

The package depends on `webkit2gtk-4.1`, `gtk3`, `libappindicator-gtk3`, `librsvg`, and `openssl`. These are pulled in automatically by `pacman -U`.

## Files

- `PKGBUILD` — build recipe used by `makepkg` and by the CI Arch build job.
- `tap.desktop` — XDG desktop entry installed under `/usr/share/applications/`.
