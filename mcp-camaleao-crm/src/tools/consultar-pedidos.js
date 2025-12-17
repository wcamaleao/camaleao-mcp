// ═══════════════════════════════════════════════════════════════
// TOOL: CONSULTAR PEDIDOS
// ═══════════════════════════════════════════════════════════════
import { normalizaData, hojeSP, isoParaBR } from '../lib/date-parser.js';
export async function consultarPedidos(client, args) {
    await client.ensureAuthenticated();
    // Normalizar datas
    const dataInicio = args.data_inicio ? normalizaData(args.data_inicio) : hojeSP();
    const dataFim = args.data_fim ? normalizaData(args.data_fim) : dataInicio;
    console.log(`[CONSULTAR PEDIDOS] Período: ${dataInicio} a ${dataFim}`);
    const allOrders = [];
    // Buscar pedidos em páginas
    for (let page = 1; page <= 100; page++) {
        const query = `
      query {
        orders(first: 100, page: ${page}) {
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
        const response = await client.request(query);
        if (!response.orders || response.orders.data.length === 0) {
            break;
        }
        allOrders.push(...response.orders.data);
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
    const pedidosFormatados = filtered.slice(0, 15).map((o) => ({
        codigo: o.code,
        cliente: o.client?.name || 'Sem nome',
        valor: o.price,
        pago: o.total_paid,
        devendo: o.total_owing,
    }));
    const periodoLabel = dataInicio === dataFim ? isoParaBR(dataInicio) : `${isoParaBR(dataInicio)} a ${isoParaBR(dataFim)}`;
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
//# sourceMappingURL=consultar-pedidos.js.map