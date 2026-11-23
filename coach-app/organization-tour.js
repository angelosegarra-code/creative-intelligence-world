// Fictional demonstration only. No network calls or persistence.
const buttons=[...document.querySelectorAll('[data-view]')];
for(const button of buttons){
 button.addEventListener('click',()=>{
  for(const option of buttons)option.setAttribute('aria-pressed',String(option===button));
  for(const panel of document.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!==button.dataset.view;
 });
}
