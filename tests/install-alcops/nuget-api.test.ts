import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { NUGET_FLAT_CONTAINER } from '@shared/types';

// ── Mock https module ──
vi.mock('https', () => ({
    request: vi.fn(),
}));

const mockRequest = https.request as unknown as ReturnType<typeof vi.fn>;

import {
    resolveVersion,
    getDownloadUrl,
    downloadPackage,
} from '../../tasks/install-alcops/src/nuget-api';

// ── Helpers ──

interface MockResponseOptions {
    statusCode?: number;
    headers?: Record<string, string>;
    body?: Buffer;
}

function enqueueResponse(opts: MockResponseOptions) {
    mockRequest.mockImplementationOnce(
        (_url: string, _reqOpts: unknown, cb: (res: EventEmitter & { statusCode?: number; headers: Record<string, string> }) => void) => {
            const res = new EventEmitter() as EventEmitter & {
                statusCode?: number;
                headers: Record<string, string>;
                resume: () => void;
            };
            res.statusCode = opts.statusCode ?? 200;
            res.headers = opts.headers ?? {};
            res.resume = () => {};

            process.nextTick(() => {
                cb(res);
                if (opts.body) {
                    res.emit('data', opts.body);
                }
                res.emit('end');
            });

            const req = new EventEmitter();
            (req as EventEmitter & { end: () => void }).end = () => {};
            return req;
        },
    );
}

beforeEach(() => {
    vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────
// resolveVersion
// ────────────────────────────────────────────────────────────────
describe('resolveVersion', () => {
    const indexJson = {
        versions: [
            '0.1.0-beta.1',
            '0.1.0',
            '0.2.0',
            '0.3.0-rc.1',
        ],
    };

    it('returns the last stable version for "latest"', async () => {
        enqueueResponse({
            statusCode: 200,
            body: Buffer.from(JSON.stringify(indexJson)),
        });

        const version = await resolveVersion('latest');
        expect(version).toBe('0.2.0');
    });

    it('returns the last version (including pre-release) for "prerelease"', async () => {
        enqueueResponse({
            statusCode: 200,
            body: Buffer.from(JSON.stringify(indexJson)),
        });

        const version = await resolveVersion('prerelease');
        expect(version).toBe('0.3.0-rc.1');
    });

    it('returns specific version as-is', async () => {
        const version = await resolveVersion('1.2.3');
        expect(version).toBe('1.2.3');
        expect(mockRequest).not.toHaveBeenCalled();
    });

    it('throws when no versions are found', async () => {
        enqueueResponse({
            statusCode: 200,
            body: Buffer.from(JSON.stringify({ versions: [] })),
        });

        await expect(resolveVersion('latest')).rejects.toThrow('No versions found');
    });

    it('throws when no stable versions exist for "latest"', async () => {
        enqueueResponse({
            statusCode: 200,
            body: Buffer.from(JSON.stringify({ versions: ['1.0.0-beta.1'] })),
        });

        await expect(resolveVersion('latest')).rejects.toThrow('No stable versions');
    });
});

// ────────────────────────────────────────────────────────────────
// getDownloadUrl
// ────────────────────────────────────────────────────────────────
describe('getDownloadUrl', () => {
    it('formats the URL correctly', () => {
        const url = getDownloadUrl('1.2.3');
        expect(url).toBe(
            `${NUGET_FLAT_CONTAINER}/alcops.analyzers/1.2.3/alcops.analyzers.1.2.3.nupkg`,
        );
    });

    it('handles pre-release versions', () => {
        const url = getDownloadUrl('1.0.0-beta.1');
        expect(url).toBe(
            `${NUGET_FLAT_CONTAINER}/alcops.analyzers/1.0.0-beta.1/alcops.analyzers.1.0.0-beta.1.nupkg`,
        );
    });
});

// ────────────────────────────────────────────────────────────────
// downloadPackage
// ────────────────────────────────────────────────────────────────
describe('downloadPackage', () => {
    it('downloads and writes the .nupkg to disk', async () => {
        const fakeContent = Buffer.from('PK-fake-nupkg-content');
        enqueueResponse({ statusCode: 200, body: fakeContent });

        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nuget-api-test-'));
        try {
            const result = await downloadPackage('1.0.0', tmpDir);
            expect(result).toBe(path.join(tmpDir, 'package.nupkg'));
            expect(fs.existsSync(result)).toBe(true);
            expect(fs.readFileSync(result)).toEqual(fakeContent);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it('creates the destination directory if it does not exist', async () => {
        const fakeContent = Buffer.from('PK-data');
        enqueueResponse({ statusCode: 200, body: fakeContent });

        const tmpDir = path.join(os.tmpdir(), `nuget-api-test-nested-${Date.now()}`);
        const nestedDir = path.join(tmpDir, 'sub', 'dir');
        try {
            const result = await downloadPackage('2.0.0', nestedDir);
            expect(fs.existsSync(result)).toBe(true);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});
