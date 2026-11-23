// Fictional demonstration only. No network calls or persistence.
const buttons=[...document.querySelectorAll('[data-view]')];
for(const button of buttons){
 button.addEventListener('click',()=>{
  for(const option of buttons)option.setAttribute('aria-pressed',String(option===button));
  for(const panel of document.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!==button.dataset.view;
 });
}

const perspectiveButtons=[...document.querySelectorAll('[data-perspective]')];
for(const button of perspectiveButtons){
 button.addEventListener('click',()=>{
  for(const option of perspectiveButtons)option.setAttribute('aria-pressed',String(option===button));
  for(const panel of document.querySelectorAll('[data-perspective-panel]'))panel.hidden=panel.dataset.perspectivePanel!==button.dataset.perspective;
 });
}

const exchangeButtons=document.querySelectorAll('[data-exchange]');
const exchangePanels=document.querySelectorAll('[data-exchange-panel]');
for(const button of exchangeButtons)button.addEventListener('click',()=>{
 const stage=button.dataset.exchange;
 for(const other of exchangeButtons)other.setAttribute('aria-pressed',String(other.dataset.exchange===stage));
 for(const panel of exchangePanels)panel.hidden=panel.dataset.exchangePanel!==stage;
});
