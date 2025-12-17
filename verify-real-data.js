
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
    console.log('[REAL] Autenticando...');
    const query = `mutation { login(email: "${EMAIL}", password: "${PASSWORD}", remember: false) { id } }`;
    await this.request(query);
    console.log('[REAL] Autenticado com sucesso.');
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
// 2. LÓGICA DA TOOL (A mesma que vai para o MCP)
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

  let dataInicio = normalizaData(args.data);
  let dataFim = dataInicio;
  let periodoLabel = isoParaBR(dataInicio);

  console.log(`[ESPELHO] Buscando dados para: ${periodoLabel} (${dataInicio})`);

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
            id
            description
            value
            date
            via_id
          }
          paginatorInfo {
            currentPage
            lastPage
            total
          }
        }
      }
    `;

    const result = await client.request(query);
    const data = result.entriesBankMirror.data;
    const paginator = result.entriesBankMirror.paginatorInfo;
    totalPages = paginator.lastPage;

    console.log(`[ESPELHO] Pág ${currentPage}/${totalPages} - ${data.length} registros`);

    allEntries = allEntries.concat(data);
    if (data.length === 0) break;

    // OTIMIZAÇÃO: Parar se encontrarmos datas anteriores
    const lastEntry = data[data.length - 1];
    if (lastEntry && lastEntry.date) {
      const lastDate = lastEntry.date.split(' ')[0];
      if (lastDate < dataInicio) {
        console.log(`[ESPELHO] Data limite atingida (${lastDate} < ${dataInicio}). Parando busca.`);
        break;
      }
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

  console.log(`[ESPELHO] Total filtrado para o dia: ${filtered.length}`);

  if (filtered.length === 0) {
    return { mensagem: `Não houve recebimentos em ${periodoLabel}.` };
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

  // Preparar extrato simplificado
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
// 3. EXECUÇÃO
// ============================================================================
(async () => {
    try {
        const client = new RealGraphQLClient();
        const resultado = await espelhoBancario(client, { data: 'hoje' });
        
        console.log('\n═══════════════════════════════════════════════════════');
        console.log('RESULTADO REAL (API) - DETALHADO');
        console.log('═══════════════════════════════════════════════════════');
        console.log(resultado.mensagem);
        console.log('\n📋 EXTRATO DE TRANSAÇÕES:');
        console.log('───────────────────────────────────────────────────────');
        resultado.extrato.forEach(t => {
            const valorFmt = t.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const seta = t.tipo === 'ENTRADA' ? '🟢' : '🔴';
            console.log(`${seta} ${t.data.split(' ')[1]} | ${valorFmt.padEnd(12)} | ${t.via} | ${t.descricao}`);
        });
        console.log('═══════════════════════════════════════════════════════');
        
    } catch (error) {
        console.error('ERRO:', error);
    }
})();
