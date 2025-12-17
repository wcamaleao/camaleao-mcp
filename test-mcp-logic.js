
const https = require('https');

// MOCK CLIENT
class MockGraphQLClient {
  constructor(url, email, password) {
    this.url = url;
    this.email = email;
    this.password = password;
    this.cookies = '';
  }

  async ensureAuthenticated() {
    console.log('[MOCK] Authenticating...');
    const query = `mutation { login(email: "${this.email}", password: "${this.password}", remember: false) { id } }`;
    await this.request(query);
    console.log('[MOCK] Authenticated.');
  }

  request(query) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({ query });
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...(this.cookies && { 'Cookie': this.cookies })
        }
      };

      const req = https.request(this.url, options, (res) => {
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

// HELPERS
function hojeSP() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function normalizaData(raw) {
  const s = String(raw || '').trim();
  if (!s || ['hoje','hj'].includes(s.toLowerCase())) return hojeSP();
  return s; // Simplified for test
}

function isoParaBR(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatarDinheiro(val) {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function obterNomeVia(id) {
    const map = {
        '4': 'Dinheiro',
        '6': 'Cora (PIX)',
        '8': 'Mercado Pago'
    };
    return map[id] || `Via ${id}`;
}

// TOOL LOGIC (COPIED FROM espelho-bancario.ts)
const TIMEOUT_MS = 45000;
const MAX_PAGINAS = 20;

async function espelhoBancario(client, args) {
  await client.ensureAuthenticated();

  let dataInicio = normalizaData(args.data);
  let dataFim = dataInicio;
  let periodoLabel = isoParaBR(dataInicio);

  console.log(`[ESPELHO] Período: ${periodoLabel} (${dataInicio} a ${dataFim})`);

  let allEntries = [];
  let currentPage = 1;
  let totalPages = 1;
  const perPage = 100;

  console.log('[ESPELHO] Buscando dados...');

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
    console.log(`[ESPELHO] Pág ${currentPage}/${totalPages} - ${data.length} reg`);

    allEntries = allEntries.concat(data);

    if (data.length === 0) break;

    // OTIMIZAÇÃO: Parar se encontrarmos datas anteriores ao inicio do periodo
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

  console.log(`[ESPELHO] Total carregado: ${allEntries.length}`);

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

  console.log(`[ESPELHO] Filtrados: ${filtered.length}`);

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

  // Formatar mensagem (Foco no detalhamento por via)
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

// RUN TEST
(async () => {
    const client = new MockGraphQLClient(
        'https://web-api.camaleaocamisas.com.br/graphql-api',
        'api-gerente@email.com',
        'PPTDYBYqcmE7wg'
    );
    
    // Test for 16/12/2025 (same as debug script)
    const result = await espelhoBancario(client, { data: '2025-12-16' });
    console.log('\nRESULTADO FINAL:');
    console.log(JSON.stringify(result, null, 2));
})();
