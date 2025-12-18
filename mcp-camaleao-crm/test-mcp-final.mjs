
import { GraphQLClient } from './build/lib/graphql-client.js';
import { espelhoBancario } from './build/tools/espelho-bancario.js';
import { consultarPedidos } from './build/tools/consultar-pedidos.js';

const API_URL = 'https://web-api.camaleaocamisas.com.br/graphql-api';
const EMAIL = 'api-gerente@email.com';
const PASSWORD = 'PPTDYBYqcmE7wg';

async function runTests() {
  console.log('🚀 INICIANDO TESTE FINAL DO MCP (Lógica Compilada)\n');

  const client = new GraphQLClient(API_URL, EMAIL, PASSWORD);

  try {
    // 1. Testar Espelho Bancário (Ontem)
    console.log('---------------------------------------------------');
    console.log('🧪 TESTE 1: Espelho Bancário (Ontem)');
    console.log('---------------------------------------------------');
    
    const resultadoEspelho = await espelhoBancario(client, { periodo: 'ontem' });
    
    console.log('\n📄 RESULTADO BRUTO (JSON):');
    console.log(JSON.stringify(resultadoEspelho, null, 2));
    
    console.log('\n💬 MENSAGEM GERADA:');
    console.log(resultadoEspelho.mensagem);

    // 2. Testar Consultar Pedidos (Ontem)
    console.log('\n---------------------------------------------------');
    console.log('🧪 TESTE 2: Consultar Pedidos (Ontem)');
    console.log('---------------------------------------------------');

    const resultadoPedidos = await consultarPedidos(client, { periodo: 'ontem' });

    console.log('\n📄 RESULTADO BRUTO (JSON):');
    console.log(JSON.stringify(resultadoPedidos, null, 2));

    console.log('\n💬 MENSAGEM GERADA:');
    console.log(resultadoPedidos.mensagem);

    console.log('\n✅ TESTE FINALIZADO COM SUCESSO!');
    process.exit(0);

  } catch (error) {
    console.error('❌ ERRO FATAL:', error);
    process.exit(1);
  }
}

await runTests();
