import * as tl from 'azure-pipelines-task-lib/task';
import { detectFromBCArtifact } from './bc-artifact';

export async function run(): Promise<void> {
    try {
        const artifactUrl = tl.getInput('artifactUrl', true)!;
        tl.debug(`Detecting TFM from BC artifact: ${artifactUrl}`);

        const result = await detectFromBCArtifact(artifactUrl);

        tl.setVariable('tfm', result.tfm, false, true);
        tl.setVariable('dotNetVersion', result.details?.match(/dotNetVersion=([^\s]+)/)?.[1] || '', false, true);
        tl.setResult(tl.TaskResult.Succeeded, `Detected TFM: ${result.tfm} (${result.details})`);
    } catch (err: unknown) {
        tl.setResult(tl.TaskResult.Failed, err instanceof Error ? err.message : String(err));
    }
}
