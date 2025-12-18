#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════
// MCP SERVER - CAMALEÃO CRM
// ═══════════════════════════════════════════════════════════════

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { GraphQLClient } from './lib/graphql-client.js';
import { espelhoBancario } from './tools/espelho-bancario.js';
import { consultarPedidos } from './tools/consultar-pedidos.js';

// Configuração
const API_URL = 'https://web-api.camaleaocamisas.com.br/graphql-api';
const EMAIL = 'api-gerente@email.com';
const PASSWORD = 'PPTDYBYqcmE7wg';

// Cliente GraphQL global
const graphqlClient = new GraphQLClient(API_URL, EMAIL, PASSWORD);

// Criar servidor MCP
const server = new Server(
  {
    name: 'camaleao-crm',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ═══════════════════════════════════════════════════════════════
// LISTAR TOOLS DISPONÍVEIS
// ═══════════════════════════════════════════════════════════════

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'espelho_bancario',
        description:
          'Consulta recebimentos PIX, cartão e dinheiro do espelho bancário. ' +
          'SUPORTA PERÍODOS: dia único (data: "hoje"), período manual (data_inicio, data_fim), ' +
          'ou período natural (periodo: "novembro", "ultimos 15 dias", "esta semana", "ano de 2025"). ' +
          'Retorna total recebido, saldo e detalhes por via de pagamento.',
        inputSchema: {
          type: 'object',
          properties: {
            data: {
              type: 'string',
              description: 'Data única no formato YYYY-MM-DD ou "hoje"',
            },
            data_inicio: {
              type: 'string',
              description: 'Data de início do período (YYYY-MM-DD)',
            },
            data_fim: {
              type: 'string',
              description: 'Data de fim do período (YYYY-MM-DD)',
            },
            periodo: {
              type: 'string',
              description:
                'Período em linguagem natural: "novembro", "ultimos 15 dias", "esta semana", "semana passada", "este mes", etc.',
            },
          },
        },
      },
      {
        name: 'consultar_pedidos',
        description:
          'Busca pedidos por período. ' +
          'Retorna total de pedidos, valor total e lista de pedidos. ' +
          'Suporta filtros por cliente, status e data.',
        inputSchema: {
          type: 'object',
          properties: {
            data_inicio: {
              type: 'string',
              description: 'Data de início (YYYY-MM-DD)',
            },
            data_fim: {
              type: 'string',
              description: 'Data de fim (YYYY-MM-DD)',
            },
            periodo: {
              type: 'string',
              description: 'Período natural: "hoje", "esta semana", "novembro", etc.',
            },
            cliente: {
              type: 'string',
              description: 'Nome do cliente para filtrar',
            },
            status: {
              type: 'string',
              description: 'Status do pedido para filtrar',
            },
          },
        },
      },
      {
        name: 'monitorar_pedidos_parados',
        description:
          'Detecta pedidos em status "Costurado e Embalado" parados por mais de 2 dias. ' +
          'Alerta pedidos críticos (>7 dias). ' +
          'Útil para identificar gargalos de produção.',
        inputSchema: {
          type: 'object',
          properties: {
            dias_minimo: {
              type: 'number',
              description: 'Mínimo de dias parado para considerar (padrão: 2)',
              default: 2,
            },
          },
        },
      },
      {
        name: 'consultar_pagamentos',
        description:
          'Consulta pendências de pagamento totais. ' +
          'Retorna valor total pendente e lista de pagamentos em atraso.',
        inputSchema: {
          type: 'object',
          properties: {
            apenas_atrasados: {
              type: 'boolean',
              description: 'Filtrar apenas pagamentos atrasados',
              default: false,
            },
          },
        },
      },
      {
        name: 'buscar_cliente',
        description:
          'Busca informações de um cliente por nome ou ID. ' +
          'Retorna dados do cliente, pedidos recentes e saldo.',
        inputSchema: {
          type: 'object',
          properties: {
            nome: {
              type: 'string',
              description: 'Nome do cliente para buscar',
            },
            id: {
              type: 'number',
              description: 'ID do cliente',
            },
          },
        },
      },
      {
        name: 'dashboard_vendas',
        description:
          'Retorna métricas do dashboard de vendas: ' +
          'valor total, vendas por cidade, por modelo, por categoria. ' +
          'Suporta filtro por data.',
        inputSchema: {
          type: 'object',
          properties: {
            data: {
              type: 'string',
              description: 'Data para o dashboard (YYYY-MM-DD), padrão: hoje',
            },
          },
        },
      },
      {
        name: 'painel_producao',
        description:
          'Consulta o painel de produção com status de todos os pedidos. ' +
          'Mostra quantos pedidos em cada etapa da produção.',
        inputSchema: {
          type: 'object',
          properties: {
            data_producao: {
              type: 'string',
              description: 'Data de produção (YYYY-MM-DD)',
            },
          },
        },
      },
    ],
  };
});

// ═══════════════════════════════════════════════════════════════
// EXECUTAR TOOLS
// ═══════════════════════════════════════════════════════════════

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'espelho_bancario': {
        const result = await espelhoBancario(graphqlClient, args || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'consultar_pedidos': {
        const result = await consultarPedidos(graphqlClient, args || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'monitorar_pedidos_parados': {
        return {
          content: [
            {
              type: 'text',
              text: 'Tool "monitorar_pedidos_parados" em desenvolvimento',
            },
          ],
        };
      }

      case 'consultar_pagamentos': {
        return {
          content: [
            {
              type: 'text',
              text: 'Tool "consultar_pagamentos" em desenvolvimento',
            },
          ],
        };
      }

      case 'buscar_cliente': {
        return {
          content: [
            {
              type: 'text',
              text: 'Tool "buscar_cliente" em desenvolvimento',
            },
          ],
        };
      }

      case 'dashboard_vendas': {
        return {
          content: [
            {
              type: 'text',
              text: 'Tool "dashboard_vendas" em desenvolvimento',
            },
          ],
        };
      }

      case 'painel_producao': {
        return {
          content: [
            {
              type: 'text',
              text: 'Tool "painel_producao" em desenvolvimento',
            },
          ],
        };
      }

      default:
        throw new Error(`Tool desconhecida: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Erro ao executar tool "${name}": ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// ═══════════════════════════════════════════════════════════════
// INICIAR SERVIDOR
// ═══════════════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('🚀 MCP Server Camaleão CRM iniciado!');
  console.error('📡 Aguardando conexões...');
}

main().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});
