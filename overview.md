# ALCops for Azure DevOps

Download [ALCops](https://alcops.dev) code analyzers for AL (Business Central) in your Azure DevOps pipelines with automatic target framework detection.

## Features

- **Single-step download** with automatic TFM detection from multiple sources
- **Smart routing** automatically determines the detection source from your input (URL, path, version, or channel keyword)
- **NuGet integration** downloads the latest (or specific) version of ALCops from nuget.org

## Quick Start

```yaml
steps:
  - task: ALCopsDownloadAnalyzers@1
    name: alcops
    inputs:
      detectUsing: "latest"

  - script: |
      alc.exe /project:"$(Build.SourcesDirectory)" \
        /analyzer:"$(alcops.files)"
```

## Common Patterns

### Auto-detect from BC Artifact

```yaml
steps:
  - task: ALCopsDownloadAnalyzers@1
    name: alcops
    inputs:
      detectUsing: "$(bcArtifactUrl)"
```

### Auto-detect from NuGet DevTools

```yaml
steps:
  - task: ALCopsDownloadAnalyzers@1
    name: alcops
    inputs:
      detectUsing: "latest"
```

### Auto-detect from VS Marketplace

```yaml
steps:
  - task: ALCopsDownloadAnalyzers@1
    name: alcops
    inputs:
      detectUsing: "current"
      detectFrom: "marketplace"
```

### Explicit TFM

```yaml
steps:
  - task: ALCopsDownloadAnalyzers@1
    inputs:
      tfm: "net8.0"
```

## Links

- [Full documentation on GitHub](https://github.com/ALCops/azure-devops-extension)
- [ALCops Website](https://alcops.dev)
- [Report Issues](https://github.com/ALCops/azure-devops-extension/issues)
