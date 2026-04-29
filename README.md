# ALCops for Azure DevOps

Azure DevOps pipeline tasks for downloading [ALCops](https://alcops.dev) code analyzers for AL (Business Central). The extension provides automatic target framework (TFM) detection from multiple sources and downloads the correct analyzer DLLs.

## Tasks

| Task | Description |
|------|-------------|
| **ALCopsDownload** | Download ALCops analyzers with automatic TFM detection (recommended) |
| **ALCopsInstallAnalyzers** | *(Deprecated)* Use ALCopsDownload instead |
| **ALCopsDetectTfmFromBCArtifact** | *(Deprecated)* Use ALCopsDownload with `detectUsing` instead |
| **ALCopsDetectTfmFromNuGetDevTools** | *(Deprecated)* Use ALCopsDownload with `detectUsing` instead |
| **ALCopsDetectTfmFromMarketplace** | *(Deprecated)* Use ALCopsDownload with `detectUsing` instead |

## Quick Start

The simplest usage, specify the TFM manually:

```yaml
steps:
  - task: ALCopsDownload@1
    inputs:
      tfm: "net8.0"
```

## Usage Examples

### Auto-detect from BC Artifact URL

Pass a BC artifact URL and the TFM is detected automatically:

```yaml
steps:
  - task: ALCopsDownload@1
    name: alcops
    inputs:
      detectUsing: "$(bcArtifactUrl)"
```

### Auto-detect from NuGet DevTools version

```yaml
steps:
  - task: ALCopsDownload@1
    name: alcops
    inputs:
      detectUsing: "latest"
```

### Auto-detect from VS Marketplace version

Force a specific detection source with `detectFrom`:

```yaml
steps:
  - task: ALCopsDownload@1
    name: alcops
    inputs:
      detectUsing: "current"
      detectFrom: "marketplace"
```

### Auto-detect from Compiler Path

```yaml
steps:
  - task: ALCopsDownload@1
    name: alcops
    inputs:
      detectUsing: "$(Agent.ToolsDirectory)/bc-devtools/bin"
      detectFrom: "compiler-path"
```

### Specific ALCops version

```yaml
steps:
  - task: ALCopsDownload@1
    name: alcops
    inputs:
      tfm: "net8.0"
      version: "1.2.3"
```

### Using Outputs

```yaml
steps:
  - task: ALCopsDownload@1
    name: alcops
    inputs:
      detectUsing: "latest"

  - script: echo "Downloaded $(alcops.version) with TFM $(alcops.tfm)"

  - script: |
      alc.exe /project:"$(Build.SourcesDirectory)" \
        /analyzer:"$(alcops.files)"
```

## Task Reference

### ALCopsDownload

Download ALCops code analyzers with automatic TFM detection. This is the recommended task, replacing the previous two-step detect + install workflow.

#### Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `detectUsing` | — | Input for TFM detection: BC artifact URL, local compiler path, NuGet DevTools version/channel, or VS Marketplace version. Smart routing determines the source. |
| `detectFrom` | *(auto)* | Force a detection source: `bc-artifact`, `marketplace`, `nuget-devtools`, `compiler-path` |
| `tfm` | — | Explicit target framework: `net8.0`, `netstandard2.1`, `net10.0`. Skips detection. |
| `version` | `latest` | ALCops version: `latest`, `prerelease`, or specific (e.g., `1.2.3`) |
| `outputPath` | `$(Build.SourcesDirectory)/.alcops` | Where to place extracted analyzer DLLs |

> **Note:** Either `detectUsing` or `tfm` must be provided.

#### Outputs

| Variable | Description |
|----------|-------------|
| `version` | Downloaded ALCops version |
| `tfm` | Detected or specified target framework moniker |
| `outputDir` | Full path to extracted analyzer DLLs directory |
| `files` | Semicolon-separated list of analyzer DLL paths |

---

### Deprecated Tasks

The following tasks are deprecated. Use `ALCopsDownload@1` instead.

#### ALCopsInstallAnalyzers (Deprecated)

Download and install ALCops code analyzers. Replaced by `ALCopsDownload@1`.

<details>
<summary>Inputs/Outputs</summary>

**Inputs:** `version`, `packageSource`, `localPackagePath`, `tfm`, `compilerPath`, `outputPath`

**Outputs:** `alcopsVersion`, `tfm`, `analyzerPath`, `analyzers`
</details>

#### ALCopsDetectTfmFromBCArtifact (Deprecated)

Detect TFM from a BC artifact URL. Replaced by `ALCopsDownload@1` with `detectUsing` set to the artifact URL.

<details>
<summary>Inputs/Outputs</summary>

**Inputs:** `artifactUrl`

**Outputs:** `tfm`, `dotNetVersion`
</details>

#### ALCopsDetectTfmFromNuGetDevTools (Deprecated)

Detect TFM from the BC DevTools NuGet package. Replaced by `ALCopsDownload@1` with `detectUsing`.

<details>
<summary>Inputs/Outputs</summary>

**Inputs:** `version`

**Outputs:** `tfm`, `devToolsVersion`
</details>

#### ALCopsDetectTfmFromMarketplace (Deprecated)

Detect TFM from the AL Language VS Code extension. Replaced by `ALCopsDownload@1` with `detectUsing` and `detectFrom: marketplace`.

<details>
<summary>Inputs/Outputs</summary>

**Inputs:** `channel`, `extensionVersion`

**Outputs:** `tfm`, `extensionVersion`, `assemblyVersion`
</details>

## Migration Guide

Replace the two-step detect + install pattern with a single `ALCopsDownload@1` step:

**Before (deprecated):**
```yaml
steps:
  - task: ALCopsDetectTfmFromBCArtifact@1
    name: detectTfm
    inputs:
      artifactUrl: "$(bcArtifactUrl)"

  - task: ALCopsInstallAnalyzers@1
    inputs:
      tfm: "$(detectTfm.tfm)"
```

**After:**
```yaml
steps:
  - task: ALCopsDownload@1
    name: alcops
    inputs:
      detectUsing: "$(bcArtifactUrl)"
```

## Development

### Prerequisites

- Node.js >= 20
- npm

### Commands

```bash
cd azure-devops-extension
npm ci                     # Install dependencies
npm run lint               # Lint (eslint shared/ tasks/*/src/)
npm test                   # Run tests (vitest)
npm run build              # TypeScript compilation (tsc -p tsconfig.json)
npm run bundle             # esbuild bundling (5 task bundles)
npm run package            # Bundle + create .vsix extension package
```

## Architecture

The extension contains **5 tasks**, each with its own entry point under `tasks/`:

```
tasks/
  download/                   # ALCopsDownload — single-step detect + download (recommended)
  install-analyzers/          # ALCopsInstallAnalyzers — deprecated
  detect-tfm-bc-artifact/     # ALCopsDetectTfmFromBCArtifact — deprecated
  detect-tfm-nuget-devtools/  # ALCopsDetectTfmFromNuGetDevTools — deprecated
  detect-tfm-marketplace/     # ALCopsDetectTfmFromMarketplace — deprecated
shared/                       # Shared modules (logger, input logging)
```

Each task is bundled into a single file via **esbuild** (`tasks/{name}/dist/index.js`), including all dependencies. All core logic lives in the [`@alcops/core`](https://www.npmjs.com/package/@alcops/core) package.

## Links

- [ALCops Website](https://alcops.dev)
- [GitHub Repository](https://github.com/ALCops/Analyzers)
- [Report Issues](https://github.com/ALCops/Analyzers/issues)
- [Discussions](https://github.com/ALCops/Analyzers/discussions)
