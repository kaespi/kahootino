const statusDiv = document.getElementById('host-status');

document.querySelectorAll('button[data-action]').forEach(btn => {
  btn.addEventListener('click', () => hostAction(btn.dataset.action));
});

async function hostAction(action) {
  const res = await fetch('../api/host_action.php', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({action, code: HOST_CODE})
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    statusDiv.textContent = data.error || 'Fehler';
  } else {
    statusDiv.textContent = `Aktion: ${action} OK`;
  }
}
