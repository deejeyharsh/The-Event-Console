import { Analytics } from '@vercel/analytics/react';

function App() {
  return (
    <>
      <div className="app">
        <h1>The Event Console</h1>
        <p>Event Management Application</p>
      </div>
      <Analytics />
    </>
  );
}

export default App;
