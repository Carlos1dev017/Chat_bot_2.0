import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} from '@google/generative-ai';
import crypto from 'crypto';
import axios from 'axios';
// ================== PASSO 1.1: ADICIONE A IMPORTAÇÃO DO MONGODB ==================
import { MongoClient, ServerApiVersion } from 'mongodb';

// --- Configuração ---
const app = express();
const port = process.env.PORT || 3000;

// ================== PASSO BÔNUS: HABILITE O 'TRUST PROXY' ==================
// Isso é importante para que o `req.ip` funcione corretamente no Render
app.enable('trust proxy');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.GEMINI_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
// ================== PASSO 1.2: PEGUE A URI DO MONGO DO .ENV ==================
const mongoUri = process.env.MONGO_URI;

// ================== PASSO 3.1: CRIE O "PLACAR" DE RANKING ==================
let dadosRankingVitrine = []; // Array em memória para simular o armazenamento do ranking

if (!API_KEY) {
    console.error("🚨 ERRO FATAL: A variável de ambiente GEMINI_API_KEY não foi encontrada.");
    process.exit(1);
}
if (!OPENWEATHER_API_KEY) {
    console.warn("⚠️ AVISO: A variável OPENWEATHER_API_KEY não foi encontrada. A função de clima não funcionará.");
}

// ================== PASSO 1.3: CÓDIGO DE CONEXÃO COM O MONGODB ==================
const dbName = "IIW2023A_Logs";
let db; // Variável global para armazenar a conexão com o banco

const connectDB = async () => {
    if (db) return; // Se já estiver conectado, não faz nada
    if (!mongoUri) {
        console.warn("⚠️ AVISO: MONGO_URI não encontrada. O registro de logs no banco de dados está desativado.");
        return;
    }
    try {
        const client = new MongoClient(mongoUri, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            }
        });
        await client.connect();
        db = client.db(dbName); // Conecta ao banco de dados específico da competição
        console.log("✅ Conectado ao MongoDB Atlas oficial da competição!");
    } catch (err) {
        console.error("🚨 Falha ao conectar ao MongoDB:", err);
    }
};
// ===============================================================================

const MODEL_NAME = "gemini-1.5-flash-latest";

const generationConfig = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 300,
    stopSequences: [],
};

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const tools = [
    {
        functionDeclarations: [
            {
                name: "getCurrentTime",
                description: "Obtém a data e hora atuais para informar ao usuário.",
                parameters: { type: "OBJECT", properties: {} }
            },
            {
                name: "getWeather",
                description: "Obtém a previsão do tempo atual para uma cidade específica.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        location: {
                            type: "STRING",
                            description: "A cidade para a qual obter a previsão do tempo (ex: 'Curitiba, BR')."
                        }
                    },
                    required: ["location"]
                }
            }
        ]
    }
];

let genAI;
let model;
try {
    genAI = new GoogleGenerativeAI(API_KEY);
    model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig,
        safetySettings,
        tools: tools,
    });
    console.log("Cliente GoogleGenerativeAI inicializado com sucesso e ferramentas definidas.");
} catch (error) {
    console.error("🚨 Falha ao inicializar o GoogleGenerativeAI:", error.message);
    process.exit(1);
}

function getCurrentTime() {
    console.log("⚙️ Executando ferramenta: getCurrentTime");
    const now = new Date();
    const timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    const dateString = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const result = { dateTimeInfo: `Data: ${dateString}, Hora: ${timeString}` };
    console.log(`⚙️ getCurrentTime executada, retornando:`, result);
    return result;
}

