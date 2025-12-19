// ═══════════════════════════════════════════════════════════════
// PARSER DE PERÍODOS NATURAIS (COM FUZZY MATCHING)
// ═══════════════════════════════════════════════════════════════

import type { PeriodoDetectado } from '../types/index.js';

// Algoritmo de Levenshtein para calcular distância entre strings
function levenshtein(a: string, b: string): number {
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
function fuzzyMatch(input: string, target: string, maxDistance: number = 1): boolean {
  const words = input.split(/\s+/);
  // Verifica se alguma palavra do input é próxima o suficiente do target
  return words.some(word => {
    // Se for muito curta, exige exatidão
    if (target.length <= 3) return word === target;
    return levenshtein(word, target) <= maxDistance;
  });
}

function getDataAtualSP(): Date {
  const agora = new Date();
  const brasiliaStr = agora.toLocaleString('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [mesStr, diaStr, anoStr] = brasiliaStr.split('/');
  return new Date(parseInt(anoStr), parseInt(mesStr) - 1, parseInt(diaStr));
}

function formatISO(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function subDias(data: Date, dias: number): Date {
  const d = new Date(data);
  d.setDate(d.getDate() - dias);
  return d;
}

export function parsePeriodo(input: string): PeriodoDetectado | null {
  const hoje = getDataAtualSP();
  const s = input.toLowerCase().trim();

  // ═══════════════════════════════════════════════════════════════
  // 1. COMANDOS ESTRUTURADOS (PRIORIDADE MÁXIMA)
  // ═══════════════════════════════════════════════════════════════
  
  // ISO Date (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return { data_inicio: s, data_fim: s, label: isoParaBR(s) };
  }

  // BR Date (DD/MM/YYYY)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    const iso = `${y}-${m}-${d}`;
    return { data_inicio: iso, data_fim: iso, label: s };
  }

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
  // A IA normaliza "naquela sexta", "sexta anterior", "sexta feira passada" -> "SEXTA_PASSADA"
  const matchDiaPassado = s.match(/^(domingo|segunda|terca|quarta|quinta|sexta|sabado)_passad[oa]$/);
  if (matchDiaPassado) {
    const mapDias: Record<string, number> = {
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
    return {
      data_inicio: formatISO(hoje),
      data_fim: formatISO(hoje),
      label: 'hoje',
    };
  }

  // "anteontem" (fuzzy)
  if (fuzzyMatch(s, 'anteontem', 2) || s.includes('ante ontem')) {
    const anteontem = subDias(hoje, 2);
    return {
      data_inicio: formatISO(anteontem),
      data_fim: formatISO(anteontem),
      label: 'anteontem',
    };
  }

  // "ontem" (fuzzy)
  if (fuzzyMatch(s, 'ontem', 1)) {
    const ontem = subDias(hoje, 1);
    return {
      data_inicio: formatISO(ontem),
      data_fim: formatISO(ontem),
      label: 'ontem',
    };
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

  // "últimos X dias"
  const ultimosDiasMatch = s.match(/ultim[oa]s?\s+(\d+)\s+dias?/);
  if (ultimosDiasMatch) {
    const dias = parseInt(ultimosDiasMatch[1]);
    return {
      data_inicio: formatISO(subDias(hoje, dias - 1)),
      data_fim: formatISO(hoje),
      label: `últimos ${dias} dias`,
    };
  }

  // "esta semana"
  if (s.includes('esta semana') || s.includes('essa semana') || s.includes('nessa semana')) {
    const diaSemana = hoje.getDay();
    const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
    const segunda = subDias(hoje, diasDesdeSegunda);
    return {
      data_inicio: formatISO(segunda),
      data_fim: formatISO(hoje),
      label: 'esta semana',
    };
  }

  // "semana passada"
  if (s.includes('semana passada')) {
    const diaSemana = hoje.getDay();
    const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
    const segundaPassada = subDias(hoje, diasDesdeSegunda + 7);
    const domingoPassado = subDias(hoje, diasDesdeSegunda + 1);
    return {
      data_inicio: formatISO(segundaPassada),
      data_fim: formatISO(domingoPassado),
      label: 'semana passada',
    };
  }

  // "este mês"
  if (s.includes('este m') || s.includes('esse m') || s.includes('nesse m')) {
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return {
      data_inicio: formatISO(primeiroDia),
      data_fim: formatISO(hoje),
      label: 'este mês',
    };
  }

  // Meses por nome
  const meses: Record<string, number> = {
    janeiro: 0,
    fevereiro: 1,
    março: 2,
    marco: 2,
    abril: 3,
    maio: 4,
    junho: 5,
    julho: 6,
    agosto: 7,
    setembro: 8,
    outubro: 9,
    novembro: 10,
    dezembro: 11,
  };

  for (const [nome, mes] of Object.entries(meses)) {
    if (s.includes(nome)) {
      let ano = hoje.getFullYear();
      const anoMatch = s.match(/\b(20\d{2})\b/);
      if (anoMatch) {
        ano = parseInt(anoMatch[1]);
      }

      const primeiroDia = new Date(ano, mes, 1);
      const ultimoDia = new Date(ano, mes + 1, 0);

      return {
        data_inicio: formatISO(primeiroDia),
        data_fim: formatISO(ultimoDia),
        label: `${nome}/${ano}`,
      };
    }
  }

  // "ano de YYYY"
  const anoMatch = s.match(/\b(20\d{2})\b/);
  if (anoMatch) {
    const ano = parseInt(anoMatch[1]);
    return {
      data_inicio: `${ano}-01-01`,
      data_fim: `${ano}-12-31`,
      label: `ano de ${ano}`,
    };
  }

  return null;
}

export function hojeSP(): string {
  return formatISO(getDataAtualSP());
}

export function normalizaData(raw: string): string {
  const s = raw.trim();
  if (!s || ['hoje', 'hj'].includes(s.toLowerCase())) return hojeSP();
  
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }

  // DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }

  // DD/MM (Assume ano atual)
  if (/^\d{2}\/\d{2}$/.test(s)) {
    const [dd, mm] = s.split('/');
    const ano = getDataAtualSP().getFullYear();
    return `${ano}-${mm}-${dd}`;
  }

  // DD-MM (Assume ano atual)
  if (/^\d{2}-\d{2}$/.test(s)) {
    const [dd, mm] = s.split('-');
    const ano = getDataAtualSP().getFullYear();
    return `${ano}-${mm}-${dd}`;
  }

  // Se chegou aqui, a data é inválida. NÃO retorne hoje.
  throw new Error(`Data inválida: "${raw}"`);
}

export function isoParaBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export interface PeriodoResolvido {
  dataInicio: string;
  dataFim: string;
  periodoLabel: string;
  erro?: string;
}

export function resolvePeriodo(args: { periodo?: string; data?: string; data_inicio?: string; data_fim?: string }): PeriodoResolvido {
  const periodoInput = (args.periodo || args.data || '').trim();
  const dataInicioInput = (args.data_inicio || '').trim();
  const dataFimInput = (args.data_fim || '').trim();

  if (periodoInput) {
    const periodoDetectado = parsePeriodo(periodoInput);
    if (periodoDetectado) {
      return {
        dataInicio: periodoDetectado.data_inicio,
        dataFim: periodoDetectado.data_fim,
        periodoLabel: periodoDetectado.label
      };
    } else {
      // Tenta parsear como data direta se falhar o parsePeriodo (ex: "2025-12-01")
      try {
        const d = normalizaData(periodoInput);
        return {
            dataInicio: d,
            dataFim: d,
            periodoLabel: isoParaBR(d)
        };
      } catch {
        return {
            dataInicio: '',
            dataFim: '',
            periodoLabel: 'erro',
            erro: `⚠️ Não entendi o período "${periodoInput}". Tente: hoje, ontem, semana passada, etc.`
        };
      }
    }
  } else if (dataInicioInput && dataFimInput) {
    try {
      const i = normalizaData(dataInicioInput);
      const f = normalizaData(dataFimInput);
      return {
        dataInicio: i,
        dataFim: f,
        periodoLabel: `${isoParaBR(i)} a ${isoParaBR(f)}`
      };
    } catch (e) {
       return {
        dataInicio: '',
        dataFim: '',
        periodoLabel: 'erro',
        erro: `⚠️ Data inválida fornecida.`
      };
    }
  } else if (dataInicioInput) {
     try {
      const i = normalizaData(dataInicioInput);
      return {
        dataInicio: i,
        dataFim: i,
        periodoLabel: isoParaBR(i)
      };
    } catch (e) {
       return {
        dataInicio: '',
        dataFim: '',
        periodoLabel: 'erro',
        erro: `⚠️ Data inválida fornecida.`
      };
    }
  }

  // Default
  const h = hojeSP();
  return {
    dataInicio: h,
    dataFim: h,
    periodoLabel: 'hoje'
  };
}
