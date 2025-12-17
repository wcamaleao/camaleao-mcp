
const https = require('https');

// ============================================================================
// 1. MOCK DO CLIENTE GRAPHQL (Simula a API da Camaleão)
// ============================================================================
class MockGraphQLClient {
  constructor() {
    this.mockData = [];
  }

  // Alimenta o mock com dados falsos para teste
  setMockData(data) {
    this.mockData = data;
  }

  async ensureAuthenticated() { return true; }

  async request(query) {
    // Simula paginação
    const pageMatch = query.match(/page: (\d+)/);
    const page = pageMatch ? parseInt(pageMatch[1]) : 1;
    const perPage = 100;
    
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const pageData = this.mockData.slice(start, end);

    return {
      entriesBankMirror: {
        data: pageData,
        paginatorInfo: {
          currentPage: page,
          lastPage: Math.ceil(this.mockData.length / perPage) || 1,
          total: this.mockData.length
        }
      }
    };
  }
}

// ============================================================================
// 2. LÓGICA DA TOOL (Cópia exata do arquivo modificado)
// ============================================================================
function hojeSP() { return '2025-12-17'; } // Fixado para teste
function normalizaData(raw) { return raw === 'hoje' ? '2025-12-17' : raw; }
function isoParaBR(iso) { return iso.split('-').reverse().join('/'); }
function formatarDinheiro(val) { return val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }); }
function obterNomeVia(id) {
    const map = { '4': 'Dinheiro', '6': 'Cora (PIX)', '8': 'Mercado Pago' };
    return map[id] || `Via ${id}`;
}

async function espelhoBancario(client, args) {
  // ... (Lógica idêntica ao arquivo src/tools/espelho-bancario.ts)
  let dataInicio = normalizaData(args.data || 'hoje');
  let dataFim = dataInicio;
  let periodoLabel = isoParaBR(dataInicio);

  let allEntries = [];
  let currentPage = 1;
  let totalPages = 1;
  const perPage = 100;
  const MAX_PAGINAS = 50;

  while (currentPage <= totalPages && currentPage <= MAX_PAGINAS) {
    const result = await client.request(`query { entriesBankMirror(page: ${currentPage}) }`);
    const data = result.entriesBankMirror.data;
    const paginator = result.entriesBankMirror.paginatorInfo;
    totalPages = paginator.lastPage;

    allEntries = allEntries.concat(data);
    if (data.length === 0) break;

    // OTIMIZAÇÃO
    const lastEntry = data[data.length - 1];
    if (lastEntry && lastEntry.date) {
      const lastDate = lastEntry.date.split(' ')[0];
      if (lastDate < dataInicio) break;
    }
    currentPage++;
  }

  const filtered = allEntries
    .filter((e) => {
      const dataReg = e.date.split(' ')[0];
      return dataReg >= dataInicio && dataReg <= dataFim;
    })
    .map((e) => ({
      ...e,
      value: Number(e.value),
      via: obterNomeVia(e.via_id),
    }));

  if (filtered.length === 0) {
    return { mensagem: `Não houve recebimentos em ${periodoLabel}.`, extrato: [] };
  }

  const recebimentos = filtered.filter((e) => e.value > 0);
  const pagamentos = filtered.filter((e) => e.value < 0);

  const porVia = {};
  for (const e of recebimentos) {
    if (!porVia[e.via]) porVia[e.via] = [];
    porVia[e.via].push(e.value);
  }

  const resumo = Object.entries(porVia)
    .map(([via, valores]) => ({
      via,
      total: valores.reduce((s, v) => s + v, 0),
      quantidade: valores.length,
    }))
    .sort((a, b) => b.total - a.total);

  const totalRecebido = recebimentos.reduce((s, e) => s + e.value, 0);
  const totalPago = pagamentos.reduce((s, e) => s + e.value, 0);
  const saldo = totalRecebido + totalPago;

  let msg = `📊 Recebimentos de ${periodoLabel}:\n\n`;
  if (resumo.length > 0) {
    for (const item of resumo) {
      msg += `✅ ${item.via}: R$ ${formatarDinheiro(item.total)}\n`;
    }
    msg += `\n💰 TOTAL RECEBIDO: R$ ${formatarDinheiro(totalRecebido)}`;
  } else {
    msg += `Nenhum recebimento encontrado.`;
  }

  if (totalPago < 0) {
    msg += `\n\n💸 Pagamentos (Saídas): R$ ${formatarDinheiro(Math.abs(totalPago))}`;
    msg += `\n📉 Saldo Líquido (Recebido - Pago): R$ ${formatarDinheiro(saldo)}`;
  }

  const extrato = filtered.map(e => ({
    data: e.date,
    descricao: e.description,
    valor: e.value,
    via: e.via,
    tipo: e.value > 0 ? 'ENTRADA' : 'SAIDA'
  }));

  return {
    mensagem: msg,
    total_recebido: totalRecebido,
    total_pago: Math.abs(totalPago),
    saldo_periodo: saldo,
    recebimentos_por_via: resumo,
    extrato: extrato
  };
}