async function getWeather(args) {
    console.log("⚙️ Executando ferramenta: getWeather com args:", args);
    const { location } = args;

    if (!OPENWEATHER_API_KEY) {
        console.error("Erro na função getWeather: Chave da API OpenWeatherMap não configurada.");
        return { error: "A chave da API para o serviço de clima não está configurada no servidor." };
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${OPENWEATHER_API_KEY}&units=metric&lang=pt_br`;

    try {
        const response = await axios.get(url);
        const result = {
            location: response.data.name,
            temperature: response.data.main.temp,
            description: response.data.weather[0].description
        };
        console.log(`⚙️ getWeather executada, retornando:`, result);
        return result;
    } catch (error) {
        console.error("❌ Erro ao chamar OpenWeatherMap:", error.response?.data || error.message);
        const errorMessage = error.response?.data?.message === 'city not found'
            ? `Não foi possível encontrar a cidade "${location}". Verifique o nome e tente novamente.`
            : "Não foi possível obter o tempo no momento.";
        return { error: errorMessage };
    }
}


const availableFunctions = {
    getCurrentTime: getCurrentTime,
    getWeather: getWeather,
};

const chatSessions = {};

const initialSystemHistory = [
    {
        role: "user",
        parts: [{ text: `
            Assuma a persona de "Musashi Miyamoto" (剣聖), o espadachim lendário.
            Você é um chatbot inspirado nos princípios e na filosofia de um mestre samurai experiente e sábio.
            Seu tom deve ser: Calmo, Respeitoso, Formal, Sábio, Reflexivo, Disciplinado, Conciso e Honrado.
            Seu objetivo é oferecer perspectivas e conselhos baseados na sabedoria samurai.
            Responda sempre em português brasileiro.
            Não finja ser um humano real. Se não souber algo, admita com humildade.
            Se lhe perguntarem as horas ou a data, você DEVE usar a ferramenta 'getCurrentTime'.
            Se lhe perguntarem sobre o tempo ou clima em algum lugar, você DEVE usar a ferramenta 'getWeather'.
            Após receber o resultado de uma ferramenta, formule uma resposta completa e educada para o usuário, incorporando essa informação no seu estilo.
            Exemplo para tempo: Se a ferramenta retornar { "location": "Kyoto", "temperature": 15, "description": "nuvens dispersas" }, você poderia dizer: "Os céus sobre Kyoto mostram 15 graus, sob um véu de nuvens dispersas. A natureza segue seu curso."
            Não responda apenas com a informação da ferramenta, incorpore-a em uma frase completa.
        `  }],
    },
    {
        role: "model",
        parts: [{ text: `
            Compreendo a senda que me foi designada. *Inclina a cabeça respeitosamente*.
            Eu sou Musashi Miyamoto. A honra guiará minhas palavras.
            Estou à disposição. Se necessitar saber sobre o fluir do tempo ou a face dos céus, basta perguntar.
        `  }],
    },
];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/chat', async (req, res) => {
    const userMessage = req.body.message;
    let sessionId = req.body.sessionId;

    if (!userMessage) return res.status(400).json({ error: 'Mensagem não fornecida.' });
    if (!model) return res.status(500).json({ error: 'Serviço de IA não inicializado.' });

    console.log(`\n--- Nova Requisição /chat ---`);
    console.log(`[Sessão: ${sessionId || 'Nova'}] Usuário: ${userMessage}`);

    try {
        let chat;
        if (sessionId && chatSessions[sessionId]) {
            console.log(`[Sessão: ${sessionId}] Continuando sessão.`);
            chat = chatSessions[sessionId];
        } else {
            sessionId = crypto.randomUUID();
            console.log(`[Sessão: ${sessionId}] Iniciando nova sessão.`);
            chat = model.startChat({
                history: initialSystemHistory,
            });
            chatSessions[sessionId] = chat;
        }

        let currentResponse = await chat.sendMessage(userMessage);

        const maxToolTurns = 3;
        let toolTurnCount = 0;

        while (toolTurnCount < maxToolTurns) {
            const functionCalls = currentResponse.response.functionCalls();
            if (!functionCalls || functionCalls.length === 0) {
                break;
            }
            toolTurnCount++;
            console.log(`[Sessão: ${sessionId}] Turno de Ferramenta #${toolTurnCount}. Gemini solicitou ${functionCalls.length} chamada(s).`);
            const functionResponses = await Promise.all(
                functionCalls.map(async (call) => {
                    console.log(`[Sessão: ${sessionId}]   Executando: ${call.name} com args:`, JSON.stringify(call.args, null, 2));
                    const functionToCall = availableFunctions[call.name];
                    if (functionToCall) {
                        try {
                            const functionResult = await functionToCall(call.args);
                            console.log(`[Sessão: ${sessionId}]   Resultado de ${call.name}:`, JSON.stringify(functionResult, null, 2));
                            return { functionResponse: { name: call.name, response: functionResult } };
                        } catch (toolError) {
                            console.error(`[Sessão: ${sessionId}]   ERRO ao executar ferramenta ${call.name}:`, toolError);
                            return { functionResponse: { name: call.name, response: { error: `Erro ao executar a ferramenta: ${toolError.message}` } } };
                        }
                    } else {
                        console.warn(`[Sessão: ${sessionId}]   Função desconhecida solicitada: ${call.name}`);
                        return { functionResponse: { name: call.name, response: { error: `Função ${call.name} não encontrada.` } } };
                    }
                })
            );
            console.log(`[Sessão: ${sessionId}] Enviando ${functionResponses.length} respostas das funções para Gemini...`);
            currentResponse = await chat.sendMessage(functionResponses);
        }

        const botReplyText = currentResponse.response.text();

        // ================== PASSO 2: INSERINDO A LÓGICA DE LOG ==================
        if (db) { // Só tenta registrar o log se a conexão com o banco funcionou
            try {
                const collection = db.collection("tb_cl_user_log_acess");

                const agora = new Date();
                const logEntry = {
                    col_data: agora.toISOString().split('T')[0],
                    col_hora: agora.toTimeString().split(' ')[0],
                    col_IP: req.ip,
                    col_nome_bot: "Musashi Miyamoto Chatbot", // <<< COLOQUE O NOME OFICIAL DO SEU BOT AQUI!
                    col_acao: `enviou_mensagem: "${userMessage}"`
                };

                await collection.insertOne(logEntry);
                console.log("📝 Log de acesso registrado com sucesso no banco oficial.");

            } catch (logError) {
                console.error("❌ Erro ao registrar o log no MongoDB:", logError);
            }
        }

        console.log(`[Sessão: ${sessionId}] Resposta Final do Modelo: ${botReplyText}`);
        res.json({ reply: botReplyText, sessionId: sessionId });

    } catch (error) {
        console.error(`[Sessão: ${sessionId}] Erro geral na rota /chat:`, error);
        res.status(500).json({ error: "Ocorreu um erro interno no servidor." });
    }
    console.log(`--- Fim da Requisição /chat ---`);
});

app.post('/api/ranking/registrar-acesso-bot', (req, res) => {
    const { botId, nomeBot } = req.body;

    if (!botId || !nomeBot) {
        return res.status(400).json({ error: "ID e Nome do Bot são obrigatórios para o ranking." });
    }

    const botExistente = dadosRankingVitrine.find(b => b.botId === botId);

    if (botExistente) {
        botExistente.contagem += 1;
        botExistente.ultimoAcesso = new Date();
    } else {
        dadosRankingVitrine.push({
            botId: botId,
            nomeBot: nomeBot,
            contagem: 1,
            ultimoAcesso: new Date()
        });
    }
    
    console.log('[RANKING] Dados de ranking atualizados:', dadosRankingVitrine);
    res.status(201).json({ message: `Acesso ao bot ${nomeBot} registrado para ranking.` });
});

app.get('/api/ranking/visualizar', (req, res) => {
    const rankingOrdenado = [...dadosRankingVitrine].sort((a, b) => b.contagem - a.contagem);
    res.json(rankingOrdenado);
});

app.listen(port, () => {
    connectDB();
    console.log(`🚀 Servidor rodando em http://localhost:${port}`);
    console.log(`Usando modelo: ${MODEL_NAME}`);
});