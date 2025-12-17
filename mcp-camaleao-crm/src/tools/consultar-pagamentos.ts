// ═══════════════════════════════════════════════════════════════
// TOOL: CONSULTAR PAGAMENTOS
// ═══════════════════════════════════════════════════════════════

import type { GraphQLClient } from '../lib/graphql-client.js';

interface PaymentsPendenciesResponse {
  paymentsPendencies: {
    total: number;
  }[];
}

export async function consultarPagamentos(
  client: GraphQLClient
): Promise<{
  total_pago: number;
  total_a_receber: number;
  mensagem: string;
}> {
  await client.ensureAuthenticated();

  console.log('[PAGAMENTOS] Consultando pendências...');

  const query = `
    query {
      paymentsPendencies {
        total
      }
    }
  `;

  const response = await client.request<PaymentsPendenciesResponse>(query);
  const pendencies = response.paymentsPendencies;

  // Assumindo que pendências retornam array com total de cada pedido
  const totalGeral = pendencies.reduce((sum, p) => sum + (p.total || 0), 0);

  console.log(`[PAGAMENTOS] Total de pendências: R$ ${totalGeral}`);

  const mensagem = `💰 Pendências de Pagamento\n\n` +
    `Total de pendências: R$ ${totalGeral.toFixed(2).replace('.', ',')}\n` +
    `Quantidade de pedidos: ${pendencies.length}`;

  return {
    total_pago: 0, // API não retorna total_paid separado
    total_a_receber: totalGeral,
    mensagem,
  };
}
