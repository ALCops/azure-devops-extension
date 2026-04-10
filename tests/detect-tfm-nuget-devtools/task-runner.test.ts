import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock azure-pipelines-task-lib
vi.mock('azure-pipelines-task-lib/task', () => ({
    getInput: vi.fn(),
    debug: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    setVariable: vi.fn(),
    setResult: vi.fn(),
    TaskResult: { Succeeded: 0, Failed: 2 },
}));

// Mock the nuget-devtools module
vi.mock('../../tasks/detect-tfm-nuget-devtools/src/nuget-devtools', () => ({
    detectFromNuGetDevTools: vi.fn(),
}));

import * as tl from 'azure-pipelines-task-lib/task';
import { detectFromNuGetDevTools } from '../../tasks/detect-tfm-nuget-devtools/src/nuget-devtools';
import { run } from '../../tasks/detect-tfm-nuget-devtools/src/task-runner';

describe('task-runner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reads version input, calls detectFromNuGetDevTools, and sets output variables', async () => {
        (tl.getInput as ReturnType<typeof vi.fn>).mockReturnValue('26.0.12345.0');
        (detectFromNuGetDevTools as ReturnType<typeof vi.fn>).mockResolvedValue({
            tfm: 'net8.0',
            source: 'nuget-devtools',
            details: 'DevTools version 26.0.12345.0',
        });

        await run();

        expect(detectFromNuGetDevTools).toHaveBeenCalledWith('26.0.12345.0', expect.any(Object));
        expect(tl.setVariable).toHaveBeenCalledWith('tfm', 'net8.0', false, true);
        expect(tl.setVariable).toHaveBeenCalledWith('devToolsVersion', '26.0.12345.0', false, true);
        expect(tl.setResult).toHaveBeenCalledWith(
            tl.TaskResult.Succeeded,
            expect.stringContaining('net8.0'),
        );
    });

    it('defaults to "latest" when no version input is provided', async () => {
        (tl.getInput as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
        (detectFromNuGetDevTools as ReturnType<typeof vi.fn>).mockResolvedValue({
            tfm: 'net8.0',
            source: 'nuget-devtools',
            details: 'DevTools version 26.0.54321.0',
        });

        await run();

        expect(detectFromNuGetDevTools).toHaveBeenCalledWith('latest', expect.any(Object));
    });

    it('sets TaskResult.Failed on error', async () => {
        (tl.getInput as ReturnType<typeof vi.fn>).mockReturnValue('latest');
        (detectFromNuGetDevTools as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('NuGet API unreachable'),
        );

        await run();

        expect(tl.setResult).toHaveBeenCalledWith(
            tl.TaskResult.Failed,
            'NuGet API unreachable',
        );
    });
});
