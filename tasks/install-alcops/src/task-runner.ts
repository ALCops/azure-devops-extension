import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import { TargetFramework } from '../../../shared/types';
import { createTaskLogger } from '../../../shared/logger';
import { resolveVersion, downloadPackage } from './nuget-api';
import { extractAnalyzers } from './nuget-extractor';
import { detectFromCompilerPath } from './compiler-path';

export async function run(): Promise<void> {
    // 1. Read inputs
    const logger = createTaskLogger();
    const version = tl.getInput('version') || 'latest';
    const packageSource = tl.getInput('packageSource') || 'nuget';
    const localPackagePath = tl.getPathInput('localPackagePath');
    const tfmInput = tl.getInput('tfm') as TargetFramework | undefined;
    const compilerPath = tl.getPathInput('compilerPath');
    const outputPath = tl.getPathInput('outputPath') ||
        path.join(tl.getVariable('Build.SourcesDirectory') || '.', '.alcops');

    logger.info('Installing ALCops Analyzers...');
    logger.debug(`Inputs: version=${version}, packageSource=${packageSource}, tfm=${tfmInput || '(auto)'}, compilerPath=${compilerPath || '(none)'}`);

    // 2. Determine TFM
    let tfm: TargetFramework;
    if (tfmInput) {
        tfm = tfmInput;
        logger.info(`Using manual TFM: ${tfm}`);
    } else if (compilerPath) {
        const result = await detectFromCompilerPath(compilerPath, logger);
        tfm = result.tfm;
    } else {
        throw new Error('Either tfm or compilerPath must be provided');
    }

    // 3. Get package
    let nupkgPath: string;
    if (packageSource === 'local' && localPackagePath) {
        logger.info(`Using local package: ${localPackagePath}`);
        nupkgPath = localPackagePath;
    } else {
        const resolved = await resolveVersion(version, logger);
        nupkgPath = await downloadPackage(resolved, outputPath, logger);
        tl.setVariable('alcopsVersion', resolved);
    }

    // 4. Extract
    const { extractedPath, files, actualTfm } = await extractAnalyzers(nupkgPath, tfm, outputPath, logger);

    // 5. Set outputs
    tl.setVariable('tfm', actualTfm, false, true);
    tl.setVariable('analyzerPath', extractedPath, false, true);
    tl.setVariable('analyzers', files.join(';'), false, true);
    tl.setResult(tl.TaskResult.Succeeded, `ALCops installed: ${files.length} analyzers (${actualTfm})`);
}
