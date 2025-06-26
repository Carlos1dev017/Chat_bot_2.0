// client.js COMPLETO E CORRIGIDO

const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');

// <<< MODIFICADO >>> Variáveis para controlar a sessão e o histórico
let chatHistory = []; // Renomeado de clientHistory para consistência
let currentSessionId = `sessao_${Date.now()}`; // Gera um ID único quando a página carrega
let chatStartTime = new Date(); // Guarda o momento de início do chat

// --- Funções Auxiliares ---
function addMessage(message, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${sender}-message`);
    messageDiv.textContent = message;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function showTypingIndicator(show = true) {
    removeTypingIndicator();
    if (show) {
        const typingDiv = document.createElement('div');
        typingDiv.classList.add('message', 'bot-message', 'typing-indicator');
        typingDiv.textContent = 'Meditando...';
        typingDiv.id = 'typing';
        chatBox.appendChild(typingDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

function removeTypingIndicator() {
    const typingDiv = document.getElementById('typing');
    if (typingDiv) {
        typingDiv.remove();
    }
}

// --- Função Principal de Envio ---
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    addMessage(message, 'user');
    
    // <<< MODIFICADO >>> Corrigida a estrutura do push
    chatHistory.push({ role: 'user', parts: [{ text: message }] });
    userInput.value = '';
    showTypingIndicator();

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message, sessionId: currentSessionId }),
        });

        removeTypingIndicator();

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Erro na resposta do servidor:', response.status, errorData);
            addMessage(`Erro ${response.status}: ${errorData.error || 'Não foi possível obter a resposta do chatbot.'}`, 'bot');
            return;
        }

        const data = await response.json();

        if (data.reply) {
            addMessage(data.reply, 'bot');
            
            // <<< MODIFICADO >>> Corrigida a estrutura e adicionada a chamada para salvar
            chatHistory.push({ role: 'model', parts: [{ text: data.reply }] });
            currentSessionId = data.sessionId;

            // Chama a função para salvar o histórico completo atualizado
            const botId = "Musashi Miyamoto Chatbot"; // Use o nome exato do seu bot
            await salvarHistoricoSessao(currentSessionId, botId, chatStartTime, new Date(), chatHistory);

        } else {
             addMessage('Recebi uma resposta vazia do bot.', 'bot');
        }

    } catch (error) {
        removeTypingIndicator();
        console.error('Erro ao enviar mensagem:', error);
        addMessage('Ocorreu um erro de conexão. Tente novamente.', 'bot');
    }
}

// --- Event Listeners ---
sendButton.addEventListener('click', sendMessage);

userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

// <<< ADICIONADO >>> Nova função para enviar o histórico para o backend
async function salvarHistoricoSessao(sessionId, botId, startTime, endTime, messages) {
    try {
        const payload = {
            sessionId,
            botId,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            messages // O array chatHistory completo
        };

        const response = await fetch('/api/chat/salvar-historico', {
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