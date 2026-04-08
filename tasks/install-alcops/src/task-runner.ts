import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import { TargetFramework } from '../../../shared/types';
import { resolveVersion, downloadPackage } from './nuget-api';
import { extractAnalyzers } from './nuget-extractor';
import { detectFromCompilerPath } from './compiler-path';

export async function run(): Promise<void> {
    // 1. Read inputs
    const version = tl.getInput('version') || 'latest';
    const packageSource = tl.getInput('packageSource') || 'nuget';
    const localPackagePath = tl.getPathInput('localPackagePath');
    const tfmInput = tl.getInput('tfm') as TargetFramework | undefined;
    const compilerPath = tl.getPathInput('compilerPath');
    const outputPath = tl.getPathInput('outputPath') ||
        path.join(tl.getVariable('Build.SourcesDirectory') || '.', '.alcops');

    // 2. Determine TFM
    let tfm: TargetFramework;
    if (tfmInput) {
        tfm = tfmInput;
        tl.debug(`Using manual TFM: ${tfm}`);
    } else if (compilerPath) {
        const result = await detectFromCompilerPath(compilerPath);
        tfm = result.tfm;
        tl.debug(`Detected TFM from compiler: ${tfm} (${result.details})`);
    } else {
        throw new Error('Either tfm or compilerPath must be provided');
    }

    // 3. Get package
    let nupkgPath: string;
    if (packageSource === 'local' && localPackagePath) {
        nupkgPath = localPackagePath;
    } else {
        const resolved = await resolveVersion(version);
        tl.debug(`Resolved ALCops version: ${resolved}`);
        nupkgPath = await downloadPackage(resolved, outputPath);
        tl.setVariable('alcopsVersion', resolved);
    }

    // 4. Extract
    const { extractedPath, files, actualTfm } = await extractAnalyzers(nupkgPath, tfm, outputPath);

    // 5. Set outputs
    tl.setVariable('tfm', actualTfm, false, true);
    tl.setVariable('analyzerPath', extractedPath, false, true);
    tl.setVariable('analyzers', files.join(';'), false, true);
    tl.setResult(tl.TaskResult.Succeeded, `ALCops installed: ${files.length} analyzers (${actualTfm})`);
}
