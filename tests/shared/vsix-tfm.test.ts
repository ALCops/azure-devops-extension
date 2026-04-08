import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pe-struct', () => ({
    load: vi.fn(),
}));
vi.mock('../../shared/zip-local', () => ({
    extractZipEntryFromBuffer: vi.fn(),
}));

import * as PEStruct from 'pe-struct';
import { extractZipEntryFromBuffer } from '../../shared/zip-local';
import { detectTfmFromVsixBuffer } from '../../shared/vsix-tfm';

const mockLoad = vi.mocked(PEStruct.load);
const mockExtractEntry = vi.mocked(extractZipEntryFromBuffer);

beforeEach(() => {
    vi.clearAllMocks();
});

function mockPeResult(major: number, minor: number, build: number, revision: number) {
    mockLoad.mockReturnValue({
        mdtAssembly: {
            values: [{
                MajorVersion: { value: major },
                MinorVersion: { value: minor },
                BuildNumber: { value: build },
                RevisionNumber: { value: revision },
            }],
        },
    } as unknown as ReturnType<typeof PEStruct.load>);
}

describe('detectTfmFromVsixBuffer', () => {
    it('detects net8.0 from assembly version > threshold', () => {
        mockExtractEntry.mockReturnValue(Buffer.from('fake-dll'));
        mockPeResult(17, 0, 0, 0);

        const result = detectTfmFromVsixBuffer(Buffer.from('fake-vsix'));

        expect(result.tfm).toBe('net8.0');
        expect(result.assemblyVersion).toBe('17.0.0.0');
        expect(mockExtractEntry).toHaveBeenCalledWith(
            expect.any(Buffer),
            'extension/bin/CodeAnalysis/Microsoft.Dynamics.Nav.CodeAnalysis.dll',
        );
    });

    it('detects netstandard2.1 from assembly version <= threshold', () => {
        mockExtractEntry.mockReturnValue(Buffer.from('fake-dll'));
        mockPeResult(14, 0, 0, 0);

        const result = detectTfmFromVsixBuffer(Buffer.from('fake-vsix'));

        expect(result.tfm).toBe('netstandard2.1');
        expect(result.assemblyVersion).toBe('14.0.0.0');
    });

    it('throws when PE parsing fails', () => {
        mockExtractEntry.mockReturnValue(Buffer.from('fake-dll'));
        mockLoad.mockImplementation(() => { throw new Error('bad PE'); });

        expect(() => detectTfmFromVsixBuffer(Buffer.from('fake-vsix'))).toThrow(
            'Failed to parse PE structure from CodeAnalysis DLL',
        );
    });

    it('throws when assembly table is missing', () => {
        mockExtractEntry.mockReturnValue(Buffer.from('fake-dll'));
        mockLoad.mockReturnValue({} as ReturnType<typeof PEStruct.load>);

        expect(() => detectTfmFromVsixBuffer(Buffer.from('fake-vsix'))).toThrow(
            'Could not read assembly version from CodeAnalysis DLL',
        );
    });
});
