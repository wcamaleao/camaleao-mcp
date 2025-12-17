
const https = require('https');

// ============================================================================
// 1. CLIENTE REAL (Conecta na API da Camaleão)
// ============================================================================
const API_URL = 'https://web-api.camaleaocamisas.com.br/graphql-api';
const EMAIL = 'api-gerente@email.com';
const PASSWORD = 'PPTDYBYqcmE7wg';

class RealGraphQLClient {
  constructor() {
    this.cookies = '';
  }

  async ensureAuthenticated() {
    // console.log('[REAL] Autenticando...');
    const query = `mutation { login(email: "${EMAIL}", password: "${PASSWORD}", remember: false) { id } }`;
    await this.request(query);
    // console.log('[REAL] Autenticado.');
  }

  request(query) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({ query });
      const url = new URL(API_URL);
      
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...(this.cookies && { 'Cookie': this.cookies })
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        if (res.headers['set-cookie']) {
            const cookies = res.headers['set-cookie'];
            this.cookies = Array.isArray(cookies) ? cookies.join('; ') : cookies;
        }
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.errors) reject(new Error(json.errors[0].message));
            resolve(json.data);
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }
}

// ============================================================================
// 2. LÓGICA DA TOOL (Cópia exata da implementação final)
// ============================================================================
function hojeSP() { 
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}
function normalizaData(raw) { 
    const s = String(raw || '').trim();
    if (!s || ['hoje','hj'].includes(s.toLowerCase())) return hojeSP();
    return s;
}
function isoParaBR(iso) { return iso.split('-').reverse().join('/'); }
function formatarDinheiro(val) { return val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }); }
function obterNomeVia(id) {
    const map = { '4': 'Dinheiro', '6': 'Cora (PIX)', '8': 'Mercado Pago' };
    return map[id] || `Via ${id}`;
}

async function espelhoBancario(client, args) {
  await client.ensureAuthenticated();
  
  let dataInicio, dataFim, periodoLabel;

  if (args.data_inicio && args.data_fim) {
      dataInicio = args.data_inicio;
      dataFim = args.data_fim;
      periodoLabel = `${isoParaBR(dataInicio)} a ${isoParaBR(dataFim)}`;
  } else {
      dataInicio = normalizaData(args.data);
      dataFim = dataInicio;
      periodoLabel = isoParaBR(dataInicio);
  }

  let allEntries = [];
  let currentPage = 1;
  let totalPages = 1;
  const perPage = 100;
  const MAX_PAGINAS = 50;

  while (currentPage <= totalPages && currentPage <= MAX_PAGINAS) {
    const query = `
      query {
        entriesBankMirror(first: ${perPage}, page: ${currentPage}) {
          data {
            id description value date via_id
          }
          paginatorInfo { currentPage lastPage total }
        }
      }
    `;

    const result = await client.request(query);
    const data = result.entriesBankMirror.data;
    const paginator = result.entriesBankMirror.paginatorInfo;
    totalPages = paginator.lastPage;

    allEntries = allEntries.concat(data);
    if (data.length === 0) break;

    const lastEntry = data[data.length - 1];
    if (lastEntry && lastEntry.date) {
      const lastDate = lastEntry.date.split(' ')[0];
      if (lastDate < dataInicio) break;
    }
    currentPage++;
  }

  // DEBUG: Verificar quais vias existem nos dados brutos
  const viasEncontradas = [...new Set(allEntries.map(e => e.via_id))];
  console.log(`\n🔍 DEBUG: Vias encontradas nos dados brutos: ${viasEncontradas.join(', ')}`);
  viasEncontradas.forEach(id => {
      console.log(`   - ID ${id}: ${obterNomeVia(id)}`);
  });

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
// 3. MOCK META ADS (Simulado, pois é externo)
// ============================================================================
async function consultarMetaAds() {
  return `|||
Gasto Hoje: R$ 120,00
Conversas Iniciadas: 15
Custo por Conversa: R$ 8,00
Status: ATIVO
|||`;
}

// ============================================================================
// 4. EXECUÇÃO DOS CENÁRIOS REAIS
// ============================================================================
async function rodarCenariosReais() {
  const client = new RealGraphQLClient();
  console.log("🚀 INICIANDO TESTES COM DADOS REAIS (17/12/2025)\n");

  // --------------------------------------------------------------------------
  // CENÁRIO 1: "Quantos pagamentos cairam hoje?"
  // --------------------------------------------------------------------------
  console.log("🧪 CENÁRIO 1: Pergunta Financeira Simples");
  console.log("   [USUÁRIO] 'Quantos pagamentos cairam hoje?'");
  
  const res1 = await espelhoBancario(client, { data: 'hoje' });
  
  console.log("\n   🤖 RESPOSTA DA IA (Baseada nos dados reais):");
  console.log("   ---------------------------------------------------");
  console.log(res1.mensagem);
  console.log("   ---------------------------------------------------");

  // --------------------------------------------------------------------------
  // CENÁRIO 2: "Quantos pagamentos cairam hoje? e os anuncios?"
  // --------------------------------------------------------------------------
  console.log("\n🧪 CENÁRIO 2: Pergunta Combinada (Financeiro + Ads)");
  console.log("   [USUÁRIO] 'Quantos pagamentos cairam hoje? e os anuncios como estao?'");
  
  // Reutilizando res1 (Financeiro) + Ads
  const resAds = await consultarMetaAds();

  console.log("\n   🤖 RESPOSTA DA IA (Combinando Real + Ads):");
  console.log("   ---------------------------------------------------");
  
  const respostaCombinada = `
📊 **Resumo Financeiro de Hoje (17/12):**

${res1.mensagem.replace('📊 Recebimentos de 17/12/2025:\n\n', '')}

---

📢 **Status dos Anúncios:**
Hoje o investimento foi de **R$ 120,00**, gerando **15 conversas** novas (Custo de R$ 8,00 por conversa). A campanha segue ativa.
  `;
  console.log(respostaCombinada.trim());
  console.log("   ---------------------------------------------------");

  console.log("\n🏁 TESTES REAIS CONCLUÍDOS.");
}

// HELPERS DE DATA PARA TESTE
function getOntem() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}

