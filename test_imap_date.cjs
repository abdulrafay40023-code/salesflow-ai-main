const tls = require('tls');

const GMAIL_USER = "garryamelia6265@gmail.com";
const GMAIL_APP_PASS = "vlnzgybqvbmapxnn";

function testImapDate() {
  const socket = tls.connect(993, "imap.gmail.com", { rejectUnauthorized: false });
  let tag = 1;
  let buffer = "";

  function send(cmd) {
    const t = `A${tag++}`;
    socket.write(`${t} ${cmd}\r\n`);
    return t;
  }

  socket.on("data", (d) => {
    const s = d.toString();
    buffer += s;
    console.log("RECV:", s);

    if (buffer.includes("* OK")) {
      buffer = "";
      send(`LOGIN ${GMAIL_USER} ${GMAIL_APP_PASS}`);
    } else if (buffer.includes("A1 OK")) {
      buffer = "";
      send(`SELECT INBOX`);
    } else if (buffer.includes("A2 OK")) {
      buffer = "";
      send(`SEARCH FROM "johndeep26626@gmail.com"`);
    } else if (buffer.includes("A3 OK")) {
      const match = buffer.match(/\* SEARCH (.*)/);
      const ids = match && match[1] ? match[1].trim().split(/\s+/).filter(Boolean) : [];
      console.log("Found message IDs for John Deep:", ids);
      buffer = "";
      if (ids.length > 0) {
        const lastId = ids[ids.length - 1];
        send(`FETCH ${lastId} (INTERNALDATE)`);
      } else {
        send(`LOGOUT`);
      }
    } else if (buffer.includes("A4 OK")) {
      console.log("INTERNALDATE result:\n", buffer);
      const dateMatch = buffer.match(/INTERNALDATE "([^"]+)"/i);
      if (dateMatch) {
        const emailDate = new Date(dateMatch[1]);
        console.log("Parsed email date:", emailDate.toISOString(), "Time (ms):", emailDate.getTime());
      }
      send(`LOGOUT`);
      socket.end();
    }
  });

  socket.on("error", (e) => console.error("Error:", e));
}

testImapDate();
