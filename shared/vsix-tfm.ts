import * as PEStruct from 'pe-struct';
import { TargetFramework, VSIX_DLL_PATH } from './types';
import { getTargetFrameworkFromVersion } from './version-threshold';
import { extractZipEntryFromBuffer } from './zip-local';

export interface VsixTfmResult {
    tfm: TargetFramework;
    assemblyVersion: string;
}

/**
 * Detect TFM from a VSIX buffer (ALLanguage.vsix).
 * Extracts the CodeAnalysis DLL, reads its PE assembly version,
 * and maps to a target framework moniker.
 */
export function detectTfmFromVsixBuffer(vsixBuffer: Buffer): VsixTfmResult {
    const dllBuffer = extractZipEntryFromBuffer(vsixBuffer, VSIX_DLL_PATH);

    const arrayBuffer = dllBuffer.buffer.slice(
        dllBuffer.byteOffset,
        dllBuffer.byteOffset + dllBuffer.byteLength,
    ) as ArrayBuffer;

    let pe: ReturnType<typeof PEStruct.load>;
    try {
        pe = PEStruct.load(arrayBuffer);
    } catch {
        throw new Error('Failed to parse PE structure from CodeAnalysis DLL');
    }

    const asm = pe?.mdtAssembly?.values?.[0];
    if (!asm) {
        throw new Error('Could not read assembly version from CodeAnalysis DLL');
    }

    const assemblyVersion = `${asm.MajorVersion.value}.${asm.MinorVersion.value}.${asm.BuildNumber.value}.${asm.RevisionNumber.value}`;
    const tfm = getTargetFrameworkFromVersion(assemblyVersion);

    return { tfm, assemblyVersion };
}
