import * as https from 'https';
import { inflateSync } from 'fflate';

/**
 * Fetch a range of bytes from a URL using HTTP Range requests.
 * Returns the byte data as a Buffer.
 * Follows redirects (up to 5 hops).
 */
export async function fetchRange(url: string, start: number, end: number): Promise<Buffer> {
    return doRequest(url, {
        headers: { Range: `bytes=${start}-${end}` },
    });
}

/**
 * Get the total content length of a URL via a HEAD request.
 * Follows redirects.
 */
export async function getContentLength(url: string): Promise<number> {
    const buf = await doRequest(url, { method: 'HEAD' });
    // doRequest stores the content-length on the returned buffer when method is HEAD
    const len = (buf as Buffer & { __contentLength?: number }).__contentLength;
    if (len === undefined) {
        throw new Error('Server did not return Content-Length header');
    }
    return len;
}

/** ZIP End of Central Directory record. */
export interface ZipEOCD {
    centralDirectoryOffset: number;
    centralDirectorySize: number;
    entryCount: number;
}

/**
 * Read the EOCD from the last ~65KB of a remote ZIP file.
 */
export async function readZipEOCD(url: string): Promise<ZipEOCD> {
    const totalSize = await getContentLength(url);
    const tailSize = Math.min(totalSize, 65557);
    const tailStart = totalSize - tailSize;
    const tail = await fetchRange(url, tailStart, totalSize - 1);

    const EOCD_SIG = 0x06054b50;

    // Scan backwards for EOCD signature
    for (let i = tail.length - 22; i >= 0; i--) {
        if (tail.readUInt32LE(i) === EOCD_SIG) {
            const entryCount = tail.readUInt16LE(i + 10);
            const centralDirectorySize = tail.readUInt32LE(i + 12);
            const centralDirectoryOffset = tail.readUInt32LE(i + 16);
            return { centralDirectoryOffset, centralDirectorySize, entryCount };
        }
    }

    throw new Error('ZIP EOCD signature not found');
}

/** A single entry from the ZIP central directory. */
export interface ZipCentralEntry {
    fileName: string;
    compressedSize: number;
    uncompressedSize: number;
    localHeaderOffset: number;
    compressionMethod: number;
}

/**
 * Parse ZIP central directory entries from raw bytes.
 */
export function parseZipCentralDirectory(buffer: Buffer): ZipCentralEntry[] {
    const CD_SIG = 0x02014b50;
    const entries: ZipCentralEntry[] = [];
    let offset = 0;

    while (offset + 46 <= buffer.length) {
        if (buffer.readUInt32LE(offset) !== CD_SIG) break;

        const compressionMethod = buffer.readUInt16LE(offset + 10);
        const compressedSize = buffer.readUInt32LE(offset + 20);
        const uncompressedSize = buffer.readUInt32LE(offset + 24);
        const fileNameLength = buffer.readUInt16LE(offset + 28);
        const extraFieldLength = buffer.readUInt16LE(offset + 30);
        const commentLength = buffer.readUInt16LE(offset + 32);
        const localHeaderOffset = buffer.readUInt32LE(offset + 42);

        const entryEnd = offset + 46 + fileNameLength + extraFieldLength + commentLength;
        if (offset + 46 + fileNameLength > buffer.length) {
            break;
        }

        const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf-8');

        entries.push({
            fileName,
            compressedSize,
            uncompressedSize,
            localHeaderOffset,
            compressionMethod,
        });

        offset += 46 + fileNameLength + extraFieldLength + commentLength;
    }

    return entries;
}

/**
 * Extract a single file from a remote ZIP by name.
 * 1. Read EOCD → find central directory
 * 2. Parse central directory → find the target entry
 * 3. Read local file header + data
 * 4. Decompress if needed (deflate via fflate)
 */
export async function extractRemoteZipEntry(url: string, entryPath: string): Promise<Buffer> {
    const eocd = await readZipEOCD(url);
    const cdBytes = await fetchRange(
        url,
        eocd.centralDirectoryOffset,
        eocd.centralDirectoryOffset + eocd.centralDirectorySize - 1,
    );
    const entries = parseZipCentralDirectory(cdBytes);

    const entry = entries.find((e) => e.fileName === entryPath);
    if (!entry) {
        throw new Error(`Entry not found in ZIP: ${entryPath}`);
    }

    // Read local file header (30 bytes fixed) + variable-length name + extra fields + compressed data
    const localHeaderEnd =
        entry.localHeaderOffset + 30 + 256 + entry.compressedSize;
    const localBuf = await fetchRange(url, entry.localHeaderOffset, localHeaderEnd);

    const LOCAL_SIG = 0x04034b50;
    if (localBuf.readUInt32LE(0) !== LOCAL_SIG) {
        throw new Error('Invalid local file header signature');
    }

    const localNameLen = localBuf.readUInt16LE(26);
    const localExtraLen = localBuf.readUInt16LE(28);
    const dataStart = 30 + localNameLen + localExtraLen;
    const compressedData = localBuf.subarray(dataStart, dataStart + entry.compressedSize);

    if (entry.compressionMethod === 0) {
        return Buffer.from(compressedData);
    } else if (entry.compressionMethod === 8) {
        return Buffer.from(inflateSync(compressedData));
    } else {
        throw new Error(`Unsupported compression method: ${entry.compressionMethod}`);
    }
}

// ── Internal helpers ──

function doRequest(
    url: string,
    options: { method?: string; headers?: Record<string, string> },
    redirectCount = 0,
): Promise<Buffer> {
    if (redirectCount > 5) {
        return Promise.reject(new Error('Too many redirects'));
    }

    return new Promise((resolve, reject) => {
        const req = https.request(url, { method: options.method ?? 'GET', headers: options.headers ?? {} }, (res) => {
            // Follow redirects
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                resolve(doRequest(res.headers.location, options, redirectCount + 1));
                return;
            }

            if (options.method === 'HEAD') {
                const cl = parseInt(res.headers['content-length'] ?? '', 10);
                const buf = Buffer.alloc(0) as Buffer & { __contentLength?: number };
                buf.__contentLength = isNaN(cl) ? undefined : cl;
                res.resume(); // drain the response
                resolve(buf);
                return;
            }

            if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                res.resume();
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }

            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        });

        req.on('error', reject);
        req.end();
    });
}