// ============================================================================
// 3. CENÁRIOS DE TESTE
// ============================================================================

// DADOS MOCKADOS (Mistura de entradas e saídas)
const DADOS_TESTE = [
  { id: 1, description: "Pgto Cliente A", value: 100.00, date: "2025-12-17 10:00:00", via_id: "6" }, // Cora
  { id: 2, description: "Pgto Cliente B", value: 50.00, date: "2025-12-17 10:30:00", via_id: "4" },  // Dinheiro
  { id: 3, description: "Pgto Cliente C", value: 200.00, date: "2025-12-17 11:00:00", via_id: "6" }, // Cora
  { id: 4, description: "Pagamento Luz", value: -150.00, date: "2025-12-17 12:00:00", via_id: "6" }, // Saída Cora
  { id: 5, description: "Pgto Cliente D", value: 300.00, date: "2025-12-17 14:00:00", via_id: "8" }, // Mercado Pago
  { id: 6, description: "Pgto Antigo", value: 500.00, date: "2025-12-16 10:00:00", via_id: "6" },    // Dia anterior (não deve aparecer)
];

// ============================================================================
// 4. MOCK META ADS
// ============================================================================
async function consultarMetaAds() {
  return `|||
Gasto Hoje: R$ 120,00
Conversas Iniciadas: 15
Custo por Conversa: R$ 8,00
Status: ATIVO
|||`;
}

async function rodarTestes() {
  const client = new MockGraphQLClient();
  client.setMockData(DADOS_TESTE);

  console.log("🚀 INICIANDO BATERIA DE TESTES ROBUSTOS\n");

  // ... (Cenários anteriores mantidos) ...

  // --------------------------------------------------------------------------
  // CENÁRIO 5: Pergunta Combinada ("Quantos pagamentos cairam hoje? e os anuncios?")
  // --------------------------------------------------------------------------
  console.log("\n🧪 CENÁRIO 5: Pergunta Combinada (Financeiro + Ads)");
  console.log("   [USUÁRIO] 'Quantos pagamentos cairam hoje? e os anuncios como estao?'");
  
  // 1. Chama Tool Financeira
  console.log("   [IA] Chamando tool 'espelho_bancario'...");
  const resFinanceiro = await espelhoBancario(client, { data: 'hoje' });
  
  // 2. Chama Tool Ads
  console.log("   [IA] Chamando tool 'consultar_meta_ads'...");
  const resAds = await consultarMetaAds();

  console.log("\n   📝 DADOS RECEBIDOS PELO AGENTE:");
  console.log("   --- FINANCEIRO ---");
  console.log(resFinanceiro.mensagem);
  console.log("   --- ADS ---");
  console.log(resAds);

  console.log("\n   🤖 RESPOSTA FINAL GERADA PELA IA (SIMULAÇÃO):");
  console.log("   ---------------------------------------------------");
  
  // Simulação de como a LLM montaria a resposta
  const respostaIA = `
📊 **Resumo Financeiro de Hoje (17/12):**

${resFinanceiro.mensagem.replace('📊 Recebimentos de 17/12/2025:\n\n', '')}

---

📢 **Status dos Anúncios:**
Hoje o investimento foi de **R$ 120,00**, gerando **15 conversas** novas (Custo de R$ 8,00 por conversa). A campanha segue ativa.
  `;
  
  console.log(respostaIA.trim());
  console.log("   ---------------------------------------------------");

  console.log("\n🏁 TESTES CONCLUÍDOS.");
}

rodarTestes();
