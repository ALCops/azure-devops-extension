import { describe, it, expect } from 'vitest';
import {
    compareAssemblyVersion,
    getTargetFrameworkFromVersion,
    getTargetFrameworkFromDotNetVersion,
} from '@shared/version-threshold';

describe('compareAssemblyVersion', () => {
    it('returns 0 for equal versions', () => {
        expect(compareAssemblyVersion('16.0.21.53261', '16.0.21.53261')).toBe(0);
    });

    it('returns 0 for equal simple versions', () => {
        expect(compareAssemblyVersion('1.0.0.0', '1.0.0.0')).toBe(0);
    });

    it('returns positive when major is greater', () => {
        expect(compareAssemblyVersion('17.0.0.0', '16.0.0.0')).toBeGreaterThan(0);
    });

    it('returns negative when major is lesser', () => {
        expect(compareAssemblyVersion('15.0.0.0', '16.0.0.0')).toBeLessThan(0);
    });

    it('compares by minor version when major is equal', () => {
        expect(compareAssemblyVersion('16.1.0.0', '16.0.0.0')).toBeGreaterThan(0);
        expect(compareAssemblyVersion('16.0.0.0', '16.1.0.0')).toBeLessThan(0);
    });

    it('compares by build when major and minor are equal', () => {
        expect(compareAssemblyVersion('16.0.22.0', '16.0.21.0')).toBeGreaterThan(0);
        expect(compareAssemblyVersion('16.0.20.0', '16.0.21.0')).toBeLessThan(0);
    });

    it('compares by revision when major, minor, and build are equal', () => {
        expect(compareAssemblyVersion('16.0.21.53262', '16.0.21.53261')).toBeGreaterThan(0);
        expect(compareAssemblyVersion('16.0.21.53260', '16.0.21.53261')).toBeLessThan(0);
    });

    it('handles different length versions by padding with zeros', () => {
        expect(compareAssemblyVersion('16.0', '16.0.0.0')).toBe(0);
        expect(compareAssemblyVersion('16', '16.0.0.0')).toBe(0);
        expect(compareAssemblyVersion('16.0.1', '16.0.0.0')).toBeGreaterThan(0);
    });
});

describe('getTargetFrameworkFromVersion', () => {
    it('returns netstandard2.1 for old compiler version "15.0.0.0"', () => {
        expect(getTargetFrameworkFromVersion('15.0.0.0')).toBe('netstandard2.1');
    });

    it('returns netstandard2.1 for exact threshold "16.0.21.53261"', () => {
        expect(getTargetFrameworkFromVersion('16.0.21.53261')).toBe('netstandard2.1');
    });

    it('returns net8.0 for version just above threshold "16.0.22.0"', () => {
        expect(getTargetFrameworkFromVersion('16.0.22.0')).toBe('net8.0');
    });

    it('returns net8.0 for new compiler version "17.0.0.0"', () => {
        expect(getTargetFrameworkFromVersion('17.0.0.0')).toBe('net8.0');
    });

    it('returns netstandard2.1 for version just below threshold in revision', () => {
        expect(getTargetFrameworkFromVersion('16.0.21.53260')).toBe('netstandard2.1');
    });

    it('returns net8.0 for version just above threshold in revision', () => {
        expect(getTargetFrameworkFromVersion('16.0.21.53262')).toBe('net8.0');
    });
});

describe('getTargetFrameworkFromDotNetVersion', () => {
    it('returns net8.0 for "8.0.24"', () => {
        expect(getTargetFrameworkFromDotNetVersion('8.0.24')).toBe('net8.0');
    });

    it('returns netstandard2.1 for "6.0.0"', () => {
        expect(getTargetFrameworkFromDotNetVersion('6.0.0')).toBe('netstandard2.1');
    });

    it('returns net9.0 for "9.0.0"', () => {
        expect(getTargetFrameworkFromDotNetVersion('9.0.0')).toBe('net9.0');
    });

    it('returns net10.0 for "10.0.0"', () => {
        expect(getTargetFrameworkFromDotNetVersion('10.0.0')).toBe('net10.0');
    });

    it('returns net8.0 for exact major version 8', () => {
        expect(getTargetFrameworkFromDotNetVersion('8.0.0')).toBe('net8.0');
    });

    it('returns netstandard2.1 for major version 7', () => {
        expect(getTargetFrameworkFromDotNetVersion('7.0.0')).toBe('netstandard2.1');
    });
});
