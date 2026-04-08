import * as tl from 'azure-pipelines-task-lib/task';
import { detectFromNuGetDevTools } from './nuget-devtools';

export async function run(): Promise<void> {
    try {
        const version = tl.getInput('version') || 'latest';
        tl.debug(`Detecting TFM from NuGet DevTools version: ${version}`);

        const result = await detectFromNuGetDevTools(version);

        tl.setVariable('tfm', result.tfm, false, true);
        tl.setVariable('devToolsVersion', result.details?.match(/version (.+)/)?.[1] || '', false, true);
        tl.setResult(tl.TaskResult.Succeeded, `Detected TFM: ${result.tfm} (${result.details})`);
    } catch (err: unknown) {
        tl.setResult(tl.TaskResult.Failed, err instanceof Error ? err.message : String(err));
    }
}
