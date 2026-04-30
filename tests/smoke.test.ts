import axios from 'axios';

async function runSmokeTest() {
  const GATEWAY_URL = 'http://localhost:3000';
  const endpoints = [
    '/api/menu/api-docs/',
    '/api/stock/api-docs/',
    '/api/order/api-docs/'
  ];

  console.log('🚀 Iniciando Teste de Fumaça (Smoke Test)...');

  for (const path of endpoints) {
    try {
      const response = await axios.get(`${GATEWAY_URL}${path}`);
      if (response.status === 200) {
        console.log(`✅ [SUCCESS] ${path} está respondendo!`);
      } else {
        console.log(`❌ [FAILED] ${path} retornou status ${response.status}`);
      }
    } catch (error: any) {
      console.log(`❌ [ERROR] Falha ao acessar ${path}: ${error.message}`);
    }
  }

  console.log('\n🏁 Teste finalizado.');
}

runSmokeTest();
