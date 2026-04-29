import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock azure-pipelines-task-lib ──
vi.mock('azure-pipelines-task-lib/task', () => ({
    getInput: vi.fn(),
    getPathInput: vi.fn(),
    getVariable: vi.fn(),
    setVariable: vi.fn(),
    setResult: vi.fn(),
    debug: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    TaskResult: { Succeeded: 0, Failed: 1 },
}));

// ── Mock @alcops/core ──
vi.mock('@alcops/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@alcops/core')>();
    return {
        ...actual,
        resolveVersion: vi.fn(),
        downloadPackage: vi.fn(),
        extractAnalyzers: vi.fn(),
        detectFromCompilerPath: vi.fn(),
    };
});

import * as tl from 'azure-pipelines-task-lib/task';
import { resolveVersion, downloadPackage, extractAnalyzers, detectFromCompilerPath } from '@alcops/core';
import { run } from '../../tasks/install-analyzers/src/task-runner';

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

        mockResolveVersion.mockResolvedValue({ version: '1.0.0' });
        mockDownloadPackage.mockResolvedValue('/tmp/package.nupkg');
        mockExtractAnalyzers.mockResolvedValue({
            extractedPath: '/build/src/.alcops',
            files: ['/build/src/.alcops/Analyzer.dll'],
            actualTfm: 'net8.0',
        });

        await run();

        expect(mockDetectFromCompilerPath).not.toHaveBeenCalled();
        expect(mockExtractAnalyzers).toHaveBeenCalledWith(
            '/tmp/package.nupkg',
            'net8.0',
            expect.any(String),
            expect.any(Object),
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
        mockResolveVersion.mockResolvedValue({ version: '2.0.0' });
        mockDownloadPackage.mockResolvedValue('/tmp/package.nupkg');
        mockExtractAnalyzers.mockResolvedValue({
            extractedPath: '/build/src/.alcops',
            files: ['/build/src/.alcops/A.dll', '/build/src/.alcops/B.dll'],
            actualTfm: 'netstandard2.1',
        });

        await run();

        expect(mockDetectFromCompilerPath).toHaveBeenCalledWith('/compiler/dir', expect.any(Object));
        expect(mockExtractAnalyzers).toHaveBeenCalledWith(
            '/tmp/package.nupkg',
            'netstandard2.1',
            expect.any(String),
            expect.any(Object),
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
            extractedPath: '/build/src/.alcops',
            files: ['/build/src/.alcops/Local.dll'],
            actualTfm: 'net8.0',
        });

        await run();

        expect(mockResolveVersion).not.toHaveBeenCalled();
        expect(mockDownloadPackage).not.toHaveBeenCalled();
        expect(mockExtractAnalyzers).toHaveBeenCalledWith(
            '/local/package.nupkg',
            'net8.0',
            expect.any(String),
            expect.any(Object),
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
