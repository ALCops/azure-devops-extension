import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock azure-pipelines-task-lib ──
vi.mock('azure-pipelines-task-lib/task', () => ({
    getInput: vi.fn(),
    getPathInput: vi.fn(),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    setResult: vi.fn(),
    debug: vi.fn(),
    TaskResult: { Succeeded: 0, Failed: 1 },
}));

// ── Mock nuget-api ──
vi.mock('../../tasks/install-alcops/src/nuget-api', () => ({
    resolveVersion: vi.fn(),
    downloadPackage: vi.fn(),
}));

// ── Mock nuget-extractor ──
vi.mock('../../tasks/install-alcops/src/nuget-extractor', () => ({
    extractAnalyzers: vi.fn(),
}));

// ── Mock compiler-path ──
vi.mock('../../tasks/install-alcops/src/compiler-path', () => ({
    detectFromCompilerPath: vi.fn(),
}));

import * as tl from 'azure-pipelines-task-lib/task';
import { resolveVersion, downloadPackage } from '../../tasks/install-alcops/src/nuget-api';
import { extractAnalyzers } from '../../tasks/install-alcops/src/nuget-extractor';
import { detectFromCompilerPath } from '../../tasks/install-alcops/src/compiler-path';
import { run } from '../../tasks/install-alcops/src/task-runner';

const mockGetInput = tl.getInput as ReturnType<typeof vi.fn>;
const mockGetPathInput = tl.getPathInput as ReturnType<typeof vi.fn>;
const mockGetVariable = tl.getVariable as ReturnType<typeof vi.fn>;
const mockSetVariable = tl.setVariable as ReturnType<typeof vi.fn>;
const mockSetResult = tl.setResult as ReturnType<typeof vi.fn>;

const mockResolveVersion = resolveVersion as ReturnType<typeof vi.fn>;
const mockDownloadPackage = downloadPackage as ReturnType<typeof vi.fn>;
const mockExtractAnalyzers = extractAnalyzers as ReturnType<typeof vi.fn>;
const mockDetectFromCompilerPath = detectFromCompilerPath as ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();

    // Sensible defaults
    mockGetInput.mockImplementation((name: string) => {
        const defaults: Record<string, string> = {
            version: 'latest',
            packageSource: 'nuget',
        };
        return defaults[name] ?? undefined;
    });
    mockGetPathInput.mockReturnValue(undefined);
    mockGetVariable.mockReturnValue('/build/src');
});

// ────────────────────────────────────────────────────────────────
// task-runner
// ────────────────────────────────────────────────────────────────
describe('task-runner', () => {
    it('uses manual TFM when provided', async () => {
        mockGetInput.mockImplementation((name: string) => {
            if (name === 'version') return 'latest';
            if (name === 'packageSource') return 'nuget';
            if (name === 'tfm') return 'net8.0';
            return undefined;
        });

        mockResolveVersion.mockResolvedValue('1.0.0');
        mockDownloadPackage.mockResolvedValue('/tmp/package.nupkg');
        mockExtractAnalyzers.mockResolvedValue({
            extractedPath: '/output/analyzers/net8.0',
            files: ['/output/analyzers/net8.0/Analyzer.dll'],
            actualTfm: 'net8.0',
        });

        await run();

        expect(mockDetectFromCompilerPath).not.toHaveBeenCalled();
        expect(mockExtractAnalyzers).toHaveBeenCalledWith(
            '/tmp/package.nupkg',
            'net8.0',
            expect.any(String),
        );
        expect(mockSetResult).toHaveBeenCalledWith(0, expect.stringContaining('1 analyzers'));
    });

    it('auto-detects TFM from compiler path', async () => {
        mockGetInput.mockImplementation((name: string) => {
            if (name === 'version') return 'latest';
            if (name === 'packageSource') return 'nuget';
            return undefined;
        });
        mockGetPathInput.mockImplementation((name: string) => {
            if (name === 'compilerPath') return '/compiler/dir';
            return undefined;
        });

        mockDetectFromCompilerPath.mockResolvedValue({
            tfm: 'netstandard2.1',
            source: 'compiler-path',
            details: 'Microsoft.Dynamics.Nav.CodeAnalysis.dll v15.0.0.0',
        });
        mockResolveVersion.mockResolvedValue('2.0.0');
        mockDownloadPackage.mockResolvedValue('/tmp/package.nupkg');
        mockExtractAnalyzers.mockResolvedValue({
            extractedPath: '/output/analyzers/netstandard2.1',
            files: ['/output/analyzers/netstandard2.1/A.dll', '/output/analyzers/netstandard2.1/B.dll'],
            actualTfm: 'netstandard2.1',
        });

        await run();

        expect(mockDetectFromCompilerPath).toHaveBeenCalledWith('/compiler/dir');
        expect(mockExtractAnalyzers).toHaveBeenCalledWith(
            '/tmp/package.nupkg',
            'netstandard2.1',
            expect.any(String),
        );
        expect(mockSetVariable).toHaveBeenCalledWith('tfm', 'netstandard2.1', false, true);
        expect(mockSetResult).toHaveBeenCalledWith(0, expect.stringContaining('2 analyzers'));
    });

    it('uses local package when packageSource is "local"', async () => {
        mockGetInput.mockImplementation((name: string) => {
            if (name === 'version') return 'latest';
            if (name === 'packageSource') return 'local';
            if (name === 'tfm') return 'net8.0';
            return undefined;
        });
        mockGetPathInput.mockImplementation((name: string) => {
            if (name === 'localPackagePath') return '/local/package.nupkg';
            return undefined;
        });

        mockExtractAnalyzers.mockResolvedValue({
            extractedPath: '/output/analyzers/net8.0',
            files: ['/output/analyzers/net8.0/Local.dll'],
            actualTfm: 'net8.0',
        });

        await run();

        expect(mockResolveVersion).not.toHaveBeenCalled();
        expect(mockDownloadPackage).not.toHaveBeenCalled();
        expect(mockExtractAnalyzers).toHaveBeenCalledWith(
            '/local/package.nupkg',
            'net8.0',
            expect.any(String),
        );
    });

    it('throws error when no TFM source is provided', async () => {
        mockGetInput.mockImplementation((name: string) => {
            if (name === 'version') return 'latest';
            if (name === 'packageSource') return 'nuget';
            return undefined;
        });
        mockGetPathInput.mockReturnValue(undefined);

        await expect(run()).rejects.toThrow('Either tfm or compilerPath must be provided');
    });
});
