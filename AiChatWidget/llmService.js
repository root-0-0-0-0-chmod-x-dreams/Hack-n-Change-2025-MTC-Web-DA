// llmService.js
export class LLMService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://openrouter.ai/api/v1';
  }

  async sendMessage(messages, onChunk, options = {}) {
    const {
      model = 'nvidia/nemotron-nano-12b-v2-vl:free',
      stream = true,
      max_tokens = 1000,
      temperature = 0.7
    } = options;

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.href,
          'X-Title': 'AI Chat Widget'
        },
        body: JSON.stringify({
          model,
          messages,
          stream,
          max_tokens,
          temperature
        })
      });

      if (!response.ok) throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);

      if (stream) {
        await this.handleStreamResponse(response, onChunk);
      } else {
        const data = await response.json();
        return data.choices[0]?.message?.content || '';
      }
    } catch (error) {
      console.error('Error calling OpenRouter API:', error);
      throw error;
    }
  }

  async handleStreamResponse(response, onChunk) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;
          if (trimmedLine.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(trimmedLine.slice(6));
              const content = jsonData.choices[0]?.delta?.content;
              if (content) onChunk(content);
            } catch (e) { console.warn('Failed to parse JSON:', trimmedLine, e);}
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  formatMessages(chatHistory, newUserMessage) {
    const messages = chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    messages.push({ role: 'user', content: newUserMessage });
    return messages;
  }
}
