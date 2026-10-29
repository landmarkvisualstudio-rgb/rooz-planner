// Static build for GitHub Pages: bundles src/ with esbuild into dist/.
import {build} from 'esbuild';
import {cpSync,mkdirSync,readFileSync,rmSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

const watch=process.argv.includes('--dev');
rmSync('dist',{recursive:true,force:true});mkdirSync('dist/assets',{recursive:true});
const result=await build({
  entryPoints:['src/main.tsx'],bundle:true,minify:!watch,sourcemap:watch,format:'esm',target:'es2020',
  outdir:'dist/assets',entryNames:'app-[hash]',assetNames:'[name]-[hash]',loader:{'.woff2':'file'},
  jsx:'automatic',define:{'process.env.NODE_ENV':JSON.stringify(watch?'development':'production')},
  nodePaths:process.env.NODE_PATH?process.env.NODE_PATH.split(':'):[],metafile:true,logLevel:'warning',
});
const outs=Object.keys(result.metafile.outputs).map(p=>p.replace(/^dist\//,''));
const js=outs.find(p=>p.endsWith('.js')),css=outs.find(p=>p.endsWith('.css'));
cpSync('public','dist',{recursive:true});
// cache-bust the service worker so installed apps pick up new versions
const version=createHash('sha1').update(outs.join()).digest('hex').slice(0,10);
writeFileSync('dist/sw.js',readFileSync('dist/sw.js','utf8').replace("'rooz-v1'",`'rooz-${version}'`));
let html=readFileSync('index.html','utf8')
  .replace('<script type="module" src="./src/main.tsx"></script>',`<script type="module" src="./${js}"></script>`)
  .replace('</head>',`<link rel="stylesheet" href="./${css}">\n</head>`);
writeFileSync('dist/index.html',html);
writeFileSync('dist/404.html',html);
writeFileSync('dist/.nojekyll','');
console.log('built',readdirSync('dist/assets').join(', '));
