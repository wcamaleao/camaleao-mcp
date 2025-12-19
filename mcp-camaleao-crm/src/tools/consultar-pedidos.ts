// ═══════════════════════════════════════════════════════════════
// TOOL: CONSULTAR PEDIDOS
// ═══════════════════════════════════════════════════════════════

import type { GraphQLClient } from '../lib/graphql-client.js';
import { normalizaData, hojeSP, isoParaBR, parsePeriodo } from '../lib/date-parser.js';

interface Order {
  id: string;
  code: string;
  created_at: string;
  price: number;
  total_paid: number;
  total_owing: number;
  client: { name: string } | null;
}

interface OrdersResponse {
  orders: {
    data: Order[];
  };
}

interface PedidoResumo {
  codigo: string;
  cliente: string;
  valor: number;
  pago: number;
  devendo: number;
}

export async function consultarPedidos(
  client: GraphQLClient,
  args: { data_inicio?: string; data_fim?: string; periodo?: string; pergunta?: string }
): Promise<{
  periodo: string;
  total_pedidos: number;
  valor_total: number;
  total_pago: number;
  total_devendo: number;
  pedidos: PedidoResumo[];
  mensagem: string;
}> {
  await client.ensureAuthenticated();

  // Limpar strings vazias
  const periodoInput = (args.periodo || '').trim();
  const perguntaInput = (args.pergunta || '').trim();
  const dataInicioInput = (args.data_inicio || '').trim();
  const dataFimInput = (args.data_fim || '').trim();

  // Determinar período
  let dataInicio: string;
  let dataFim: string;
  let periodoLabel: string;

  // 1. Tenta parsear o 'periodo' explícito (vindo da IA)
  let periodoDetectado = periodoInput ? parsePeriodo(periodoInput) : null;

  // 2. Se falhar, tenta parsear a 'pergunta' completa (contexto)
  if (!periodoDetectado && perguntaInput) {
    periodoDetectado = parsePeriodo(perguntaInput);
  }

  if (periodoDetectado) {
    dataInicio = periodoDetectado.data_inicio;
    dataFim = periodoDetectado.data_fim;
    periodoLabel = periodoDetectado.label;
  } else if (dataInicioInput && dataFimInput) {
    dataInicio = normalizaData(dataInicioInput);
    dataFim = normalizaData(dataFimInput);
    periodoLabel = `${isoParaBR(dataInicio)} a ${isoParaBR(dataFim)}`;
  } else {
    // Se o usuário tentou passar um período mas não entendemos, ERRO
    if (periodoInput && periodoInput !== '') {
      return {
        periodo: 'erro',
        total_pedidos: 0,
        valor_total: 0,
        total_pago: 0,
        total_devendo: 0,
        pedidos: [],
        mensagem: `⚠️ Não entendi o período "${periodoInput}". Tente: hoje, ontem, semana passada, etc.`
      };
    }

    // Default: hoje
    dataInicio = hojeSP();
    dataFim = dataInicio;
    periodoLabel = 'hoje';
  }

  console.log(`[CONSULTAR PEDIDOS] Período: ${dataInicio} a ${dataFim} (${periodoLabel})`);

  const allOrders: Order[] = [];

  // Buscar pedidos em páginas
  for (let page = 1; page <= 100; page++) {
    console.log(`[CONSULTAR PEDIDOS] Buscando página ${page}...`);
    const query = `
      query {
        orders(first: 100, page: ${page}, orderBy: [{ column: CREATED_AT, order: DESC }]) {
          data {
            id
            code
            created_at
            price
            total_paid
            total_owing
            client { name }
          }
        }
      }
    `;

    const response = await client.request<OrdersResponse>(query);

    if (!response.orders || response.orders.data.length === 0) {
      break;
    }

    const pageData = response.orders.data;
    allOrders.push(...pageData);

    if (pageData.length > 0) {
      const firstDate = pageData[0].created_at;
      const lastDatePage = pageData[pageData.length - 1].created_at;
      console.log(`[CONSULTAR PEDIDOS] Pág ${page}: ${firstDate} até ${lastDatePage}`);
    }

    // OTIMIZAÇÃO: Se o último pedido da página for mais antigo que a data de início, paramos.
    // Assumindo que a API retorna do mais recente para o mais antigo (agora forçado com orderBy).
    const lastOrder = pageData[pageData.length - 1];
    if (lastOrder && lastOrder.created_at) {
      const lastDate = lastOrder.created_at.split(' ')[0];
      if (lastDate < dataInicio) {
        console.log(`[CONSULTAR PEDIDOS] Data limite atingida (${lastDate} < ${dataInicio}). Parando busca.`);
        break;
      }
    }
  }

  // Filtrar por período
  const filtered = allOrders.filter((o) => {
    const createdDate = o.created_at.split(' ')[0]; // YYYY-MM-DD HH:MM:SS -> YYYY-MM-DD
    return createdDate >= dataInicio && createdDate <= dataFim;
  });

  console.log(`[CONSULTAR PEDIDOS] Encontrados ${filtered.length} pedidos no período`);

  // Calcular totais
  const valorTotal = filtered.reduce((sum, o) => sum + (o.price || 0), 0);
  const totalPago = filtered.reduce((sum, o) => sum + (o.total_paid || 0), 0);
  const totalDevendo = filtered.reduce((sum, o) => sum + (o.total_owing || 0), 0);

  // Formatar pedidos (no máximo 15)
  const pedidosFormatados: PedidoResumo[] = filtered.slice(0, 15).map((o) => ({
    codigo: o.code,
    cliente: o.client?.name || 'Sem nome',
    valor: o.price,
    pago: o.total_paid,
    devendo: o.total_owing,
  }));

  let mensagem = `📊 Pedidos - ${periodoLabel}\n\n`;
  mensagem += `Total de pedidos: ${filtered.length}\n`;
  mensagem += `Valor total: R$ ${valorTotal.toFixed(2).replace('.', ',')}\n`;
  mensagem += `Total pago: R$ ${totalPago.toFixed(2).replace('.', ',')}\n`;
  mensagem += `Total devendo: R$ ${totalDevendo.toFixed(2).replace('.', ',')}\n`;

  if (pedidosFormatados.length > 0) {
    mensagem += `\nPrimeiros ${pedidosFormatados.length} pedidos:\n`;
    pedidosFormatados.forEach((p, i) => {
      mensagem += `${i + 1}. ${p.codigo} - ${p.cliente}\n`;
      mensagem += `   Valor: R$ ${p.valor.toFixed(2)} | Pago: R$ ${p.pago.toFixed(2)} | Devendo: R$ ${p.devendo.toFixed(2)}\n`;
    });
  }

  return {
    periodo: periodoLabel,
    total_pedidos: filtered.length,
    valor_total: valorTotal,
    total_pago: totalPago,
    total_devendo: totalDevendo,
    pedidos: pedidosFormatados,
    mensagem,
  };
}
