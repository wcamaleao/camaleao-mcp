// ═══════════════════════════════════════════════════════════════
// PARSER DE PERÍODOS NATURAIS
// ═══════════════════════════════════════════════════════════════
function getDataAtualSP() {
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
function formatISO(d) {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
}
function subDias(data, dias) {
    const d = new Date(data);
    d.setDate(d.getDate() - dias);
    return d;
}
export function parsePeriodo(input) {
    const hoje = getDataAtualSP();
    const s = input.toLowerCase().trim();
    // "hoje"
    if (s === 'hoje' || s === 'hj') {
        return {
            data_inicio: formatISO(hoje),
            data_fim: formatISO(hoje),
            label: 'hoje',
        };
    }
    // "ontem"
    if (s === 'ontem') {
        const ontem = subDias(hoje, 1);
        return {
            data_inicio: formatISO(ontem),
            data_fim: formatISO(ontem),
            label: 'ontem',
        };
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
    const meses = {
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
export function hojeSP() {
    return formatISO(getDataAtualSP());
}
export function normalizaData(raw) {
    const s = raw.trim();
    if (!s || ['hoje', 'hj'].includes(s.toLowerCase()))
        return hojeSP();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s))
        return s;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const [dd, mm, yyyy] = s.split('/');
        return `${yyyy}-${mm}-${dd}`;
    }
    return hojeSP();
}
export function isoParaBR(iso) {
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d)
        return iso;
    return `${d}/${m}/${y}`;
}
//# sourceMappingURL=date-parser.js.map