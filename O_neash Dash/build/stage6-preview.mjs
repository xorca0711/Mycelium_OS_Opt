import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
const root = process.cwd();
const server = await createServer({
  configFile: false, root,
  plugins: [
    {name: 'isolated-settings-preview', enforce:'pre',
      load(id) {
        const file = id.replaceAll('\\','/');
        if(file.endsWith('/src/lib/personalSettingsDb.ts')) return `
          import {getDefaultPersonalSettings} from '/src/lib/personalSettings';
          let current = {...getDefaultPersonalSettings(), displayName:'Preview User', feeds:{news:false,research:false,weather:false,quotes:false}};
          export async function loadPersonalSettings(){ return structuredClone(current); }
          export async function savePersonalSettings(value){
            if(sessionStorage.getItem('preview-fail-save')==='yes') throw new Error('Preview write failure');
            current=structuredClone(value); return structuredClone(current);
          }`;
        if(file.endsWith('/src/lib/db.ts')) return `
          export const getDb=()=>({select:async()=>[],execute:async()=>({rowsAffected:1})});
          export const executeBatch=async()=>[];
          export const setupDb=async()=>{};`;
        if(file.endsWith('/src/lib/dataLocation.ts')) return `
          export const getDataLocation=async()=>({directory:'Preview only / no personal database',databaseUrl:'In-memory preview',development:true});
          export const dataSubdirectory=async d=>'preview/'+d;`;
        if(file.endsWith('/src/lib/dataManagement.ts')) return `
          export {collectLocalPreferences,applyRestoredPreferences} from '/src/lib/localPreferences';
          export const getDataOverview=async()=>({schemaVersion:6,databaseBytes:45056,integrity:['ok'],foreignKeyViolations:0,tables:[{name:'notes',rows:2},{name:'import_sources',rows:1},{name:'import_records',rows:2},{name:'import_runs',rows:1}]});
          export const getRestoreStatus=async()=>({pending:false,appliedPreferences:null,rollbackPath:null});
          export const browseTable=async(table,offset,limit)=>({columns:['id','title','content_plain'],rows:[['example-1','Synthetic note','Preview content'],['example-2','Imported note','Another synthetic row']],total:2,offset,limit});
          export const exportTable=async()=>({path:'Preview only/export.json',rows:2});
          export const createBackup=async()=>({path:'Preview only/backup',createdAt:Date.now(),schemaVersion:6,files:1,bytes:45056,preferences:{}});
          export const validateBackup=createBackup;
          export const stageRestore=async()=>({restartRequired:true,stagedPath:'Preview only/restore'});
          export const acknowledgeRestore=async()=>{};
          export const cancelStagedRestore=async()=>{};`;
      }
    }, react()
  ],
  resolve:{alias:{'@':path.join(root,'src')}},
  server:{host:'127.0.0.1',port:1426,strictPort:true,open:false},
});
await server.listen();
console.log('Isolated settings preview: http://127.0.0.1:1426/build/stage6-preview.html');
