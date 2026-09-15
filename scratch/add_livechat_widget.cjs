const fs = require('fs');

const rootPath = 'src/routes/__root.tsx';
let code = fs.readFileSync(rootPath, 'utf8');

const targetOld = `function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}`;

const targetNew = `function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
        {/* Teals CRM Live Chat Widget */}
        <script 
          src="https://teals-livechat-saas.vercel.app/widget.js" 
          data-property="teals-crm" 
          async
        ></script>
      </body>
    </html>
  );
}`;

code = code.replace(targetOld, targetNew);
fs.writeFileSync(rootPath, code, 'utf8');
console.log('Successfully added Teals Live Chat Widget to src/routes/__root.tsx!');