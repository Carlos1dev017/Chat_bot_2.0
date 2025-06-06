# Musashi Miyamoto - O Bot Samurai

"Saudações, viajante. Eu sou Musashi Miyamoto — um bot forjado no espírito do lendário guerreiro samurai. Se procuras os grandes ensinamentos do Caminho da Estratégia, basta falar comigo. Com a lâmina da sabedoria e o escudo da honra, guiarei tua mente e teu espírito pelos caminhos dos Samurais, até que alcances a verdadeira maestria no Caminho da Espada"

Para usar o bot:

## Pré-requisitos:

*   Node.js (versão recomendada: 18.x ou superior)
*   npm (geralmente vem com o Node.js)
*   Uma API Key válida da API Gemini (Google Generative AI). Você pode obter uma no [Google AI Studio](https://aistudio.google.com/app/apikey).
*   **(Opcional, para função de clima)** Uma API Key do [OpenWeatherMap](https://openweathermap.org/api).

## Instalação:

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/Carlos1dev017/Chat-bot.git
    cd Chat-bot-main
    ```

2.  **Instale as dependências:**
    Este comando lerá o arquivo `package.json` e instalará todos os pacotes necessários (como Express, Dotenv, Axios e a biblioteca da API Gemini).
    ```bash
    npm install
    ```

3.  **Configure suas chaves de API:**
    *   Crie um arquivo chamado `.env` na raiz do diretório do projeto.
    *   Adicione as seguintes linhas ao arquivo `.env`, substituindo pelos seus valores reais:
        ```env
        # Chave obrigatória para o funcionamento do bot
        GEMINI_API_KEY="SUA_CHAVE_GEMINI_AQUI"
        
        # Chave necessária para a função de previsão do tempo
        OPENWEATHER_API_KEY="SUA_CHAVE_OPENWEATHERMAP_AQUI"
        ```

4.  **Inicie o servidor:**
    ```bash
    node server.js
    ```
    Você deverá ver uma mensagem no console indicando que o servidor está rodando, geralmente em `http://localhost:3000`.

5.  **Acesse o Chatbot:**
    Abra seu navegador e vá para `http://localhost:3000`.

## Recursos do Bot

### Interação com o Mundo Real com "Function Calling"

Este chatbot utiliza um recurso avançado da API Gemini chamado **Function Calling** (ou "Uso de Ferramentas") para interagir com sistemas externos e fornecer informações em tempo real.

**O que é Function Calling?**

É a capacidade do modelo de linguagem (LLM), como o Gemini, de pausar sua resposta, solicitar a execução de uma função específica no nosso servidor (backend) e usar o resultado dessa função para construir uma resposta final mais precisa e rica em informações.

O fluxo geral é o seguinte:

1.  **Definição das Ferramentas:** No código do backend, definimos as "ferramentas" que o bot pode usar, descrevendo o que cada uma faz (ex: "Obtém a previsão do tempo").
2.  **Interação do Usuário:** O usuário faz uma pergunta que requer uma ferramenta (ex: "Musashi, como está o tempo em Kyoto?").
3.  **Detecção pelo Gemini:** A API Gemini entende que precisa de informações externas e solicita a execução da ferramenta `getWeather` com o argumento `location: "Kyoto"`.
4.  **Execução no Backend:** Nosso servidor recebe essa solicitação, executa a função `getWeather` real (que chama a API do OpenWeatherMap) e obtém os dados do clima.
5.  **Envio do Resultado de Volta:** O backend envia os dados do clima (temperatura, descrição) de volta para a API Gemini.
6.  **Formulação da Resposta Final:** A API Gemini recebe os dados e os utiliza para formular uma resposta final em linguagem natural, no estilo da persona Musashi Miyamoto.

### Ferramentas Disponíveis

O bot possui as seguintes ferramentas à sua disposição:

#### 1. `getCurrentTime`
Fornece a data e a hora atuais.

*   **Como Acionar?**
    *   "Que horas são?"
    *   "Qual a data de hoje?"
    *   "Poderia me dizer a data e hora, por favor?"
*   **Exemplo de Resposta:**
    > "Pequeno gafanhoto, os ventos do tempo sussurram que agora são 10:30 do dia 01/01/2024."

#### 2. `getWeather`
Consulta a previsão do tempo para uma cidade específica usando a API do OpenWeatherMap.

*   **Como Acionar?**
    *   "Qual o tempo em Curitiba?"
    *   "Como está a temperatura em Tóquio?"
    *   "Qual a previsão do tempo para Londres?"
*   **Exemplo de Resposta:**
    > "Os céus sobre Kyoto mostram 15 graus, sob um véu de nuvens dispersas. A natureza segue seu curso."

### Configuração Técnica (para Desenvolvedores)

A funcionalidade de `Function Calling` está implementada no arquivo `server.js` e envolve os seguintes componentes principais:

1.  **Declaração das Ferramentas (`tools`):** Um array contendo as definições de `getCurrentTime` e `getWeather`, incluindo suas descrições e parâmetros.
2.  **Inicialização do Modelo com as Ferramentas:** O modelo do Gemini é inicializado com a propriedade `tools`.
3.  **Implementação das Funções JavaScript:**
    *   `getCurrentTime()`: Uma função síncrona que retorna a data e hora do sistema.
    *   `getWeather(args)`: Uma função `async` que usa `axios` para chamar a API do OpenWeatherMap e retorna os dados do clima.
4.  **Mapeamento de Funções (`availableFunctions`):** Um objeto que mapeia os nomes das ferramentas (`"getCurrentTime"`) para as funções JavaScript reais (`getCurrentTime`).
5.  **Lógica na Rota `/chat` para Processar `functionCall`:**
    *   Detecta quando a API Gemini retorna uma `functionCall`.
    *   Usa `availableFunctions` e `Promise.all` para executar a(s) função(ões) correta(s), aguardando as que são assíncronas.
    *   Envia o resultado da função de volta para a API Gemini.
    *   Recebe e processa a resposta final em texto do Gemini.