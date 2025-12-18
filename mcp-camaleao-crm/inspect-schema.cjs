
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
  await graphqlRequest(`mutation { login(email: "${email}", password: "${password}", remember: false) { id } }`);
  
  const query = `
    query {
      __type(name: "QueryOrdersOrderByOrderByClause") {
        inputFields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
              enumValues {
                name
              }
            }
          }
        }
      }
    }
  `;
  
  const result = await graphqlRequest(query);
  console.log(JSON.stringify(result.data.__type, null, 2));
}

run();
