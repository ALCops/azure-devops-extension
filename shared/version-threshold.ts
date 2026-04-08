import { TargetFramework, TFM_VERSION_THRESHOLD } from './types';

/**
 * Compare two assembly version strings (e.g., "16.0.21.53261" vs "17.0.0.0").
 * Returns: negative if a < b, 0 if equal, positive if a > b.
 * Versions have up to 4 numeric parts separated by dots.
 */
export function compareAssemblyVersion(a: string, b: string): number {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    const len = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < len; i++) {
        const numA = partsA[i] ?? 0;
        const numB = partsB[i] ?? 0;
        if (numA !== numB) {
            return numA - numB;
        }
    }
    return 0;
}

/**
 * Given an assembly version string, determine the TFM.
 * Versions <= TFM_VERSION_THRESHOLD (16.0.21.53261) → netstandard2.1
 * Versions > TFM_VERSION_THRESHOLD → net8.0
 */
export function getTargetFrameworkFromVersion(version: string): TargetFramework {
    return compareAssemblyVersion(version, TFM_VERSION_THRESHOLD) <= 0
        ? 'netstandard2.1'
        : 'net8.0';
}

/**
 * Given a .NET runtime version string like "8.0.24", determine the TFM.
 * Major version >= 8 → net{major}.0 (e.g., net8.0, net9.0, net10.0)
 * Otherwise → netstandard2.1
 */
export function getTargetFrameworkFromDotNetVersion(dotNetVersion: string): TargetFramework {
    const major = Number(dotNetVersion.split('.')[0]);
    if (major >= 8) {
        return `net${major}.0` as TargetFramework;
    }
    return 'netstandard2.1';
}