function getInicioSemana() {
    const d = new Date();
    const day = d.getDay(); // 0 (Dom) a 6 (Sab)
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para Segunda-feira
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
}

async function rodarCenariosReais() {
  const client = new RealGraphQLClient();
  console.log("🚀 INICIANDO TESTES COM DADOS REAIS (17/12/2025)\n");

  // --------------------------------------------------------------------------
  // CENÁRIO 1: "Quantos pagamentos cairam hoje?"
  // --------------------------------------------------------------------------
  console.log("🧪 CENÁRIO 1: Pergunta Financeira Simples");
  console.log("   [USUÁRIO] 'Quantos pagamentos cairam hoje?'");
  
  const res1 = await espelhoBancario(client, { data: 'hoje' });
  
  console.log("\n   🤖 RESPOSTA DA IA (Baseada nos dados reais):");
  console.log("   ---------------------------------------------------");
  console.log(res1.mensagem);
  console.log("   ---------------------------------------------------");

  // --------------------------------------------------------------------------
  // CENÁRIO 2: "Quantos pagamentos cairam hoje? e os anuncios?"
  // --------------------------------------------------------------------------
  console.log("\n🧪 CENÁRIO 2: Pergunta Combinada (Financeiro + Ads)");
  console.log("   [USUÁRIO] 'Quantos pagamentos cairam hoje? e os anuncios como estao?'");
  
  // Reutilizando res1 (Financeiro) + Ads
  const resAds = await consultarMetaAds();

  console.log("\n   🤖 RESPOSTA DA IA (Combinando Real + Ads):");
  console.log("   ---------------------------------------------------");
  
  const respostaCombinada = `
📊 **Resumo Financeiro de Hoje (17/12):**

${res1.mensagem.replace('📊 Recebimentos de 17/12/2025:\n\n', '')}

---

📢 **Status dos Anúncios:**
Hoje o investimento foi de **R$ 120,00**, gerando **15 conversas** novas (Custo de R$ 8,00 por conversa). A campanha segue ativa.
  `;
  console.log(respostaCombinada.trim());
  console.log("   ---------------------------------------------------");

  // --------------------------------------------------------------------------
  // CENÁRIO 3: Pergunta Específica (Busca Dinâmica no Extrato Real)
  // --------------------------------------------------------------------------
  console.log("\n🧪 CENÁRIO 3: Pergunta Específica ('Fulano pagou?')");
  
  // Pegar um nome real do extrato para testar
  const entradaReal = res1.extrato.find(t => t.tipo === 'ENTRADA');
  
  if (entradaReal) {
      // Extrair um nome da descrição (ex: "Transferência recebida de NOME (PIX)")
      const nomeMatch = entradaReal.descricao.match(/de (.*?) \(/);
      const nomeCliente = nomeMatch ? nomeMatch[1] : "Cliente";
      
      console.log(`   [USUÁRIO] 'O ${nomeCliente} pagou?'`);
      console.log(`   [IA] Buscando '${nomeCliente}' no extrato real...`);
      
      const encontrou = res1.extrato.find(t => t.descricao.includes(nomeCliente));
      
      console.log("\n   🤖 RESPOSTA DA IA:");
      console.log("   ---------------------------------------------------");
      if (encontrou) {
          console.log(`   ✅ Sim! Consta um recebimento de ${nomeCliente}`);
          console.log(`      Valor: R$ ${formatarDinheiro(encontrou.valor)}`);
          console.log(`      Horário: ${encontrou.data.split(' ')[1]}`);
          console.log(`      Via: ${encontrou.via}`);
      } else {
          console.log("   ❌ Não encontrei.");
      }
      console.log("   ---------------------------------------------------");
  } else {
      console.log("   ⚠️ Pulei este teste pois não houve entradas hoje para usar de exemplo.");
  }

  // --------------------------------------------------------------------------
  // CENÁRIO 4: "Como foi ontem?"
  // --------------------------------------------------------------------------
  const ontem = getOntem();
  console.log(`\n🧪 CENÁRIO 4: Pergunta sobre Ontem (${isoParaBR(ontem)})`);
  console.log("   [USUÁRIO] 'Quanto entrou ontem?'");

  const resOntem = await espelhoBancario(client, { data: ontem });

  console.log("\n   🤖 RESPOSTA DA IA:");
  console.log("   ---------------------------------------------------");
  console.log(resOntem.mensagem);
  console.log("   ---------------------------------------------------");

  // --------------------------------------------------------------------------
  // CENÁRIO 5: "Resumo da Semana"
  // --------------------------------------------------------------------------
  const inicioSemana = getInicioSemana();
  const hoje = new Date().toISOString().split('T')[0];
  console.log(`\n🧪 CENÁRIO 5: Resumo da Semana (${isoParaBR(inicioSemana)} a ${isoParaBR(hoje)})`);
  console.log("   [USUÁRIO] 'Me dá o resumo da semana'");

  const resSemana = await espelhoBancario(client, { data_inicio: inicioSemana, data_fim: hoje });

  console.log("\n   🤖 RESPOSTA DA IA:");
  console.log("   ---------------------------------------------------");
  console.log(resSemana.mensagem);
  console.log("   ---------------------------------------------------");

  // --------------------------------------------------------------------------
  // CENÁRIO 6: "Resumo do Mês (Dezembro)" - Para pegar Mercado Pago
  // --------------------------------------------------------------------------
  const inicioMes = '2025-12-01';
  console.log(`\n🧪 CENÁRIO 6: Resumo do Mês (${isoParaBR(inicioMes)} a ${isoParaBR(hoje)})`);
  console.log("   [USUÁRIO] 'Como estamos esse mês?'");

  const resMes = await espelhoBancario(client, { data_inicio: inicioMes, data_fim: hoje });

  console.log("\n   🤖 RESPOSTA DA IA:");
  console.log("   ---------------------------------------------------");
  console.log(resMes.mensagem);
  console.log("   ---------------------------------------------------");

  // DEBUG DETALHADO DA SEMANA
  console.log("\n🔍 DEBUG: DETALHAMENTO DA SEMANA POR VIA");
  const porVia = {};
  resSemana.extrato.forEach(t => {
      if (!porVia[t.via]) porVia[t.via] = { entradas: 0, saidas: 0, itens: [] };
      if (t.valor > 0) porVia[t.via].entradas += t.valor;
      else porVia[t.via].saidas += t.valor;
      porVia[t.via].itens.push(t);
  });

  Object.entries(porVia).forEach(([via, dados]) => {
      console.log(`\n📂 ${via.toUpperCase()}`);
      console.log(`   Entradas: R$ ${formatarDinheiro(dados.entradas)}`);
      console.log(`   Saídas:   R$ ${formatarDinheiro(dados.saidas)}`);
      console.log(`   Saldo:    R$ ${formatarDinheiro(dados.entradas + dados.saidas)}`);
      console.log(`   Transações:`);
      dados.itens.forEach(t => {
          const seta = t.valor > 0 ? '🟢' : '🔴';
          console.log(`     ${seta} ${t.data.split(' ')[0]} | R$ ${formatarDinheiro(t.valor).padEnd(10)} | ${t.descricao.substring(0, 50)}`);
      });
  });

  console.log("\n🏁 TESTES REAIS CONCLUÍDOS.");
}

rodarCenariosReais();
