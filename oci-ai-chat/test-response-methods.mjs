console.log("THIS IS THE CORRECT FILE");
async function testChat() {
  try {
    const response = await fetch('http://127.0.0.1:8765/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      }),
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      console.error('Error:', response.status, await response.text());
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      console.log('Chunk:', decoder.decode(value));
    }
  } catch (e) {
    console.error("Fetch error:", e);
  }
}

testChat();
