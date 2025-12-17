// ═══════════════════════════════════════════════════════════════
// TOOL: CONSULTAR PAGAMENTOS
// ═══════════════════════════════════════════════════════════════
export async function consultarPagamentos(client) {
    await client.ensureAuthenticated();
    console.log('[PAGAMENTOS] Consultando pendências...');
    const query = `
    query {
      paymentsPendencies {
        total_paid
        total_unpaid
      }
    }
  `;
    const response = await client.request(query);
    const data = response.paymentsPendencies;
    console.log(`[PAGAMENTOS] Pago: R$ ${data.total_paid} | A receber: R$ ${data.total_unpaid}`);
    const mensagem = `💰 Pendências de Pagamento\n\n` +
        `Total já pago: R$ ${data.total_paid.toFixed(2).replace('.', ',')}\n` +
        `Total a receber: R$ ${data.total_unpaid.toFixed(2).replace('.', ',')}`;
    return {
        total_pago: data.total_paid,
        total_a_receber: data.total_unpaid,
        mensagem,
    };
}
//# sourceMappingURL=consultar-pagamentos.js.map