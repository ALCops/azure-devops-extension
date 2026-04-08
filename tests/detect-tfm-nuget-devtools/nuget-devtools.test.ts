import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IncomingMessage } from 'http';
import { Readable } from 'stream';

// Mock https before importing the module under test
vi.mock('https', () => ({
    get: vi.fn(),
}));

import * as https from 'https';
import { resolveDevToolsVersion, detectFromNuGetDevTools } from '../../tasks/detect-tfm-nuget-devtools/src/nuget-devtools';

function createMockResponse(body: object, statusCode = 200): IncomingMessage {
    const readable = new Readable({
        read() {
            this.push(JSON.stringify(body));
            this.push(null);
        },
    });
    (readable as IncomingMessage).statusCode = statusCode;
    (readable as IncomingMessage).headers = {};
    return readable as IncomingMessage;
}

function createRedirectResponse(location: string): IncomingMessage {
    const readable = new Readable({
        read() {
            this.push(null);
        },
    });
    (readable as IncomingMessage).statusCode = 302;
    (readable as IncomingMessage).headers = { location };
    return readable as IncomingMessage;
}

function mockHttpsGet(response: IncomingMessage) {
    (https.get as ReturnType<typeof vi.fn>).mockImplementation((_url, callback) => {
        (callback as (res: IncomingMessage) => void)(response);
        return { on: vi.fn() };
    });
}

const sampleVersions = {
    versions: [
        '14.0.11111.0',
        '15.0.22222.0',
        '16.0.33333.0',
        '25.0.12345.0',
        '26.0.54321.0',
        '26.1.0.0-preview1',
    ],
};

describe('resolveDevToolsVersion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns a specific version as-is without calling NuGet', async () => {
        const result = await resolveDevToolsVersion('26.0.12345.0');
        expect(result).toBe('26.0.12345.0');
        expect(https.get).not.toHaveBeenCalled();
    });

    it('resolves "latest" to the last stable (non-prerelease) version', async () => {
        mockHttpsGet(createMockResponse(sampleVersions));
        const result = await resolveDevToolsVersion('latest');
        expect(result).toBe('26.0.54321.0');
    });

    it('resolves "prerelease" to the very last version including pre-release', async () => {
        mockHttpsGet(createMockResponse(sampleVersions));
        const result = await resolveDevToolsVersion('prerelease');
        expect(result).toBe('26.1.0.0-preview1');
    });
});

describe('detectFromNuGetDevTools', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('detects net8.0 for a version above the threshold (26.0.12345.0)', async () => {
        const result = await detectFromNuGetDevTools('26.0.12345.0');
        expect(result.tfm).toBe('net8.0');
        expect(result.source).toBe('nuget-devtools');
        expect(result.details).toContain('26.0.12345.0');
    });

    it('detects netstandard2.1 for a version below the threshold (15.0.12345.0)', async () => {
        const result = await detectFromNuGetDevTools('15.0.12345.0');
        expect(result.tfm).toBe('netstandard2.1');
        expect(result.source).toBe('nuget-devtools');
        expect(result.details).toContain('15.0.12345.0');
    });

    it('resolves "latest" and detects TFM correctly', async () => {
        mockHttpsGet(createMockResponse(sampleVersions));
        const result = await detectFromNuGetDevTools('latest');
        // Latest stable is 26.0.54321.0 which is > threshold → net8.0
        expect(result.tfm).toBe('net8.0');
        expect(result.source).toBe('nuget-devtools');
        expect(result.details).toContain('26.0.54321.0');
    });

    it('always sets source to "nuget-devtools"', async () => {
        const r1 = await detectFromNuGetDevTools('15.0.12345.0');
        expect(r1.source).toBe('nuget-devtools');

        const r2 = await detectFromNuGetDevTools('26.0.12345.0');
        expect(r2.source).toBe('nuget-devtools');
    });
});
