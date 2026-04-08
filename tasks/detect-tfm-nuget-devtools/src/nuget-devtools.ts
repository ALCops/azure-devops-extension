import * as https from 'https';
import { TfmDetectionResult, NUGET_FLAT_CONTAINER } from '../../../shared/types';
import { getTargetFrameworkFromVersion } from '../../../shared/version-threshold';

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
                } catch (err) {
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
export async function resolveDevToolsVersion(requested: string): Promise<string> {
    if (requested !== 'latest' && requested !== 'prerelease') {
        return requested;
    }
    const url = `${NUGET_FLAT_CONTAINER}/${DEVTOOLS_PACKAGE}/index.json`;
    const data = await fetchJson(url);
    const versions = data.versions as string[];
    if (requested === 'latest') {
        const stable = versions.filter((v) => !v.includes('-'));
        return stable[stable.length - 1];
    }
    return versions[versions.length - 1];
}

/**
 * Detect TFM from a NuGet DevTools version.
 * The version IS the assembly version — apply threshold directly.
 */
export async function detectFromNuGetDevTools(version: string): Promise<TfmDetectionResult> {
    const resolved = await resolveDevToolsVersion(version);
    const tfm = getTargetFrameworkFromVersion(resolved);
    return {
        tfm,
        source: 'nuget-devtools',
        details: `DevTools version ${resolved}`,
    };
}
