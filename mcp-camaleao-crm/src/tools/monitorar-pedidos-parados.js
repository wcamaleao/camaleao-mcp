// ═══════════════════════════════════════════════════════════════
// TOOL: MONITORAR PEDIDOS PARADOS
// ═══════════════════════════════════════════════════════════════
const DATA_CORTE = '2025-09-01';
const DIAS_LIMITE = 2;
export async function monitorarPedidosParados(client) {
    await client.ensureAuthenticated();
    console.log('[MONITORAR] Buscando pedidos parados...');
    const pedidosParados = [];
    const hoje = new Date();
    // Buscar pedidos em páginas
    for (let page = 1; page <= 100; page++) {
        const query = `
      query {
        orders(first: 100, page: ${page}) {
          data {
            id
            code
            created_at
            updated_at
            closed_at
            status { id text }
            client { name }
            price
          }
        }
      }
    `;
        const response = await client.request(query);
        if (!response.orders || response.orders.data.length === 0) {
            break;
        }
        const pedidos = response.orders.data;
        // Filtrar pedidos parados
        const filtrados = pedidos.filter((p) => {
            // Status 5 = "Costurado e Embalado"
            if (p.status.id !== '5')
                return false;
            // Pedido não pode estar fechado
            if (p.closed_at !== null)
                return false;
            // Apenas pedidos após data de corte
            if (p.created_at < DATA_CORTE)
                return false;
            // Calcular dias parado
            const updatedAt = new Date(p.updated_at);
            const diasParado = Math.floor((hoje.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
            if (diasParado <= DIAS_LIMITE)
                return false;
            p.dias_parado = diasParado;
            return true;
        });
        pedidosParados.push(...filtrados);
    }
    console.log(`[MONITORAR] Encontrados ${pedidosParados.length} pedidos parados`);
    // Ordenar por dias parado (mais crítico primeiro)
    pedidosParados.sort((a, b) => b.dias_parado - a.dias_parado);
    const criticos = pedidosParados.filter((p) => p.dias_parado > 7).length;
    // Retornar no máximo 20 pedidos
    const pedidosFormatados = pedidosParados.slice(0, 20).map((p) => ({
        codigo: p.code,
        cliente: p.client.name,
        dias_parado: p.dias_parado,
        valor: p.price,
        criado_em: p.created_at,
        severidade: p.dias_parado > 7 ? 'CRÍTICO' : 'ALTO',
    }));
    let mensagem = `📊 Monitoramento de Pedidos Parados\n\n`;
    mensagem += `Total de pedidos parados: ${pedidosParados.length}\n`;
    mensagem += `🚨 Pedidos críticos (>7 dias): ${criticos}\n\n`;
    if (pedidosFormatados.length > 0) {
        mensagem += `Top ${pedidosFormatados.length} pedidos:\n`;
        pedidosFormatados.forEach((p, i) => {
            const emoji = p.severidade === 'CRÍTICO' ? '🔴' : '🟡';
            mensagem += `${emoji} ${i + 1}. ${p.codigo} - ${p.cliente}\n`;
            mensagem += `   ${p.dias_parado} dias parado | R$ ${p.valor.toFixed(2)}\n`;
        });
    }
    else {
        mensagem += `✅ Nenhum pedido parado no momento!`;
    }
    return {
        total: pedidosParados.length,
        criticos,
        pedidos: pedidosFormatados,
        mensagem,
    };
}
//# sourceMappingURL=monitorar-pedidos-parados.js.map