const { createClient } = require('@supabase/supabase-js');
const tls = require('tls');

const s = createClient('https://nyjhbeqpjfdhhvqvjzyy.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55amhiZXFwamZkaGh2cXZqenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjAxMDIxOCwiZXhwIjoyMTAxNTg2MjE4fQ.24R2ioDLYUhuS8WQrRS2FBBLvq9M2ICJKPFutntNrqk', { auth: { autoRefreshToken: false, persistSession: false } });

const GMAIL_USER = "garryamelia6265@gmail.com";
const GMAIL_APP_PASS = "vlnzgybqvbmapxnn";

async function inspect() {
  const { data: leads } = await s.from('leads').select('*');
  console.log("Leads in DB:", JSON.stringify(leads, null, 2));

  const { data: emails } = await s.from('emails_sent').select('*');
  console.log("Emails sent in DB:", JSON.stringify(emails, null, 2));

  // Test IMAP
  const client = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false }, () => {
    console.log("Connected to IMAP");
    client.write(`A1 LOGIN ${GMAIL_USER} ${GMAIL_APP_PASS}\r\n`);
  });

  let step = 0;
  let buffer = "";

  client.on("data", (chunk) => {
    buffer += chunk.toString();
    console.log("IMAP buffer chunk:", chunk.toString());

    if (step === 0 && buffer.includes("A1 OK")) {
      buffer = "";
      step = 1;
      client.write("A2 SELECT INBOX\r\n");
    } else if (step === 1 && buffer.includes("A2 OK")) {
      buffer = "";
      step = 2;
      // Fetch recent headers
      client.write("A3 FETCH 1:* (BODY[HEADER.FIELDS (FROM SUBJECT DATE)])\r\n");
    } else if (step === 2 && buffer.includes("A3 OK")) {
      console.log("Headers fetched:\n", buffer);
      client.write("A4 LOGOUT\r\n");
      client.end();
    }
  });

  client.on("error", (e) => console.error("IMAP error:", e));
}

inspect();
