import {type UserConfig, mergeConfig} from 'vitest/config';
import {baseConfig} from './vitest.config.base.js';

export default mergeConfig<UserConfig, Partial<UserConfig>>(baseConfig, {
	test: {
		include: ['**/*.integration.spec.ts'],
		setupFiles: ['src/utils/test-utils/integration-test-setup.ts'],
		minWorkers: 1,
		maxWorkers: 1,
	},
});
