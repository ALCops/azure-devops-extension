import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('azure-pipelines-task-lib/task', () => ({
    getInput: vi.fn(),
    debug: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    setVariable: vi.fn(),
    setResult: vi.fn(),
    TaskResult: { Succeeded: 0, Failed: 2 },
}));

vi.mock('@alcops/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@alcops/core')>();
    return {
        ...actual,
        detectFromBCArtifact: vi.fn(),
    };
});

import * as tl from 'azure-pipelines-task-lib/task';
import { detectFromBCArtifact } from '@alcops/core';
import { run } from '../../tasks/detect-tfm-bc-artifact/src/task-runner';

const mockGetInput = vi.mocked(tl.getInput);
const mockSetVariable = vi.mocked(tl.setVariable);
const mockSetResult = vi.mocked(tl.setResult);
const mockDetect = vi.mocked(detectFromBCArtifact);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('task-runner', () => {
    it('reads artifactUrl input, calls detectFromBCArtifact, and sets output variables', async () => {
        const artifactUrl = 'https://bcartifacts.azureedge.net/sandbox/26.0.12345.0/us';
        mockGetInput.mockReturnValue(artifactUrl);
        mockDetect.mockResolvedValue({
            tfm: 'net8.0',
            source: 'bc-artifact',
            details: 'dotNetVersion=8.0.24 from https://bcartifacts.azureedge.net/sandbox/26.0.12345.0/us',
        });

        await run();

        expect(mockGetInput).toHaveBeenCalledWith('artifactUrl', true);
        expect(mockDetect).toHaveBeenCalledWith(artifactUrl, expect.any(Object));
        expect(mockSetVariable).toHaveBeenCalledWith('tfm', 'net8.0', false, true);
        expect(mockSetVariable).toHaveBeenCalledWith('dotNetVersion', '8.0.24', false, true);
        expect(mockSetResult).toHaveBeenCalledWith(
            tl.TaskResult.Succeeded,
            expect.stringContaining('net8.0'),
        );
    });

    it('sets TaskResult.Failed on error', async () => {
        mockGetInput.mockReturnValue('https://bcartifacts.azureedge.net/sandbox/26.0.12345.0/us');
        mockDetect.mockRejectedValue(new Error('Network failure'));

        await run();

        expect(mockSetResult).toHaveBeenCalledWith(tl.TaskResult.Failed, 'Network failure');
    });
});
