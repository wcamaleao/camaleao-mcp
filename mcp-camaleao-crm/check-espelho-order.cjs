
const https = require('https');

const apiUrl = 'https://web-api.camaleaocamisas.com.br/graphql-api';
const email = 'api-gerente@email.com';
const password = 'PPTDYBYqcmE7wg';

let cookies = '';

function graphqlRequest(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(cookies ? { 'Cookie': cookies } : {})
      }
    };
    const req = https.request(apiUrl, options, (res) => {
      let data = '';
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        cookies = Array.isArray(setCookie) ? setCookie.map(c => c.split(';')[0]).join('; ') : setCookie.split(';')[0];
      }
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log("Autenticando...");
  await graphqlRequest(`mutation { login(email: "${email}", password: "${password}", remember: false) { id } }`);
  
  console.log("Buscando primeira página do Espelho Bancário...");
  const query = `
    query {
      entriesBankMirror(first: 5, page: 1) {
        data {
          id
          date
          value
        }
      }
    }
  `;
  
  const result = await graphqlRequest(query);
  const entries = result.data.entriesBankMirror.data;
  
  console.log("Primeiros 5 registros:");
  entries.forEach(e => console.log(`- ${e.date} | R$ ${e.value}`));

  const firstDate = new Date(entries[0].date);
  const lastDate = new Date(entries[entries.length - 1].date);

  if (firstDate > lastDate) {
      console.log("\nCONCLUSÃO: A ordem é DECRESCENTE (Mais recente -> Mais antigo). A otimização atual FUNCIONA.");
  } else {
      console.log("\nCONCLUSÃO: A ordem é CRESCENTE (Mais antigo -> Mais recente). A otimização atual VAI FALHAR.");
  }
}

run();
