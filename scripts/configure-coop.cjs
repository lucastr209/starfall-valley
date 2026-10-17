'use strict';
const fs=require('node:fs');const path=require('node:path');
const {coopEndpoint,securityHeaders}=require('../config/deployment.cjs');
// Sinh cấu hình release có CSP đúng endpoint; không mở wildcard hay sửa config Legacy trong repository.
function configure({root=path.resolve(__dirname,'..'),endpoint=process.env.COOP_SERVER_URL||''}={}){
  const coop=coopEndpoint(endpoint);if(!coop)throw new Error('Cần COOP_SERVER_URL trước khi tạo cấu hình release.');
  const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
  const headers=config.headers.find(h=>h.source==='/(.*)').headers;
  headers.find(h=>h.key==='Content-Security-Policy').value=securityHeaders(process.env.ONLINE_WS_URL||'',coop)['Content-Security-Policy'];
  const output=path.join(root,'work/awakening/vercel-release.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(config,null,2)+'\n');return output;
}
if(require.main===module){try{console.log(configure());}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={configure};
