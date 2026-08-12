const tls = require('tls');
const user = 'garryamelia6265@gmail.com';
const pass = 'mchfrzwrftifihnl';

function checkRepliesBySearch(targetEmails) {
  return new Promise((resolve) => {
    const found = [];
    const client = tls.connect(993, 'imap.gmail.com', { rejectUnauthorized: false }, () => {
      client.write(`A1 LOGIN ${user} ${pass}\r\n`);
    });

    let step = 0;
    let buffer = '';

    client.on('data', (chunk) => {
      buffer += chunk.toString();
      if (step === 0 && buffer.includes('A1 OK')) {
        buffer = '';
        step = 1;
        client.write('A2 SELECT INBOX\r\n');
      } else if (step === 1 && buffer.includes('A2 OK')) {
        buffer = '';
        step = 2;
        // Search for first target email
        client.write(`A3 SEARCH FROM "${targetEmails[0]}"\r\n`);
      } else if (step === 2 && buffer.includes('A3 OK')) {
        const searchLine = buffer.match(/\* SEARCH([^\r\n]*)/i);
        const ids = searchLine && searchLine[1] ? searchLine[1].trim().split(/\s+/).filter(Boolean) : [];
        if (ids.length > 0) {
          found.push(targetEmails[0]);
        }
        client.write('A4 LOGOUT\r\n');
        client.end();
        resolve(found);
      }
    });

    client.on('error', () => resolve(found));
  });
}

checkRepliesBySearch(['newsletter@formspree.io']).then((found) => {
  console.log('SEARCH RESULT FOUND:', found);
  process.exit(0);
});
