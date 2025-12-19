/**
 * Teste E2E do MCP Gateway
 * Simula as chamadas que o workflow n8n faz ao MCP Gateway
 */

const MCP_GATEWAY_URL = 'https://gestorconecta-mcp-gateway.oxlser.easypanel.host';

// Cores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bold');
  console.log('='.repeat(60) + '\n');
}

async function testEndpoint(name, endpoint, payload) {
  logSection(`Testando: ${name}`);
  log(`URL: ${MCP_GATEWAY_URL}${endpoint}`, 'blue');
  log(`Payload: ${JSON.stringify(payload, null, 2)}`, 'yellow');

  const startTime = Date.now();

  try {
    const response = await fetch(`${MCP_GATEWAY_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const elapsed = Date.now() - startTime;
    const statusColor = response.ok ? 'green' : 'red';

    log(`\nStatus: ${response.status} ${response.statusText}`, statusColor);
    log(`Tempo: ${elapsed}ms`, 'blue');

    const responseBody = await response.text();
    let jsonData;

    try {
      jsonData = JSON.parse(responseBody);
      log('\nResposta:', 'green');
      console.log(JSON.stringify(jsonData, null, 2));
    } catch (e) {
      log('\nResposta (texto):', 'yellow');
      console.log(responseBody);
    }

    return {
      success: response.ok,
      status: response.status,
      elapsed,
      data: jsonData || responseBody
    };

  } catch (error) {
    const elapsed = Date.now() - startTime;
    log(`\n❌ ERRO: ${error.message}`, 'red');
    log(`Tempo: ${elapsed}ms`, 'blue');

    return {
      success: false,
      error: error.message,
      elapsed
    };
  }
}

async function runE2ETests() {
  log('\n🚀 INICIANDO TESTES E2E DO MCP GATEWAY\n', 'bold');

  const results = [];

  // Teste 1: Health Check
  results.push(await testEndpoint(
    'Health Check',
    '/health',
    {}
  ));

  // Teste 2: Consultar Pedidos - Hoje
  results.push(await testEndpoint(
    'Consultar Pedidos - Hoje',
    '/mcp/crm/consultar_pedidos',
    {
      periodo: 'hoje',
      data_inicio: '',
      data_fim: '',
      cliente: ''
    }
  ));

  // Teste 3: Consultar Pedidos - Ontem
  results.push(await testEndpoint(
    'Consultar Pedidos - Ontem',
    '/mcp/crm/consultar_pedidos',
    {
      periodo: 'ontem',
      data_inicio: '',
      data_fim: '',
      cliente: ''
    }
  ));

  // Teste 4: Consultar Pedidos - Semana Passada
  results.push(await testEndpoint(
    'Consultar Pedidos - Semana Passada',
    '/mcp/crm/consultar_pedidos',
    {
      periodo: 'semana_passada',
      data_inicio: '',
      data_fim: '',
      cliente: ''
    }
  ));

  // Teste 5: Consultar Pedidos - Período Específico
  results.push(await testEndpoint(
    'Consultar Pedidos - Período Específico',
    '/mcp/crm/consultar_pedidos',
    {
      periodo: '',
      data_inicio: '2024-12-01',
      data_fim: '2024-12-15',
      cliente: ''
    }
  ));

  // Teste 6: Espelho Bancário - Hoje
  results.push(await testEndpoint(
    'Espelho Bancário - Hoje',
    '/mcp/crm/espelho_bancario',
    {
      periodo: 'hoje',
      data_inicio: '',
      data_fim: '',
      data: ''
    }
  ));

  // Teste 7: Espelho Bancário - Ontem
  results.push(await testEndpoint(
    'Espelho Bancário - Ontem',
    '/mcp/crm/espelho_bancario',
    {
      periodo: 'ontem',
      data_inicio: '',
      data_fim: '',
      data: ''
    }
  ));

  // Teste 8: Espelho Bancário - Semana Passada
  results.push(await testEndpoint(
    'Espelho Bancário - Semana Passada',
    '/mcp/crm/espelho_bancario',
    {
      periodo: 'semana_passada',
      data_inicio: '',
      data_fim: '',
      data: ''
    }
  ));

  // Teste 9: Espelho Bancário - Data Específica
  results.push(await testEndpoint(
    'Espelho Bancário - Data Específica',
    '/mcp/crm/espelho_bancario',
    {
      periodo: '',
      data_inicio: '',
      data_fim: '',
      data: '2024-12-15'
    }
  ));

  // Resumo Final
  logSection('📊 RESUMO DOS TESTES');

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalTime = results.reduce((sum, r) => sum + r.elapsed, 0);
  const avgTime = Math.round(totalTime / results.length);

  log(`Total de testes: ${results.length}`, 'blue');
  log(`✅ Sucesso: ${successful}`, 'green');
  log(`❌ Falha: ${failed}`, 'red');
  log(`⏱️  Tempo total: ${totalTime}ms`, 'blue');
  log(`⏱️  Tempo médio: ${avgTime}ms`, 'blue');

  if (failed === 0) {
    log('\n🎉 TODOS OS TESTES PASSARAM!', 'green');
  } else {
    log('\n⚠️  ALGUNS TESTES FALHARAM', 'yellow');
  }

  console.log('\n');

  // Retornar código de saída
  process.exit(failed > 0 ? 1 : 0);
}

// Executar testes
runE2ETests().catch(error => {
  log(`\n💥 ERRO FATAL: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
