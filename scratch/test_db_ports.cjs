const net = require('net');

function testPort(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);
    socket.on('connect', () => {
      console.log(`✅ Port ${port} on ${host} is OPEN!`);
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      console.log(`❌ Port ${port} on ${host} TIMEOUT.`);
      socket.destroy();
      resolve(false);
    });
    socket.on('error', (err) => {
      console.log(`❌ Port ${port} on ${host} ERROR:`, err.message);
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function run() {
  await testPort('db.nyjhbeqpjfdhhvqvjzyy.supabase.co', 5432);
  await testPort('db.nyjhbeqpjfdhhvqvjzyy.supabase.co', 6543);
  await testPort('aws-0-us-east-1.pooler.supabase.com', 6543);
  await testPort('aws-0-us-east-1.pooler.supabase.com', 5432);
}

run();
