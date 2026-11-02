const form = document.querySelector('#chat');
const answer = document.querySelector('#answer');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const message = document.querySelector('#message').value.trim();
  if (!message) return;
  const button = form.querySelector('button');
  button.disabled = true;
  answer.textContent = 'Waiting for approval and provider response…';
  try {
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
    const data = await response.json();
    if (!response.ok || typeof data.answer !== 'string') throw new Error(data.error || 'The provider did not return an answer.');
    answer.textContent = data.answer;
  } catch (error) {
    answer.textContent = error instanceof Error ? error.message : 'Request failed.';
  } finally { button.disabled = false; }
});
