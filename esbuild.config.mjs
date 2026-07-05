import esbuild from 'esbuild';
import { builtinModules } from 'node:module';

const prod = process.argv[2] === 'production';

const ctx = await esbuild.context({
  entryPoints: ['src/plugin/main.ts'],
  outfile: 'main.js',
  bundle: true,
  format: 'cjs',
  target: 'es2020',
  platform: 'browser',
  sourcemap: prod ? false : 'inline',
  minify: prod,
  treeShaking: true,
  logLevel: 'info',
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtinModules,
  ],
});

if (prod) {
  await ctx.rebuild();
  ctx.dispose();
  process.exit(0);
} else {
  await ctx.watch();
}
