import * as fs from 'fs';
import * as path from 'path';
import { unzipSync } from 'fflate';
import { TargetFramework, TFM_PREFERENCE } from '../../../shared/types';

/**
 * Extract analyzer DLLs from a .nupkg file for the given TFM.
 * .nupkg is a ZIP. Analyzers are in `lib/{tfm}/*.dll`.
 * If exact TFM folder doesn't exist, try fallback order from TFM_PREFERENCE.
 * Returns the extraction path, file list, and actual TFM used.
 */
export async function extractAnalyzers(
    nupkgPath: string,
    targetTfm: TargetFramework,
    outputDir: string,
): Promise<{ extractedPath: string; files: string[]; actualTfm: TargetFramework }> {
    const zipData = fs.readFileSync(nupkgPath);
    const unzipped = unzipSync(new Uint8Array(zipData));

    // Collect available TFM folders under lib/
    const libEntries = Object.keys(unzipped).filter(
        (name) => name.startsWith('lib/') && name.endsWith('.dll'),
    );

    // Build TFM fallback list: start from requested TFM, then follow preference order
    const startIndex = TFM_PREFERENCE.indexOf(targetTfm);
    const candidates = startIndex >= 0
        ? TFM_PREFERENCE.slice(startIndex)
        : [targetTfm, ...TFM_PREFERENCE];

    let actualTfm: TargetFramework | undefined;
    let matchingEntries: string[] = [];

    for (const tfm of candidates) {
        const prefix = `lib/${tfm}/`;
        const entries = libEntries.filter((name) => name.startsWith(prefix));
        if (entries.length > 0) {
            actualTfm = tfm;
            matchingEntries = entries;
            break;
        }
    }

    if (!actualTfm || matchingEntries.length === 0) {
        throw new Error(
            `No compatible TFM folder found in package. Requested: ${targetTfm}, available: ${[...new Set(libEntries.map((e) => e.split('/')[1]))].join(', ')}`,
        );
    }

    const extractedPath = path.join(outputDir, 'analyzers', actualTfm);
    if (!fs.existsSync(extractedPath)) {
        fs.mkdirSync(extractedPath, { recursive: true });
    }

    const files: string[] = [];
    for (const entry of matchingEntries) {
        const fileName = path.basename(entry);
        const destFile = path.join(extractedPath, fileName);
        fs.writeFileSync(destFile, Buffer.from(unzipped[entry]));
        files.push(destFile);
    }

    return { extractedPath, files, actualTfm };
}
