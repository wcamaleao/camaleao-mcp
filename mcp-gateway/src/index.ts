#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════
// MCP GATEWAY - Expõe MCP Servers via REST API
// ═══════════════════════════════════════════════════════════════

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3100;

// Middlewares
app.use(cors());
app.use(express.json());

// Importar MCP Servers disponíveis
import { GraphQLClient } from '../../mcp-camaleao-crm/src/lib/graphql-client.js';
import { espelhoBancario } from '../../mcp-camaleao-crm/src/tools/espelho-bancario.js';

// Configuração
const API_URL = process.env.CAMALEAO_API_URL || 'https://web-api.camaleaocamisas.com.br/graphql-api';
const EMAIL = process.env.CAMALEAO_EMAIL || 'api-gerente@email.com';
const PASSWORD = process.env.CAMALEAO_PASSWORD || 'PPTDYBYqcmE7wg';

// Cliente GraphQL global
const crmClient = new GraphQLClient(API_URL, EMAIL, PASSWORD);

// ═══════════════════════════════════════════════════════════════
// INTERFACE WEB - Dashboard
// ═══════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🦎 Camaleão MCP Gateway</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      background: white;
      padding: 30px;
      border-radius: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 2.5rem;
      color: #333;
      margin-bottom: 10px;
    }
    .header p {
      color: #666;
      font-size: 1.1rem;
    }
    .status {
      display: inline-block;
      padding: 5px 15px;
      background: #10b981;
      color: white;
      border-radius: 20px;
      font-size: 0.9rem;
      margin-top: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: white;
      padding: 25px;
      border-radius: 15px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
    }
    .card h2 {
      font-size: 1.3rem;
      color: #333;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      background: #3b82f6;
      color: white;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: bold;
    }
    .badge.ready { background: #10b981; }
    .badge.todo { background: #f59e0b; }
    .tool-list {
      list-style: none;
      margin-top: 15px;
    }
    .tool-list li {
      padding: 10px;
      background: #f3f4f6;
      margin-bottom: 8px;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .tool-name {
      font-weight: 500;
      color: #333;
    }
    .tool-desc {
      font-size: 0.85rem;
      color: #666;
      margin-top: 3px;
    }
    .api-docs {
      background: #1f2937;
      color: white;
      padding: 25px;
      border-radius: 15px;
      margin-top: 30px;
    }
    .api-docs h2 {
      color: white;
      margin-bottom: 20px;
    }
    .endpoint {
      background: #374151;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 15px;
    }
    .method {
      display: inline-block;
      padding: 4px 10px;
      background: #10b981;
      color: white;
      border-radius: 5px;
      font-size: 0.8rem;
      font-weight: bold;
      margin-right: 10px;
    }
    .method.get { background: #3b82f6; }
    .method.post { background: #10b981; }
    code {
      background: #1f2937;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
    }
    pre {
      background: #1f2937;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      margin-top: 10px;
    }
    .footer {
      text-align: center;
      color: white;
      margin-top: 30px;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🦎 Camaleão MCP Gateway</h1>
      <p>Gateway HTTP para MCP Servers - Expõe funcionalidades via REST API</p>
      <span class="status">🟢 Online</span>
    </div>

    <div class="grid">
      <!-- MCP CRM -->
      <div class="card">
        <h2>
          📊 MCP Camaleão CRM
          <span class="badge ready">PRONTO</span>
        </h2>
        <p style="color: #666; margin-bottom: 15px;">Integração com API GraphQL do CRM</p>
        <ul class="tool-list">
          <li>
            <div>
              <div class="tool-name">espelho_bancario</div>
              <div class="tool-desc">Recebimentos PIX/cartão/dinheiro com períodos naturais</div>
            </div>
            <span class="badge ready">✓</span>
          </li>
          <li>
            <div>
              <div class="tool-name">consultar_pedidos</div>
              <div class="tool-desc">Busca pedidos por período e filtros</div>
            </div>
            <span class="badge todo">TODO</span>
          </li>
          <li>
            <div>
              <div class="tool-name">monitorar_pedidos_parados</div>
              <div class="tool-desc">Detecta gargalos de produção</div>
            </div>
            <span class="badge todo">TODO</span>
          </li>
          <li>
            <div>
              <div class="tool-name">consultar_pagamentos</div>
              <div class="tool-desc">Pendências de pagamento</div>
            </div>
            <span class="badge todo">TODO</span>
          </li>
        </ul>
      </div>

      <!-- MCP WhatsApp -->
      <div class="card">
        <h2>
          💬 MCP Camaleão WhatsApp
          <span class="badge todo">PLANEJADO</span>
        </h2>
        <p style="color: #666; margin-bottom: 15px;">Integração com Evolution API</p>
        <ul class="tool-list">
          <li>
            <div>
              <div class="tool-name">enviar_mensagem</div>
              <div class="tool-desc">Enviar mensagem para cliente</div>
            </div>
            <span class="badge todo">TODO</span>
          </li>
          <li>
            <div>
              <div class="tool-name">consultar_historico</div>
              <div class="tool-desc">Histórico de conversas</div>
            </div>
            <span class="badge todo">TODO</span>
          </li>
          <li>
            <div>
              <div class="tool-name">status_conexao</div>
              <div class="tool-desc">Status da instância WhatsApp</div>
            </div>
            <span class="badge todo">TODO</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- API Documentation -->
    <div class="api-docs">
      <h2>📚 Documentação da API</h2>

      <div class="endpoint">
        <span class="method get">GET</span>
        <code>/health</code>
        <p style="margin-top: 10px; color: #d1d5db;">Verifica se o gateway está online</p>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <code>/mcp/list</code>
        <p style="margin-top: 10px; color: #d1d5db;">Lista todos os MCP servers e tools disponíveis</p>
      </div>

      <div class="endpoint">
        <span class="method post">POST</span>
        <code>/mcp/crm/espelho_bancario</code>
        <p style="margin-top: 10px; color: #d1d5db;">Executa a tool espelho_bancario</p>
        <pre>{
  "data": "hoje"
  // ou
  "periodo": "novembro"
  // ou
  "data_inicio": "2025-12-01",
  "data_fim": "2025-12-15"
}</pre>
      </div>

      <div class="endpoint">
        <span class="method post">POST</span>
        <code>/mcp/{server}/{tool}</code>
        <p style="margin-top: 10px; color: #d1d5db;">Executa qualquer tool de qualquer MCP server</p>
        <pre>{
  "arguments": {
    // parâmetros da tool
  }
}</pre>
      </div>
    </div>

    <div class="footer">
      <p>Camaleão MCP Gateway v1.0.0 | Porta ${PORT}</p>
      <p style="margin-top: 5px; opacity: 0.8;">Desenvolvido com TypeScript + Express</p>
    </div>
  </div>
</body>
</html>
  `);
});

// ═══════════════════════════════════════════════════════════════
// ENDPOINTS DA API
// ═══════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

// Listar todos os MCPs e tools
app.get('/mcp/list', (req, res) => {
  res.json({
    servers: [
      {
        name: 'camaleao-crm',
        description: 'Integração com API GraphQL do CRM',
        status: 'ready',
        tools: [
          {
            name: 'espelho_bancario',
            description: 'Consulta recebimentos PIX/cartão/dinheiro',
            status: 'ready',
            endpoint: '/mcp/crm/espelho_bancario',
          },
          {
            name: 'consultar_pedidos',
            description: 'Busca pedidos por período',
            status: 'todo',
            endpoint: '/mcp/crm/consultar_pedidos',
          },
          {
            name: 'monitorar_pedidos_parados',
            description: 'Detecta gargalos de produção',
            status: 'todo',
            endpoint: '/mcp/crm/monitorar_pedidos_parados',
          },
          {
            name: 'consultar_pagamentos',
            description: 'Pendências de pagamento',
            status: 'todo',
            endpoint: '/mcp/crm/consultar_pagamentos',
          },
        ],
      },
      {
        name: 'camaleao-wpp',
        description: 'Integração com Evolution API',
        status: 'planned',
        tools: [
          {
            name: 'enviar_mensagem',
            description: 'Enviar mensagem para cliente',
            status: 'todo',
            endpoint: '/mcp/wpp/enviar_mensagem',
          },
          {
            name: 'consultar_historico',
            description: 'Histórico de conversas',
            status: 'todo',
            endpoint: '/mcp/wpp/consultar_historico',
          },
        ],
      },
    ],
  });
});

// Executar tool do CRM: espelho_bancario
app.post('/mcp/crm/espelho_bancario', async (req, res) => {
  try {
    const args = req.body;
    console.log('[GATEWAY] Executando espelho_bancario:', args);

    const result = await espelhoBancario(crmClient, args);

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[GATEWAY] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Endpoint genérico para outras tools (TODO)
app.post('/mcp/:server/:tool', async (req, res) => {
  const { server, tool } = req.params;

  res.status(501).json({
    success: false,
    error: `Tool "${tool}" do server "${server}" ainda não implementada`,
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🦎 CAMALEÃO MCP GATEWAY');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log(`🚀 Servidor rodando em: http://0.0.0.0:${PORT}`);
  console.log(`📊 Dashboard:          http://0.0.0.0:${PORT}`);
  console.log(`🔍 Health check:       http://0.0.0.0:${PORT}/health`);
  console.log(`📚 List MCPs:          http://0.0.0.0:${PORT}/mcp/list`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
});
