# Copilot Instructions — ALCops Azure DevOps Extension

## Project Identity

Azure DevOps extension providing pipeline tasks for downloading ALCops [ALCops](https://alcops.dev) code analyzers for AL (Business Central). The core problem: matching the correct analyzer DLLs to the consumer's AL compiler version via Target Framework Moniker (TFM) detection.

**One active task** (`ALCopsDownloadAnalyzers`) plus four deprecated legacy tasks retained for backward compatibility. All analyzer/TFM/NuGet logic lives in the external **`@alcops/core`** npm package; the tasks in this repo are thin wrappers that read inputs, call core, and set outputs.

## Tech Stack

- **Language**: TypeScript (strict mode, ES2022 target, Node16 module resolution)
- **Bundler**: esbuild — each task bundles to a single CJS file targeting Node 24
- **Test runner**: vitest with built-in mocking (`vi.mock`, `vi.mocked`)
- **Task SDK**: `azure-pipelines-task-lib` v5 (inputs, outputs, logging)
- **Core logic**: `@alcops/core` npm package (TFM detection, NuGet download, ZIP/PE parsing) — bundled into each task by esbuild
- **Runtime**: Node 24 primary + Node 20 fallback execution handlers
- **Packaging**: `tfx-cli` produces a single `.vsix` containing all tasks

## Commands

```bash
npm ci              # Install dependencies (use ci, not install)
npm test            # Run all tests (vitest)
npm run build       # TypeScript compilation check (tsc)
npm run bundle      # esbuild → task bundles in tasks/*/dist/
npm run lint        # ESLint on shared/ and tasks/*/src/
npm run package     # Bundle + tfx → production .vsix in ./out/
npm run package:dev # Bundle + tfx → dev .vsix in ./out/
```

## Architecture

Tasks bundled into a single `.vsix`. Only `ALCopsDownloadAnalyzers` is actively maintained; the rest are deprecated (`"deprecated": true` in their `task.json`) and retained for backward compatibility:

| Task | Directory | Status | Purpose |
|------|-----------|--------|---------|
| ALCopsDownloadAnalyzers | `tasks/download/` | **Active** | Single-step: detect TFM + download/extract analyzers via `executeDownload()` |
| ALCopsInstallAnalyzers | `tasks/install-analyzers/` | Deprecated | Downloads ALCops from NuGet, extracts correct DLLs |
| ALCopsDetectTfmFromBCArtifact | `tasks/detect-tfm-bc-artifact/` | Deprecated | Detects TFM from BC artifact URL |
| ALCopsDetectTfmFromNuGetDevTools | `tasks/detect-tfm-nuget-devtools/` | Deprecated | Detects TFM from NuGet DevTools package version |
| ALCopsDetectTfmFromMarketplace | `tasks/detect-tfm-marketplace/` | Deprecated | Detects TFM from VS Marketplace AL Language extension |

### Key directories

- `shared/` — Small shared wrapper helpers bundled into each task (currently `logger.ts` + `log-inputs.ts`). Not runtime-shared; esbuild inlines them.
- `tasks/<name>/src/` — Thin task wrappers: `index.ts` (entry) + `task-runner.ts` (reads inputs, calls `@alcops/core`, sets outputs)
- `tasks/<name>/dist/` — esbuild output (gitignored, generated)
- `tests/` — All tests, mirroring the task structure
- `tests/fixtures/` — Real minimal .NET compiler assemblies (`compiler-net80`, `compiler-netstandard21`) referenced by scaffold checks

### Core logic (`@alcops/core`)

All analyzer/TFM/NuGet/ZIP/PE logic lives in the external `@alcops/core` package (separate `npm-package` repo), **not** in this repo. The `download` task calls a single entry point:

- `executeDownload(options, logger)` — full pipeline: detect TFM → resolve ALCops version → download from NuGet → extract → cleanup. Returns `{ version, tfm, outputDir, files }`.
- `options: DownloadOptions` — `{ detectSource?, detectFrom?, tfm?, version?, outputDir }`
- `detectFrom: DetectSource` — `'bc-artifact' | 'compiler-path' | 'nuget-devtools' | 'marketplace'`

When debugging download behaviour, the bug is almost certainly in `@alcops/core`, not in this repo's wrapper. Treat the core package as the source of truth for valid TFMs, version resolution, and NuGet interaction.

### Entry point pattern

Every task follows the same pattern:
1. `index.ts` — imports and calls `run()` from `task-runner.ts`; guards with `.catch(...)` so unexpected rejections fail the process (and the ADO task) rather than exiting 0
2. `task-runner.ts` — orchestrator: reads inputs via `tl.getInput()`, calls `@alcops/core`, sets outputs via `tl.setVariable()`, and wraps logic in try/catch → `tl.setResult(Failed)` on error

## ADO Extension Patterns

### task.json

Each task has a `task.json` defining its Azure DevOps contract:
- Must include `Node24` (primary), `Node20_1`, and `Node20` (fallback) in `execution`, plus a `minimumAgentVersion` of `3.224.1`
- Task `id` is a stable GUID (never changes)
- Task `Major` version only bumps for breaking YAML contract changes
- `Minor` and `Patch` are stamped by CI via inline `jq` in the workflow YAML

### Two-manifest pattern

| File | Extension ID | Trigger |
|------|-------------|---------|
| `vss-extension.json` | `alcops-ado` | `v*` tag → public production |
| `vss-extension.dev.json` | `alcops-ado-dev` | Push to `main` → private dev |

### Inputs and outputs

- Read inputs: `tl.getInput('inputName', required)` or `tl.getPathInput()`
- Set outputs: `tl.setVariable('varName', value, false, true)` (the 4th arg `isOutput` must be `true`)
- Output variables are prefixed by the task's `name` attribute when consumed downstream

## Testing Conventions

### Rules

- **TDD**: write tests before implementation
- **No real network calls**: tasks delegate to `@alcops/core`, so mock the core entry point (e.g. `executeDownload`) at module level — the wrapper tests never touch HTTP
- **Module isolation**: each test file mocks its external dependencies
- **Full suite for shared changes**: if you modify `shared/`, run `npm test` (all tests), not just one task's tests

### Mocking patterns

```typescript
// Azure Pipelines task-lib
vi.mock('azure-pipelines-task-lib/task', () => ({
  getInput: vi.fn(),
  getPathInput: vi.fn(),
  getVariable: vi.fn(),
  setVariable: vi.fn(),
  setResult: vi.fn(),
  debug: vi.fn(), warning: vi.fn(), error: vi.fn(),
  TaskResult: { Succeeded: 0, Failed: 1 },
}));

// @alcops/core — keep real exports, stub the entry point
vi.mock('@alcops/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@alcops/core')>();
  return { ...actual, executeDownload: vi.fn() };
});
```

### Fixtures

- `tests/fixtures/` holds real minimal .NET compiler assemblies (`compiler-net80`, `compiler-netstandard21`), referenced by scaffold existence checks. Don't manually edit these binaries.

## Adding a New Task

1. Create `tasks/<task-name>/task.json` — unique GUID, Node24 + Node20_1 + Node20 handlers, `minimumAgentVersion` `3.224.1`
2. Create `tasks/<task-name>/src/index.ts` (calls `run()`, guards with `.catch`) and `src/task-runner.ts` (reads inputs → calls `@alcops/core` → sets outputs)
3. Add the task name to the `tasks` array in `esbuild.config.mjs`
4. Add entries in `vss-extension.json` `files` and `contributions` arrays (and `vss-extension.dev.json`)
5. Create tests in `tests/<task-name>/`
6. Verify: `npm test && npm run bundle`

## Versioning

- [GitVersion](https://gitversion.net/) with GitHubFlow/v1, ContinuousDeployment mode
- Every commit auto-increments Patch
- Use `+semver: minor` or `+semver: major` in commit messages for bumps
- Production releases: `git tag v0.2.0 && git push origin v0.2.0`

## Path Aliases

TypeScript and vitest both use the `@shared/*` alias for imports from `shared/`:
- `tsconfig.json`: `"@shared/*": ["./shared/*"]`
- `vitest.config.ts`: `alias: { '@shared': path.resolve(__dirname, 'shared') }`

## Common Pitfalls

- **Missing/invalid Node handler**: every `task.json` needs `Node24`, `Node20_1`, and `Node20` execution entries (note: `Node24_1` is NOT a valid handler name — the correct key is `Node24`). Also set `minimumAgentVersion` `3.224.1` so old agents get a clear error.
- **Shared modules aren't runtime-shared**: `shared/` helpers and `@alcops/core` are bundled into each task by esbuild. No `node_modules` sharing at runtime.
- **Logic lives in `@alcops/core`, not here**: TFM detection, NuGet download, ZIP/PE parsing are all in the external package. Wrappers must stay thin — don't reimplement or duplicate core's validation (e.g. valid TFM lists) in the wrapper.
- **Output variables need `isOutput: true`**: the 4th argument to `tl.setVariable()` must be `true` for downstream tasks to read the value
- **Don't commit `tasks/*/dist/`**: these are gitignored build artifacts
- **PE fixtures are real binaries**: `tests/fixtures/` contains .NET assemblies. Don't manually edit them.

## Documentation

- `.github/ARCHITECTURE.md` — full technical architecture
- `CONTRIBUTING.md` (repo root) — development workflow, CI/CD, testing guide
- `.github/OVERVIEW.md` — high-level project overview
- `README.md` — user-facing documentation (Marketplace listing source)
- `overview.md` — Marketplace detail page content
