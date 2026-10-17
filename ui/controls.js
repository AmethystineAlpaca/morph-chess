import './controls.css';

// Native disclosure provides keyboard activation and an accessible open state.
export function mountControls(panel = document.querySelector('aside')) {
  document.body.classList.add('minimal-ui');
  const controls = document.createElement('details');
  controls.className = 'scene-controls';
  const toggle = document.createElement('summary');
  toggle.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14"/><path d="M7 3v4M13 8v4M8 13v4"/></svg><span>Settings</span>';
  panel.classList.add('settings-panel');
  panel.hidden = false;
  controls.append(toggle, panel);
  document.querySelector('#app').append(controls);

  document.addEventListener('pointerdown', event => {
    if (controls.open && !controls.contains(event.target)) controls.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !controls.open) return;
    event.preventDefault();
    event.stopPropagation();
    controls.open = false;
    toggle.focus();
  }, true);
  return controls;
}
