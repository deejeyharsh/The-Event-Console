const fs = require('fs');

let content = fs.readFileSync('src/components/WeddingDashboard.tsx', 'utf8');

const tabs = ['guests', 'rooms', 'transport', 'hampers', 'tasks', 'whatsapp', 'campaign', 'events', 'team', 'automation'];

tabs.forEach(tab => {
  const exactOpen = `<TabsContent value="${tab}" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-0 space-y-6">`;
  const replacementOpen = `<TabsContent animated value="${tab}" className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-0 space-y-6">`;
  content = content.replace(exactOpen, replacementOpen);
});

fs.writeFileSync('src/components/WeddingDashboard.tsx', content);
