import * as https from 'https';
import { TfmDetectionResult, NUGET_FLAT_CONTAINER } from '../../../shared/types';
import { getTargetFrameworkFromVersion } from '../../../shared/version-threshold';
import { Logger, nullLogger } from '../../../shared/logger';

const DEVTOOLS_PACKAGE = 'microsoft.dynamics.businesscentral.development.tools';

/**
 * Fetch JSON from a URL, following redirects up to maxRedirects.
 */
function fetchJson(url: string, maxRedirects = 5): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (
                res.statusCode &&
                res.statusCode >= 300 &&
                res.statusCode < 400 &&
                res.headers.location
            ) {
                if (maxRedirects <= 0) {
                    reject(new Error('Too many redirects'));
                    return;
                }
                fetchJson(res.headers.location, maxRedirects - 1).then(resolve, reject);
                return;
            }
            if (res.statusCode && res.statusCode >= 400) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
                } catch {
                    reject(new Error(`Invalid JSON from ${url}`));
                }
            });
            res.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Resolve the DevTools version: 'latest', 'prerelease', or specific.
 */
export async function resolveDevToolsVersion(requested: string, logger: Logger = nullLogger): Promise<string> {
    if (requested !== 'latest' && requested !== 'prerelease') {
        logger.info(`Using specified DevTools version: ${requested}`);
        return requested;
    }
    logger.info(`Resolving DevTools version: '${requested}'`);
    const url = `${NUGET_FLAT_CONTAINER}/${DEVTOOLS_PACKAGE}/index.json`;
    logger.debug(`NuGet index URL: ${url}`);
    const data = await fetchJson(url);
    const versions = data.versions as string[];
    if (requested === 'latest') {
        const stable = versions.filter((v) => !v.includes('-'));
        const resolved = stable[stable.length - 1];
        logger.info(`Resolved to: ${resolved}`);
        return resolved;
    }
    const resolved = versions[versions.length - 1];
    logger.info(`Resolved to: ${resolved}`);
    return resolved;
}

/**
 * Detect TFM from a NuGet DevTools version.
 * The version IS the assembly version — apply threshold directly.
 */
export async function detectFromNuGetDevTools(version: string, logger: Logger = nullLogger): Promise<TfmDetectionResult> {
    const resolved = await resolveDevToolsVersion(version, logger);
    const tfm = getTargetFrameworkFromVersion(resolved);
    logger.info(`Version threshold: ${resolved} → TFM: ${tfm}`);
    return {
        tfm,
        source: 'nuget-devtools',
        details: `DevTools version ${resolved}`,
    };
}
