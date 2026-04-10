import { describe, it, expect } from 'vitest';
import * as path from 'path';

import { detectFromCompilerPath } from '../../tasks/install-analyzers/src/compiler-path';

const fixturesDir = path.resolve(__dirname, '..', 'fixtures');

// ────────────────────────────────────────────────────────────────
// detectFromCompilerPath
// ────────────────────────────────────────────────────────────────
describe('detectFromCompilerPath', () => {
    it('detects net8.0 from v17.0.0.0 DLL', async () => {
        const result = await detectFromCompilerPath(
            path.join(fixturesDir, 'compiler-net80'),
        );

        expect(result.tfm).toBe('net8.0');
        expect(result.source).toBe('compiler-path');
        expect(result.details).toContain('17.0.0.0');
    });

    it('detects netstandard2.1 from v15.0.0.0 DLL', async () => {
        const result = await detectFromCompilerPath(
            path.join(fixturesDir, 'compiler-netstandard21'),
        );

        expect(result.tfm).toBe('netstandard2.1');
        expect(result.source).toBe('compiler-path');
        expect(result.details).toContain('15.0.0.0');
    });

    it('throws for missing directory', async () => {
        await expect(
            detectFromCompilerPath(path.join(fixturesDir, 'nonexistent')),
        ).rejects.toThrow('AL compiler DLL not found');
    });

    it('throws for invalid DLL', async () => {
        // Use the fixtures directory itself (not a valid DLL path, but the dir exists).
        // Create a temp file that isn't a valid PE.
        const fs = await import('fs');
        const os = await import('os');
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compiler-path-test-'));
        const fakeDllPath = path.join(tmpDir, 'Microsoft.Dynamics.Nav.CodeAnalysis.dll');
        fs.writeFileSync(fakeDllPath, Buffer.from('not a valid PE file'));

        try {
            await expect(
                detectFromCompilerPath(tmpDir),
            ).rejects.toThrow();
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });
});
