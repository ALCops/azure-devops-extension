# ALCops for Azure DevOps

Install [ALCops](https://alcops.dev) code analyzers for AL (Business Central) in your Azure DevOps pipelines with automatic target framework detection.

## Features

- **4 pipeline tasks** — Install analyzers and detect the correct TFM from multiple sources
- **Automatic TFM detection** — Determine `net8.0` vs `netstandard2.1` from BC artifacts, NuGet DevTools, or the VS Marketplace
- **NuGet integration** — Download the latest (or specific) version of ALCops from nuget.org
- **Air-gapped support** — Use a local `.nupkg` file for restricted environments

## Tasks

| Task | Description |
|------|-------------|
| **ALCopsInstallAnalyzers** | Download and install ALCops analyzer DLLs |
| **ALCopsDetectTfmFromBCArtifact** | Detect TFM from a BC artifact URL |
| **ALCopsDetectTfmFromNuGetDevTools** | Detect TFM from BC DevTools NuGet package |
| **ALCopsDetectTfmFromMarketplace** | Detect TFM from the AL Language VS Code extension |

## Quick Start

```yaml
steps:
  - task: ALCopsInstallAnalyzers@0
    inputs:
      tfm: "net8.0"
```

## Common Patterns

### Auto-detect from BC Artifact

```yaml
steps:
  - task: ALCopsDetectTfmFromBCArtifact@0
    name: detectTfm
    inputs:
      artifactUrl: "$(bcArtifactUrl)"

  - task: ALCopsInstallAnalyzers@0
    inputs:
      tfm: "$(detectTfm.tfm)"
```

### Auto-detect from NuGet DevTools

```yaml
steps:
  - task: ALCopsDetectTfmFromNuGetDevTools@0
    name: detectTfm
    inputs:
      version: "latest"

  - task: ALCopsInstallAnalyzers@0
    inputs:
      tfm: "$(detectTfm.tfm)"
```

### Auto-detect from VS Marketplace

```yaml
steps:
  - task: ALCopsDetectTfmFromMarketplace@0
    name: detectTfm
    inputs:
      channel: "current"

  - task: ALCopsInstallAnalyzers@0
    inputs:
      tfm: "$(detectTfm.tfm)"
```

## Links

- [Full documentation on GitHub](https://github.com/ALCops/Analyzers/tree/main/azure-devops-extension)
- [ALCops Website](https://alcops.dev)
- [Report Issues](https://github.com/ALCops/Analyzers/issues)
