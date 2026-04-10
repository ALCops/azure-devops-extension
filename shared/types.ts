/** Supported target framework monikers */
export type TargetFramework =
    | 'net10.0'
    | 'net9.0'
    | 'net8.0'
    | 'netstandard2.1'
    | 'netstandard2.0';

/** TFM preference order: most modern first */
export const TFM_PREFERENCE: TargetFramework[] = [
    'net10.0',
    'net9.0',
    'net8.0',
    'netstandard2.1',
    'netstandard2.0',
];

/**
 * Assembly version threshold separating netstandard2.1 from net8.0.
 * Versions ≤ this value map to netstandard2.1; versions > map to net8.0.
 * Source: VS Code extension dotnet-parser.ts + GitHub discussion #144.
 */
export const TFM_VERSION_THRESHOLD = '16.0.21.53261';

/** The DLL filename used for TFM detection from the AL compiler directory */
export const AL_COMPILER_DLL = 'Microsoft.Dynamics.Nav.CodeAnalysis.dll';

/** ALCops NuGet package name */
export const NUGET_PACKAGE_NAME = 'ALCops.Analyzers';

/** NuGet v3 flat container base URL */
export const NUGET_FLAT_CONTAINER = 'https://api.nuget.org/v3-flatcontainer';

/** VS Marketplace API endpoint */
export const VS_MARKETPLACE_API =
    'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery?api-version=3.0-preview.1';

/** AL Language extension identifier on VS Marketplace */
export const AL_EXTENSION_ID = 'ms-dynamics-smb.al';

/** Path to CodeAnalysis DLL inside the AL Language VSIX */
export const VSIX_DLL_PATH = 'extension/bin/Analyzers/Microsoft.Dynamics.Nav.CodeAnalysis.dll';

/** Result of TFM detection */
export interface TfmDetectionResult {
    tfm: TargetFramework;
    source: string;
    details?: string;
}
