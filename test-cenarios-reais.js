
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

// ----------------------------------------------------------------------------
// PARSER DE PERÍODOS (Cópia do date-parser.ts atualizado)
// ----------------------------------------------------------------------------

// Algoritmo de Levenshtein para calcular distância entre strings
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          Math.min(
            matrix[i][j - 1] + 1,   // inserção
            matrix[i - 1][j] + 1    // remoção
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Verifica se a palavra alvo está contida no input com tolerância a erros
function fuzzyMatch(input, target, maxDistance = 1) {
  const words = input.split(/\s+/);
  // Verifica se alguma palavra do input é próxima o suficiente do target
  return words.some(word => {
    // Se for muito curta, exige exatidão
    if (target.length <= 3) return word === target;
    return levenshtein(word, target) <= maxDistance;
  });
}

function parsePeriodo(input) {
    const hoje = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    const s = (input || '').toLowerCase().trim();

    const formatISO = (d) => {
        const ano = d.getFullYear();
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const dia = String(d.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    };

    const subDias = (d, n) => {
        const nova = new Date(d);
        nova.setDate(nova.getDate() - n);
        return nova;
    };

    // ═══════════════════════════════════════════════════════════════
    // 1. COMANDOS ESTRUTURADOS (PRIORIDADE MÁXIMA)
    // ═══════════════════════════════════════════════════════════════
    
    if (s === 'hoje' || s === 'today') {
        return { data_inicio: formatISO(hoje), data_fim: formatISO(hoje), label: 'hoje' };
    }

    if (s === 'ontem' || s === 'yesterday') {
        const ontem = subDias(hoje, 1);
        return { data_inicio: formatISO(ontem), data_fim: formatISO(ontem), label: 'ontem' };
    }

    if (s === 'anteontem') {
        const anteontem = subDias(hoje, 2);
        return { data_inicio: formatISO(anteontem), data_fim: formatISO(anteontem), label: 'anteontem' };
    }

    if (s === 'semana_atual' || s === 'esta_semana') {
        const diaSemana = hoje.getDay();
        const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
        const segunda = subDias(hoje, diasDesdeSegunda);
        return { data_inicio: formatISO(segunda), data_fim: formatISO(hoje), label: 'esta semana' };
    }

    if (s === 'semana_passada') {
        const diaSemana = hoje.getDay();
        const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
        const segundaPassada = subDias(hoje, diasDesdeSegunda + 7);
        const domingoPassado = subDias(hoje, diasDesdeSegunda + 1);
        return { data_inicio: formatISO(segundaPassada), data_fim: formatISO(domingoPassado), label: 'semana passada' };
    }

    if (s === 'mes_atual') {
        const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        return { data_inicio: formatISO(primeiroDia), data_fim: formatISO(hoje), label: 'este mês' };
    }

    if (s === 'mes_passado') {
        const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
        return { data_inicio: formatISO(primeiroDia), data_fim: formatISO(ultimoDia), label: 'mês passado' };
    }

    // COMANDOS DINÂMICOS DE DIAS DA SEMANA (Ex: SEGUNDA_PASSADA, SEXTA_PASSADA)
    const matchDiaPassado = s.match(/^(domingo|segunda|terca|quarta|quinta|sexta|sabado)_passad[oa]$/);
    if (matchDiaPassado) {
        const mapDias = {
        'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3, 
        'quinta': 4, 'sexta': 5, 'sabado': 6
        };
        const nomeDia = matchDiaPassado[1];
        const targetDia = mapDias[nomeDia];
        
        const hojeDia = hoje.getDay();
        let diasParaSubtrair = (hojeDia - targetDia + 7) % 7;
        if (diasParaSubtrair === 0) diasParaSubtrair = 7;
        
        const dataAlvo = subDias(hoje, diasParaSubtrair);
        return {
        data_inicio: formatISO(dataAlvo),
        data_fim: formatISO(dataAlvo),
        label: `${nomeDia} passada`
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. PARSER DE LINGUAGEM NATURAL (COM FUZZY MATCH)
    // ═══════════════════════════════════════════════════════════════

    // "hoje" (fuzzy)
    if (fuzzyMatch(s, 'hoje', 1) || s === 'hj') {
        return { data_inicio: formatISO(hoje), data_fim: formatISO(hoje), label: 'hoje' };
    }

    // "anteontem" (fuzzy)
    if (fuzzyMatch(s, 'anteontem', 2) || s.includes('ante ontem')) {
        const anteontem = subDias(hoje, 2);
        return { data_inicio: formatISO(anteontem), data_fim: formatISO(anteontem), label: 'anteontem' };
    }

    // "ontem" (fuzzy)
    if (fuzzyMatch(s, 'ontem', 1)) {
        const ontem = subDias(hoje, 1);
        return { data_inicio: formatISO(ontem), data_fim: formatISO(ontem), label: 'ontem' };
    }

    // "Dia da semana passado" (ex: sexta passada)
    const diasSemana = [
        { nome: 'domingo', id: 0 },
        { nome: 'segunda', id: 1 },
        { nome: 'terça', id: 2 },
        { nome: 'quarta', id: 3 },
        { nome: 'quinta', id: 4 },
        { nome: 'sexta', id: 5 },
        { nome: 'sábado', id: 6 },
    ];

    const isPassado = s.includes('passada') || s.includes('passado') || s.includes('anterior') ||
                      fuzzyMatch(s, 'passada', 2) || fuzzyMatch(s, 'passado', 2);

    for (const dia of diasSemana) {
        // Aceita até 2 erros de digitação para dias da semana (ex: "sesta", "terca")
        if (fuzzyMatch(s, dia.nome, 2) && isPassado) {
            const hojeDia = hoje.getDay();
            const targetDia = dia.id;
            let diasParaSubtrair = (hojeDia - targetDia + 7) % 7;
            if (diasParaSubtrair === 0) diasParaSubtrair = 7;
            
            const dataAlvo = subDias(hoje, diasParaSubtrair);
            return {
                data_inicio: formatISO(dataAlvo),
                data_fim: formatISO(dataAlvo),
                label: `${dia.nome} passada`,
            };
        }
    }

    return null;
}

function normalizaData(raw) { 
    const s = String(raw || '').trim();
    
    // Tenta usar o parser inteligente primeiro
    const parsed = parsePeriodo(s);
    if (parsed) return parsed.data_inicio;

    if (!s || ['hoje','hj'].includes(s.toLowerCase())) return hojeSP();
    
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    
    // DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [dd, mm, yyyy] = s.split('/');
        return `${yyyy}-${mm}-${dd}`;
    }

    // DD-MM (Assume ano atual)
    if (/^\d{2}-\d{2}$/.test(s)) {
        const [dd, mm] = s.split('-');
        const ano = new Date().getFullYear();
        return `${ano}-${mm}-${dd}`;
    }

    // Se chegou aqui, a data é inválida. NÃO retorne hoje.
    throw new Error(`Data inválida: "${raw}"`);
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

  // Tenta detectar período natural primeiro (igual à tool real)
  const periodoDetectado = parsePeriodo(args.periodo || args.data || '');

  if (periodoDetectado) {
      dataInicio = periodoDetectado.data_inicio;
      dataFim = periodoDetectado.data_fim;
      periodoLabel = periodoDetectado.label;
  } else if (args.data_inicio && args.data_fim) {
      dataInicio = args.data_inicio;
      dataFim = args.data_fim;
      periodoLabel = `${isoParaBR(dataInicio)} a ${isoParaBR(dataFim)}`;
  } else if (args.data) {
      try {
        dataInicio = normalizaData(args.data);
        dataFim = dataInicio;
        periodoLabel = isoParaBR(dataInicio);
      } catch (e) {
        // Se falhar ao normalizar data explícita, cai no erro abaixo
      }
  } 
  
  // Se não conseguiu determinar dataInicio até aqui, é erro
  if (!dataInicio) {
      return {
        data_inicio: '',
        data_fim: '',
        periodo_label: 'erro',
        mensagem: `⚠️ Não entendi o período "${args.periodo || args.data}".\n\nTente usar:\n- "hoje", "ontem", "anteontem"\n- "semana passada", "esta semana"\n- "mês passado", "este mês"\n- Ou uma data: "15/12/2025"`,
        total_recebido: 0,
        total_pago: 0,
        saldo_periodo: 0,
        recebimentos_por_via: [],
        extrato: []
      };
  }
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

// HELPERS DE DATA PARA TESTE (Fuso Horário SP Garantido)
function getHojeSP_Date() {
    return new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
}

function getOntem() {
    const d = getHojeSP_Date();
    d.setDate(d.getDate() - 1);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}

function getInicioSemana() {
    const d = getHojeSP_Date();
    const day = d.getDay(); // 0 (Dom) a 6 (Sab)
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para Segunda-feira
    const monday = new Date(d);
    monday.setDate(diff);
    
    const ano = monday.getFullYear();
    const mes = String(monday.getMonth() + 1).padStart(2, '0');
    const dia = String(monday.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
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

  // --------------------------------------------------------------------------
  // CENÁRIO 7: Teste de Data Incompleta ("15/12") - O BUG DO USUÁRIO
  // --------------------------------------------------------------------------
  console.log(`\n🧪 CENÁRIO 7: Teste de Data Incompleta ("15/12")`);
  console.log("   [USUÁRIO] 'e dia 15/12?' (Simulando erro da IA)");

  const resBug = await espelhoBancario(client, { data: '15/12' });

  console.log("\n   🤖 RESPOSTA DA IA:");
  console.log("   ---------------------------------------------------");
  console.log(resBug.mensagem);
  console.log("   ---------------------------------------------------");

  // --------------------------------------------------------------------------
  // CENÁRIO 8: Testes de Linguagem Natural e Typos
  // --------------------------------------------------------------------------
  console.log(`\n🧪 CENÁRIO 8: Testes de Linguagem Natural e Typos`);
  
  const testes = [
      { input: 'anteontem', desc: 'Anteontem' },
      { input: 'ante ontem', desc: 'Ante ontem (separado)' },
      { input: 'ontm', desc: 'Ontem (typo)' },
      { input: 'sexta passada', desc: 'Sexta Passada' },
      { input: 'sesta passada', desc: 'Sesta Passada (typo)' },
      { input: 'segunda passada', desc: 'Segunda Passada' },
      { input: 'naquela terca', desc: 'Naquela Terca (typo + contexto)' }
  ];

  for (const t of testes) {
      console.log(`   [USUÁRIO] '${t.desc}' (input: "${t.input}")`);
      const res = await espelhoBancario(client, { periodo: t.input });
      console.log(`   🤖 RESPOSTA: ${res.mensagem.split('\n')[0]} (Período: ${res.periodo_label})`);
      console.log(`      Data Buscada: ${res.data_inicio}`);
      console.log("   ---------------------------------------------------");
  }

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
