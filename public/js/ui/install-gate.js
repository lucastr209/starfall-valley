/* Luồng cài ứng dụng chỉ quản lý khả năng vào chơi; không đọc hoặc ghi save. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StardropInstallGate=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function policy({userAgent='',platform='',maxTouchPoints=0,standalone=false,legacyStandalone=false,hostname='',search=''}={}){
    const query=new URLSearchParams(search),localQA=['localhost','127.0.0.1'].includes(hostname)&&query.get('qa')==='1',preview=localQA&&query.get('scene')==='install';
    const ios=preview?query.get('device')!=='android':/iPhone|iPad|iPod/i.test(userAgent)||platform==='MacIntel'&&maxTouchPoints>1;
    const mobile=preview||ios||/Android|Mobile/i.test(userAgent),qa=localQA&&!preview;
    return {required:mobile&&!standalone&&!legacyStandalone&&!qa,ios};
  }
  function mount({window:w,document:d}){
    const $=id=>d.getElementById(id),display=w.matchMedia?.('(display-mode: standalone)');
    let promptEvent=null,current;
    function refresh(){
      current=policy({...w.navigator, userAgent:w.navigator?.userAgent,platform:w.navigator?.platform,maxTouchPoints:w.navigator?.maxTouchPoints,legacyStandalone:w.navigator?.standalone,standalone:!!display?.matches,hostname:w.location?.hostname,search:w.location?.search});
      $('install-screen').hidden=!current.required;
      // Chỉ ẩn màn hình đầu khi cần cài; refresh không làm màn hình đầu chồng lên phiên đang chơi.
      if(current.required)$('start-screen').hidden=true;
      else if($('play-screen').hidden)$('start-screen').hidden=false;
      $('install-ios').hidden=!current.ios;$('install-android').hidden=current.ios;
      $('btn-install-app').hidden=current.ios||!promptEvent;
      return current;
    }
    w.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;refresh();});
    w.addEventListener('appinstalled',()=>{promptEvent=null;$('install-status').textContent='Đã thêm ứng dụng. Hãy về Màn hình chính và mở biểu tượng Sao Rơi để chơi.';refresh();});
    $('btn-install-app').addEventListener('click',async()=>{
      if(!promptEvent)return;const event=promptEvent;promptEvent=null;refresh();
      try{await event.prompt();const choice=await event.userChoice;$('install-status').textContent=choice?.outcome==='accepted'?'Hãy mở Sao Rơi từ Màn hình chính để bắt đầu.':'Bạn có thể cài lại bằng menu của trình duyệt.';}catch(_){$('install-status').textContent='Mở menu trình duyệt và chọn Cài đặt ứng dụng / Thêm vào Màn hình chính.';}
    });
    $('btn-install-check').addEventListener('click',()=>{refresh();if(current.required)$('install-status').textContent='Bạn vẫn đang ở trình duyệt. Hãy về Màn hình chính và mở biểu tượng Sao Rơi.';});
    display?.addEventListener?.('change',refresh);w.addEventListener('pageshow',refresh);refresh();
    return Object.freeze({canPlay:()=>!refresh().required,refresh});
  }
  return Object.freeze({policy,mount});
});
