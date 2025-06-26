const chatbox = document.getElementById('chatbox');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');

const backendUrl = 'https://chat-bot-2-0-jj5p.onrender.com';

let currentSessionId = `sessao_${Date.now()}`;
let chatStartTime = new Date();

// ================== PASSO 4.1: ADICIONE A FUNÇÃO DE RANKING ==================
// Esta função envia os dados do seu bot para o endpoint de ranking no backend.
async function registrarAcessoParaRanking() {
  try {
    const dataRanking = {
      // IMPORTANTE: Mude "aluno_seu_nome" para algo único seu (ex: seu primeiro nome)
      // Este ID deve ser único para o seu bot na competição!
      botId: "musashi_chatbot_aluno_seu_nome", 
      
      // IMPORTANTE: Use o mesmo nome de bot que você definiu no server.js
      nomeBot: "Musashi Miyamoto Chatbot" 
    };

    // "Fire-and-forget": Nós apenas enviamos a informação, não precisamos esperar
    // uma resposta para continuar a usar o chat.
    fetch(`${backendUrl}/api/ranking/registrar-acesso-bot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dataRanking),
    });

    console.log("Sinal de acesso para ranking enviado.");
  } catch (error) {
    console.error("Falha ao enviar sinal de ranking:", error);
  }
}
// ============================================================================


function addMessage(message, className) {
    const div = document.createElement('div');
    div.textContent = message;
    div.className = className;
    chatbox.appendChild(div);
    chatbox.scrollTop = chatbox.scrollHeight;
}

async function sendMessageToServer() {
    const prompt = userInput.value.trim();
    if (!prompt) return; // Não envia mensagem vazia

    addMessage(prompt, 'user-message'); // Mostra a mensagem do usuário
    userInput.value = ''; // Limpa o input
    sendButton.disabled = true; // Desabilita o botão enquanto espera

    try {
        const response = await fetch(`${backendUrl}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: prompt }),
        });

        if (!response.ok) {
            throw new Error(`Erro do servidor: ${response.statusText}`);
        }

        const data = await response.json();
        addMessage(data.reply, 'bot-message');

        // ================== PASSO 4.2: CHAME A FUNÇÃO DE RANKING ==================
        // Após receber uma resposta com sucesso, registramos o acesso para o ranking.
        registrarAcessoParaRanking();
        // ========================================================================

    } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        addMessage("Erro ao conectar com o bot.", 'bot-message');
    } finally {
         sendButton.disabled = false; // Reabilita o botão
    }
}

sendButton.addEventListener('click', sendMessageToServer);

// Permite enviar com Enter
userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessageToServer();
    }
});

// Mensagem inicial (opcional)
addMessage("Olá! Sou Musashi. Como posso guiar seu caminho hoje?", 'bot-message');

async function salvarHistoricoSessao(sessionId, botId, startTime, endTime, messages) {
    try {
        const payload = {
            sessionId,
            botId,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            messages // O array chatHistory completo
        };

        const response = await fetch('/api/chat/salvar-historico', { // Não precisa do backendUrl se for a mesma origem
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error("Falha ao salvar histórico:", errorData.error || response.statusText);
        } else {
            const result = await response.json();
            console.log("Histórico de sessão enviado para o servidor:", result.message);
        }
    } catch (error) {
        console.error("Erro de rede ao tentar enviar histórico de sessão:", error);
    }
}