import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { NUGET_PACKAGE_NAME, NUGET_FLAT_CONTAINER } from '../../../shared/types';
import { Logger, nullLogger } from '../../../shared/logger';

const packageId = NUGET_PACKAGE_NAME.toLowerCase();

/**
 * Resolve the version to download.
 * - 'latest': last stable version from NuGet index
 * - 'prerelease': last version including pre-release
 * - specific version: returned as-is
 */
export async function resolveVersion(requested: string, logger: Logger = nullLogger): Promise<string> {
    if (requested !== 'latest' && requested !== 'prerelease') {
        logger.info(`Using specified ALCops version: ${requested}`);
        return requested;
    }

    logger.info(`Resolving ALCops version: '${requested}'`);
    const url = `${NUGET_FLAT_CONTAINER}/${packageId}/index.json`;
    logger.debug(`NuGet index URL: ${url}`);
    const data = await httpsGet(url);
    const json = JSON.parse(data.toString('utf-8')) as { versions: string[] };

    if (!json.versions || json.versions.length === 0) {
        throw new Error(`No versions found for ${NUGET_PACKAGE_NAME}`);
    }

    if (requested === 'prerelease') {
        const resolved = json.versions[json.versions.length - 1];
        logger.info(`Resolved to: ${resolved}`);
        return resolved;
    }

    // 'latest': find last stable version (no hyphen in version string)
    const stable = json.versions.filter((v) => !v.includes('-'));
    if (stable.length === 0) {
        throw new Error(`No stable versions found for ${NUGET_PACKAGE_NAME}`);
    }
    const resolved = stable[stable.length - 1];
    logger.info(`Resolved to: ${resolved}`);
    return resolved;
}

/** Build the download URL for a specific version. */
export function getDownloadUrl(version: string): string {
    return `${NUGET_FLAT_CONTAINER}/${packageId}/${version}/${packageId}.${version}.nupkg`;
}

/** Download the .nupkg to a dest directory, return the file path. */
export async function downloadPackage(version: string, destDir: string, logger: Logger = nullLogger): Promise<string> {
    const url = getDownloadUrl(version);
    logger.info('Downloading ALCops package from NuGet...');
    logger.debug(`Download URL: ${url}`);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    const destPath = path.join(destDir, 'package.nupkg');
    const data = await httpsGet(url);
    fs.writeFileSync(destPath, data);
    logger.debug(`Package saved to: ${destPath} (${data.length} bytes)`);
    return destPath;
}

// ── Internal helper ──

function httpsGet(url: string, redirectCount = 0): Promise<Buffer> {
    if (redirectCount > 5) {
        return Promise.reject(new Error('Too many redirects'));
    }

    return new Promise((resolve, reject) => {
        const req = https.request(url, { method: 'GET' }, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(httpsGet(res.headers.location, redirectCount + 1));
                return;
            }

            if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                res.resume();
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }

            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        });

        req.on('error', reject);
        req.end();
    });
}
