import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        files: ['shared/**/*.ts', 'tasks/*/src/**/*.ts'],
        extends: [...tseslint.configs.recommended],
    },
    {
        ignores: ['**/dist/', 'dist-tsc/', 'out/', 'node_modules/'],
    },
);
