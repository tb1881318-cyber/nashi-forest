const navToggle = document.querySelector('.navtoggle');
const navigation = document.querySelector('.nav');
function closeMenu() {
  navigation.classList.remove('open');
  navToggle.setAttribute('aria-expanded','false');
}
navToggle.onclick = () => navToggle.setAttribute('aria-expanded',String(navigation.classList.toggle('open')));
navigation.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && navigation.classList.contains('open')){closeMenu();navToggle.focus();} });
