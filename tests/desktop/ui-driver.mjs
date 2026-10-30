import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
export const vaultName = 'Heading Indent UI Lab 20261030';
export const evidence = path.resolve('artifacts/obsidian-ui-20261030/evidence');
export const vaultPath = path.resolve('artifacts/obsidian-ui-20261030/vaults', vaultName);
fs.mkdirSync(evidence, { recursive: true });
export function cli(code) {
  const wrapped = `(async()=>{if(app.vault.adapter.getBasePath()!==${JSON.stringify(vaultPath)})throw Error('Wrong test vault');const value=await(async()=>{${code}})();return JSON.stringify(value)})()`;
  const result = execFileSync('obsidian', [`vault=${vaultName}`, 'eval', `code=${wrapped}`], { encoding: 'utf8', timeout: 30000 });
  if (!result.startsWith('=> ')) throw Error(result);
  return JSON.parse(result.slice(3));
}
export function record(name, value) {
  fs.writeFileSync(path.join(evidence, `${name}.json`), JSON.stringify(value, null, 2) + '\n');
  console.log(name, JSON.stringify(value));
  return value;
}
export function screenshot(name) {
  cli('return true;'); // Recheck vault identity before capturing anything.
  const target = path.join(evidence, `${name}.png`);
  console.log(execFileSync('obsidian', [`vault=${vaultName}`, 'dev:screenshot', `path=${target}`], {encoding:'utf8', timeout:30000}).trim());
  return target;
}
export function installMeasurement() {
 return cli(`
 window.__hliLab = {
  errors: [],
  measure() {
   const leaves=app.workspace.getLeavesOfType('markdown');
   return {
    theme:app.customCss.theme,
    version:app.plugins.plugins['heading-level-indent']?.manifest.version,
    activeType:app.workspace.activeLeaf?.view.getViewType(),
    activeFile:app.workspace.getActiveFile()?.path,
    notes:leaves.filter(l=>l.view.editor?.cm && l.view.getMode()==='source').map(l=>{
     const v=l.view.editor.cm,c=v.contentDOM,r=c.getBoundingClientRect();
     const rect=e=>{const b=e.getBoundingClientRect();return{left:b.left-r.left,right:b.right-r.left,width:b.width,css:e.getAttribute('style'),className:e.className,text:e.textContent.slice(0,80)}};
     return {file:l.view.file.path,visible:r.width>0,contentWidth:c.clientWidth,contentScroll:c.scrollWidth,paneWidth:v.scrollDOM.clientWidth,paneScroll:v.scrollDOM.scrollWidth,lines:[...c.querySelectorAll(':scope > .cm-line')].map(rect),widgets:[...c.children].filter(e=>!e.classList.contains('cm-line')).map(rect)};
    }),
    inputs:[...document.querySelectorAll('.cm-content')].filter(e=>!e.closest('.markdown-source-view')).map(e=>({width:e.clientWidth,active:e.contains(document.activeElement)||e===document.activeElement,activeLeaf:!!e.closest('.workspace-leaf.mod-active'),decorated:e.querySelectorAll('.cm-line[style*="inset-inline"],.cm-line[style*="left:"]').length})),
    errors:this.errors
   };
  }
 };
 window.__hliLab.captureError=e=>window.__hliLab.errors.push(String(e.message));
 window.addEventListener('error',window.__hliLab.captureError);
 return window.__hliLab.measure();`);
}
export function measure(name) { return record(name, cli('return window.__hliLab.measure();')); }
export function openNote(file, split=false) {
 return cli(`const leaf=app.workspace.getLeaf(${split ? "'split','vertical'" : 'false'});await leaf.openFile(app.vault.getAbstractFileByPath(${JSON.stringify(file)}));await leaf.setViewState({type:'markdown',state:{file:${JSON.stringify(file)},mode:'source',source:false},active:true});return {file:leaf.view.file.path};`);
}
if (process.argv[2]==='init') record('lab-initial', installMeasurement());
if (process.argv[2]==='measure') measure(process.argv[3]);
if (process.argv[2]==='screenshot') screenshot(process.argv[3]);
