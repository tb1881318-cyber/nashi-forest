(()=>{
 const allowedPages=new Set(['host.html','player.html','board.html','calculator.html','index.html']);
 let activeRoom=new URLSearchParams(location.search).get('room');
 function remember(room){
  if(!/^(?:[0-9]{4}|[0-9]{6})$/.test(room??''))return;
  activeRoom=room;
  try{sessionStorage.setItem('nash-active-room',room);}catch{}
  updateLinks();
 }
 function updateLinks(){
  if(!activeRoom)return;
  for(const anchor of document.querySelectorAll('a[href]')){
   const target=new URL(anchor.getAttribute('href'),location.href);
   const page=target.pathname.split('/').pop();
   if(target.origin!==location.origin||!allowedPages.has(page))continue;
   target.searchParams.set('room',activeRoom);
   anchor.href=target.href;
  }
 }
 if(activeRoom)remember(activeRoom);
 else{
  try{activeRoom=sessionStorage.getItem('nash-active-room');}catch{}
 }
 document.addEventListener('DOMContentLoaded',updateLinks);
 window.addEventListener('nash-room-changed',event=>remember(event.detail));
})();
