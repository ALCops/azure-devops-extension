import * as tl from 'azure-pipelines-task-lib/task';
import { detectFromBCArtifact } from '@alcops/core';
import { createTaskLogger } from '../../../shared/logger';
import { logTaskInputs } from '../../../shared/log-inputs';
import taskJson from '../task.json';

export async function run(): Promise<void> {
    try {
        const logger = createTaskLogger();
        logTaskInputs(logger, taskJson.inputs);

        const artifactUrl = tl.getInput('artifactUrl', true)!;
        logger.info('Detecting TFM from BC artifact...');

        const result = await detectFromBCArtifact(artifactUrl, logger);

        tl.setVariable('tfm', result.tfm, false, true);
        tl.setVariable('dotNetVersion', result.details?.match(/dotNetVersion=([^\s]+)/)?.[1] || '', false, true);
        tl.setResult(tl.TaskResult.Succeeded, `Detected TFM: ${result.tfm} (${result.details})`);
    } catch (err: unknown) {
        tl.setResult(tl.TaskResult.Failed, err instanceof Error ? err.message : String(err));
    }
}
