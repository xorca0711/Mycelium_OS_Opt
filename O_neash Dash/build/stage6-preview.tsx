import React from 'react';
import {createRoot} from 'react-dom/client';
import App from '../src/App';
import usePluginStore from '../src/store/usePluginStore';
createRoot(document.getElementById('root')!).render(<><App/><aside style={{position:'fixed',top:0,right:0,zIndex:100000,background:'#333',color:'#fff',font:'12px sans-serif'}} aria-label="Isolated preview controls"><button onClick={()=>usePluginStore.getState().setActivePlugin(null)}>Preview Home</button> | <button onClick={()=>usePluginStore.getState().openProfileSettings()}>Preview profile request</button><output id="qa-font-status">Checking fonts</output></aside></>);

document.fonts.ready.then(()=>{ document.getElementById("qa-font-status")!.textContent = Array.from(document.fonts).filter(f=>["VT323", "Odibee Sans"].includes(f.family)).map(f=>f.family+":"+f.status).join(" | "); });
