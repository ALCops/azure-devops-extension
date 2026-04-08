import * as fs from 'fs';
import * as path from 'path';
import * as PEStruct from 'pe-struct';
import { TfmDetectionResult, AL_COMPILER_DLL } from '../../../shared/types';
import { getTargetFrameworkFromVersion } from '../../../shared/version-threshold';

/**
 * Detect TFM from a directory containing Microsoft.Dynamics.Nav.CodeAnalysis.dll.
 * Uses pe-struct to read the AssemblyVersion, then version-threshold to map to TFM.
 */
export async function detectFromCompilerPath(dirPath: string): Promise<TfmDetectionResult> {
    const dllPath = path.join(dirPath, AL_COMPILER_DLL);

    if (!fs.existsSync(dllPath)) {
        throw new Error(`AL compiler DLL not found: ${dllPath}`);
    }

    const buffer = fs.readFileSync(dllPath);
    const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
    );

    let parsed: ReturnType<typeof PEStruct.load>;
    try {
        parsed = PEStruct.load(arrayBuffer);
    } catch {
        throw new Error(`Failed to parse PE structure: ${dllPath}`);
    }

    const assembly = parsed?.mdtAssembly?.values?.[0];
    if (!assembly) {
        throw new Error(`No Assembly metadata found in: ${dllPath}`);
    }

    const version = [
        assembly.MajorVersion.value,
        assembly.MinorVersion.value,
        assembly.BuildNumber.value,
        assembly.RevisionNumber.value,
    ].join('.');

    const tfm = getTargetFrameworkFromVersion(version);

    return {
        tfm,
        source: 'compiler-path',
        details: `${AL_COMPILER_DLL} v${version}`,
    };
}
