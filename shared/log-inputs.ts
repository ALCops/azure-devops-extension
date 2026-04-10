import * as tl from 'azure-pipelines-task-lib/task';
import type { Logger } from './logger';

export interface TaskInputDef {
    name: string;
    type?: string;
    defaultValue?: string;
}

const SENSITIVE_TYPES = ['secureString'];

/**
 * Log all task input parameters as a column-aligned table.
 * Falls back to defaultValue from task.json when no explicit value is set.
 */
export function logTaskInputs(logger: Logger, inputs: TaskInputDef[]): void {
    if (inputs.length === 0) return;

    const maxNameLen = Math.max(...inputs.map((i) => i.name.length));

    logger.info('*** Task Inputs:');
    for (const def of inputs) {
        const raw = tl.getInput(def.name);
        const value = raw ?? def.defaultValue ?? '';
        const display = SENSITIVE_TYPES.includes(def.type ?? '')
            ? '********'
            : value;
        const padded = def.name.padEnd(maxNameLen + 2);
        logger.info(`${padded}${display}`);
    }
    logger.info('');
}
