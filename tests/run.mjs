// Bundles the TypeScript tests with esbuild, then runs them in Node.
import {build} from 'esbuild';
await build({entryPoints:['tests/app.test.ts'],bundle:true,platform:'node',format:'esm',outfile:'tests/.out/app.test.mjs',logLevel:'warning',nodePaths:process.env.NODE_PATH?process.env.NODE_PATH.split(':'):[]});
await import('./.out/app.test.mjs');
