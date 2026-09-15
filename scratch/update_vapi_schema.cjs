const https = require('https');

const VAPI_PRIVATE_KEY = '1868db1d-90de-4d6c-abd5-374bdeffd24d';
const VAPI_ASSISTANT_ID = '0bc6b506-cb70-48b6-a2b5-e74cbcd179d3';

const payload = JSON.stringify({
  analysisPlan: {
    structuredDataPlan: {
      enabled: true,
      schema: {
        type: 'object',
        properties: {
          booked: {
            type: 'boolean',
            description: 'True if a demo/meeting slot was agreed upon or booked, false otherwise'
          },
          clientEmail: {
            type: 'string',
            description: 'The exact email address provided by the prospect or confirmed on file'
          },
          bookingDate: {
            type: 'string',
            description: 'The date agreed for the meeting in YYYY-MM-DD format (or tomorrow, next Monday, etc.)'
          },
          bookingDay: {
            type: 'string',
            description: 'The weekday agreed (e.g. Thursday, Friday, Monday)'
          },
          bookingTime: {
            type: 'string',
            description: 'The agreed meeting time (e.g. 10:00 AM, 2:30 PM, 4:00 PM)'
          },
          timezone: {
            type: 'string',
            description: 'The timezone of the prospect (e.g. EST, PST, CST, MST, GMT, BST, PKT, Eastern, Pacific, Central, London, etc.)'
          }
        },
        required: ['booked']
      }
    }
  }
});

const req = https.request(`https://api.vapi.ai/assistant/${VAPI_ASSISTANT_ID}`, {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Vapi Assistant structuredDataPlan updated successfully:', res.statusCode, body);
  });
});

req.on('error', (err) => console.error('Error updating assistant:', err));
req.write(payload);
req.end();