// ═══════════════════════════════════════════════════════════════
// TOOL: ESPELHO BANCÁRIO
// ═══════════════════════════════════════════════════════════════

import type { GraphQLClient } from '../lib/graphql-client.js';
import { parsePeriodo, normalizaData, hojeSP, isoParaBR } from '../lib/date-parser.js';
import { formatarDinheiro, obterNomeVia } from '../lib/formatters.js';
import type { EspelhoBancarioResult, BankMirrorEntry, PaginatorInfo, Transacao } from '../types/index.js';

const TIMEOUT_MS = 45000;
const MAX_PAGINAS = 50;

interface EntriesBankMirrorResponse {
  entriesBankMirror: {
    data: BankMirrorEntry[];
    paginatorInfo: PaginatorInfo;
  };
}

export async function espelhoBancario(
  client: GraphQLClient,
  args: { data?: string; data_inicio?: string; data_fim?: string; periodo?: string }
): Promise<EspelhoBancarioResult> {
  await client.ensureAuthenticated();

  // Determinar período
  let dataInicio: string;
  let dataFim: string;
  let periodoLabel: string;

  const periodoDetectado = parsePeriodo(
    args.periodo || args.data || ''
  );

  if (periodoDetectado) {
    dataInicio = periodoDetectado.data_inicio;
    dataFim = periodoDetectado.data_fim;
    periodoLabel = periodoDetectado.label;
  } else if (args.data_inicio && args.data_fim) {
    dataInicio = normalizaData(args.data_inicio);
    dataFim = normalizaData(args.data_fim);
    periodoLabel = `${isoParaBR(dataInicio)} a ${isoParaBR(dataFim)}`;
  } else if (args.data) {
    dataInicio = normalizaData(args.data);
    dataFim = dataInicio;
    periodoLabel = isoParaBR(dataInicio);
  } else {
    // Se o usuário tentou passar um período mas não entendemos, ERRO (não inventar "hoje")
    if (args.periodo) {
      return {
        data_inicio: '',
        data_fim: '',
        periodo_label: 'erro',
        mensagem: `⚠️ Não entendi o período "${args.periodo}".\n\nTente usar:\n- "hoje", "ontem", "anteontem"\n- "semana passada", "esta semana"\n- "mês passado", "este mês"\n- Ou uma data: "15/12/2025"`,
        total_recebido: 0,
        recebimentos_por_via: []
      };
    }

    dataInicio = hojeSP();
    dataFim = dataInicio;
    periodoLabel = 'hoje';
  }

  console.log(`[ESPELHO] Período: ${periodoLabel} (${dataInicio} a ${dataFim})`);

  // Executar com timeout
  const resultado = await Promise.race([
    executarConsulta(client, dataInicio, dataFim, periodoLabel),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Timeout: consulta demorou mais de 45s')),
        TIMEOUT_MS
      )
    ),
  ]);

  return resultado;
}

async function executarConsulta(
  client: GraphQLClient,
  dataInicio: string,
  dataFim: string,
  periodoLabel: string
): Promise<EspelhoBancarioResult> {
  let allEntries: BankMirrorEntry[] = [];
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

    const result = await client.request<EntriesBankMirrorResponse>(query);

    const data = result.entriesBankMirror.data;
    const paginator = result.entriesBankMirror.paginatorInfo;

    totalPages = paginator.lastPage;
    console.log(`[ESPELHO] Pág ${currentPage}/${totalPages} - ${data.length} reg`);

    allEntries = allEntries.concat(data);

    if (data.length === 0) break;

    // OTIMIZAÇÃO: Parar se encontrarmos datas anteriores ao inicio do periodo
    // Assumindo que a API retorna do mais recente para o mais antigo
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

  // Filtrar pelo período
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
    return {
      data_inicio: dataInicio,
      data_fim: dataFim,
      periodo_label: periodoLabel,
      mensagem: `Não houve recebimentos em ${periodoLabel}.`,
      total_recebido: 0,
      recebimentos_por_via: [],
    };
  }

  const recebimentos = filtered.filter((e) => e.value > 0);
  const pagamentos = filtered.filter((e) => e.value < 0);

  // Agrupar por via
  const porVia: Record<string, number[]> = {};
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

  // Formatar mensagem - APENAS recebimentos por canal
  let msg = `💰 Recebimentos de ${periodoLabel}:\n\n`;

  if (resumo.length > 0) {
    for (const item of resumo) {
      msg += `${item.via} R$ ${formatarDinheiro(item.total)}\n`;
    }
    msg += `\n✅ TOTAL R$ ${formatarDinheiro(totalRecebido)}`;
  } else {
    msg += `Nenhum recebimento encontrado.`;
  }

  // Pagamentos e saldo disponíveis no JSON de retorno, mas NÃO na mensagem principal

  // Preparar extrato simplificado
  const extrato: Transacao[] = filtered.map(e => ({
    data: e.date,
    descricao: e.description,
    valor: e.value,
    via: e.via,
    tipo: e.value > 0 ? 'ENTRADA' : 'SAIDA'
  }));

  return {
    data_inicio: dataInicio,
    data_fim: dataFim,
    periodo_label: periodoLabel,
    mensagem: msg,
    total_recebido: totalRecebido,
    recebimentos_por_via: resumo
  };
}
