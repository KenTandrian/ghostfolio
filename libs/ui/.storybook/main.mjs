import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

/** @type {import('@storybook/angular').StorybookConfig} */
const config = {
  addons: [
    getAbsolutePath('@storybook/addon-docs'),
    getAbsolutePath('@storybook/addon-themes')
  ],
  core: {
    builder: '@storybook/builder-vite',
    disableTelemetry: true
  },
  framework: {
    name: getAbsolutePath('@storybook/angular'),
    options: {}
  },
  staticDirs: [
    {
      from: '../../../apps/client/src/assets',
      to: '/assets'
    }
  ],
  stories: ['../**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  viteFinal: async (config) => {
    const { mergeConfig } = await import('vite');

    return mergeConfig(config, {
      esbuild: {
        tsconfigRaw: {
          compilerOptions: {
            verbatimModuleSyntax: false
          }
        }
      },
      resolve: {
        tsconfigPaths: true
      }
    });
  }
};

export default config;

function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, 'package.json')));
}
