import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export async function buildCadStudy({output}) {
  const directory=resolve(output);await mkdir(directory,{recursive:true});
  const entry=new URL('../src/cad-study/viewer.js',import.meta.url).pathname;
  await build({entryPoints:[entry],outfile:resolve(directory,'cad-study.js'),bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',legalComments:'inline'});
  const schema=await readFile(new URL('../src/cad-study/schema.js',import.meta.url));
  await writeFile(resolve(directory,'cad-schema.mjs'),schema);
  const notices=await readFile(new URL('../node_modules/three/LICENSE',import.meta.url));await writeFile(resolve(directory,'THREE-LICENSE.txt'),notices);
  const files={};for(const file of ['cad-study.js','cad-schema.mjs','THREE-LICENSE.txt'])files[file]=createHash('sha256').update(await readFile(resolve(directory,file))).digest('hex');
  await writeFile(resolve(directory,'cad-manifest.json'),JSON.stringify({schema:'ragbaz.cad-study.build/v1',files},null,2)+'\n');
  return files;
}
