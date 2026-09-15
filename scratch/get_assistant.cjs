const https = require('https');

const VAPI_PRIVATE_KEY = '1868db1d-90de-4d6c-abd5-374bdeffd24d';
const VAPI_ASSISTANT_ID = '0bc6b506-cb70-48b6-a2b5-e74cbcd179d3';

https.get(`https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}`, {
  headers: { 'Authorization': `Bearer ${VAPI_PRIVATE_KEY}` }
}, (res) => {
  let body = '';
  res.on('data', (c) => body += c);
  res.on('end', () => {
    const a = JSON.parse(body);
    console.log('Assistant Name:', a.name);
    console.log('Analysis Plan:', JSON.stringify(a.analysisPlan, null, 2));
  });
});