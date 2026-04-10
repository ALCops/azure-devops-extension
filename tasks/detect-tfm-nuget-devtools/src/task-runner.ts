import * as tl from 'azure-pipelines-task-lib/task';
import { detectFromNuGetDevTools } from './nuget-devtools';
import { createTaskLogger } from '../../../shared/logger';

export async function run(): Promise<void> {
    try {
        const logger = createTaskLogger();
        const version = tl.getInput('version') || 'latest';
        logger.info('Detecting TFM from NuGet DevTools...');
        logger.debug(`Requested version: ${version}`);

        const result = await detectFromNuGetDevTools(version, logger);

        tl.setVariable('tfm', result.tfm, false, true);
        tl.setVariable('devToolsVersion', result.details?.match(/version (.+)/)?.[1] || '', false, true);
        tl.setResult(tl.TaskResult.Succeeded, `Detected TFM: ${result.tfm} (${result.details})`);
    } catch (err: unknown) {
        tl.setResult(tl.TaskResult.Failed, err instanceof Error ? err.message : String(err));
    }
}
