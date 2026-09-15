window.assetAuthReady().catch(error => {
  const output = document.querySelector('#account-message');
  output.textContent = error.message || 'Unable to load account settings.';
  output.classList.add('error');
  output.hidden = false;
});
