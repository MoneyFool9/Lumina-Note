import * as fs from 'fs';
import * as path from 'path';

// Script to generate latest.json for Tauri v2 updater.
// Supports macOS (aarch64, x86_64) and Windows (x64).

interface PlatformInfo {
    signature: string;
    url: string;
}

interface UpdaterInfo {
    version: string;
    notes: string;
    pub_date: string;
    platforms: {
        [key: string]: PlatformInfo;
    };
}

function getVersion(): string {
    const confPath = path.resolve(process.cwd(), 'src-tauri', 'tauri.conf.json');
    const conf = JSON.parse(fs.readFileSync(confPath, 'utf-8'));
    return conf.version;
}

function getSignature(platform: string, arch: string): string {
    const version = getVersion();
    let sigPath = '';

    if (platform === 'darwin') {
        const archSuffix = arch === 'aarch64' ? 'aarch64' : 'x64';
        sigPath = path.resolve(process.cwd(), 'src-tauri', 'target', 'release', 'bundle', 'macos', `lumina-note_${version}_${archSuffix}.app.tar.gz.sig`);
    } else if (platform === 'windows') {
        // Tauri v2 Windows updater typically uses .nsis.zip or .msi.zip
        // We'll check for both, prioritizing nsis as it's more common for updates
        const nsisPath = path.resolve(process.cwd(), 'src-tauri', 'target', 'release', 'bundle', 'nsis', `lumina-note_${version}_x64-setup.nsis.zip.sig`);
        const msiPath = path.resolve(process.cwd(), 'src-tauri', 'target', 'release', 'bundle', 'msi', `lumina-note_${version}_x64_en-US.msi.zip.sig`);
        sigPath = fs.existsSync(nsisPath) ? nsisPath : msiPath;
    }

    if (sigPath && fs.existsSync(sigPath)) {
        return fs.readFileSync(sigPath, 'utf-8').trim();
    }

    // Fallback: check current directory (useful for CI when artifacts are collected)
    const fallbackName = platform === 'darwin'
        ? `lumina-note_${version}_${arch === 'aarch64' ? 'aarch64' : 'x64'}.app.tar.gz.sig`
        : `lumina-note_${version}_x64-setup.nsis.zip.sig`;

    const fallbackPath = path.resolve(process.cwd(), fallbackName);
    if (fs.existsSync(fallbackPath)) {
        return fs.readFileSync(fallbackPath, 'utf-8').trim();
    }

    console.warn(`Signature not found for ${platform}-${arch}`);
    return '';
}

function generate(): void {
    const version = getVersion();
    const notes = `Lumina Note version ${version}`;
    const pub_date = new Date().toISOString();

    const repo = "ccasJay/Lumina-Note";
    const baseUrl = `https://github.com/${repo}/releases/download/v${version}`;

    const info: UpdaterInfo = {
        version,
        notes,
        pub_date,
        platforms: {
            "darwin-aarch64": {
                signature: getSignature("darwin", "aarch64"),
                url: `${baseUrl}/lumina-note_${version}_aarch64.app.tar.gz`
            },
            "darwin-x86_64": {
                signature: getSignature("darwin", "x86_64"),
                url: `${baseUrl}/lumina-note_${version}_x64.app.tar.gz`
            },
            "windows-x86_64": {
                signature: getSignature("windows", "x64"),
                url: `${baseUrl}/lumina-note_${version}_x64-setup.nsis.zip`
            }
        }
    };

    // Clean up empty platforms (if signature is missing)
    Object.keys(info.platforms).forEach(key => {
        if (!info.platforms[key].signature) {
            delete info.platforms[key];
        }
    });

    const outPath = path.resolve(process.cwd(), 'latest.json');
    fs.writeFileSync(outPath, JSON.stringify(info, null, 2));
    console.log('Generated latest.json at', outPath);
}

generate();
