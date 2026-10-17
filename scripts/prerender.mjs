import {build} from 'esbuild';
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
await build({entryPoints:['src/App.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',packages:'external',outfile:'.ssr/App.mjs'});
const {App}=await import('../.ssr/App.mjs');
const {createElement}=await import('react');const {renderToString}=await import('react-dom/server');
const template=await readFile('dist/index.html','utf8');
for(const route of ['/','/privacy','/terms','/operations']){
 const html=template.replace('<!--app-html-->',renderToString(createElement(App,{path:route})));
 const folder=route==='/'?'dist':'dist'+route;await mkdir(folder,{recursive:true});await writeFile(folder+'/index.html',html);
}
await writeFile('dist/404.html',template.replace('<!--app-html-->',renderToString(createElement(App,{path:'/404'}))));
await rm('.ssr',{recursive:true,force:true});
console.log('Pre-rendered landing, legal and operations pages.');
