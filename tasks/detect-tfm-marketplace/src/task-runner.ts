import * as tl from 'azure-pipelines-task-lib/task';
import { detectFromMarketplace } from './marketplace';

export async function run(): Promise<void> {
    try {
        const channel = tl.getInput('channel') || 'current';
        const specificVersion = tl.getInput('extensionVersion');
        const effectiveChannel = specificVersion || channel;

        tl.debug(`Detecting TFM from VS Marketplace (channel: ${effectiveChannel})`);
        const result = await detectFromMarketplace(effectiveChannel);

        tl.setVariable('tfm', result.tfm, false, true);
        tl.setVariable('extensionVersion', result.extensionVersion, false, true);
        tl.setVariable('assemblyVersion', result.assemblyVersion, false, true);
        tl.setResult(tl.TaskResult.Succeeded, `Detected TFM: ${result.tfm} (AL extension ${result.extensionVersion})`);
    } catch (err: unknown) {
        tl.setResult(tl.TaskResult.Failed, err instanceof Error ? err.message : String(err));
    }
}
