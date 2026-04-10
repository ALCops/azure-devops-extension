import * as PEStruct from 'pe-struct';
import { TargetFramework, VSIX_DLL_PATH } from './types';
import { getTargetFrameworkFromVersion } from './version-threshold';
import { extractZipEntryFromBuffer } from './zip-local';
import { Logger, nullLogger } from './logger';

export interface VsixTfmResult {
    tfm: TargetFramework;
    assemblyVersion: string;
}

/**
 * Detect TFM from a raw CodeAnalysis DLL buffer.
 * Reads the PE assembly version and maps to a target framework moniker.
 */
export function detectTfmFromDllBuffer(dllBuffer: Buffer, logger: Logger = nullLogger): VsixTfmResult {
    logger.info('Reading assembly version from CodeAnalysis DLL');

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
    logger.info(`Assembly version: ${assemblyVersion} → TFM: ${tfm}`);

    return { tfm, assemblyVersion };
}

/**
 * Detect TFM from a VSIX buffer (ALLanguage.vsix).
 * Extracts the CodeAnalysis DLL, then delegates to detectTfmFromDllBuffer.
 */
export function detectTfmFromVsixBuffer(vsixBuffer: Buffer, logger: Logger = nullLogger): VsixTfmResult {
    const dllBuffer = extractZipEntryFromBuffer(vsixBuffer, VSIX_DLL_PATH, logger);
    return detectTfmFromDllBuffer(dllBuffer, logger);
}
