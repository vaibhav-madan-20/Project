import React, { useEffect, useState } from "react";
import axios from "axios";

function FlagCard({ f }) {
  return (
    <div className="p-4 rounded shadow bg-white dark:bg-gray-800">
      <div className="flex justify-between">
        <div>
          <div className="text-sm text-gray-500">Tx</div>
          <div className="font-mono text-xs">{f.hash}</div>
        </div>
        <div className="text-right">
          <div className="text-sm">Risk</div>
          <div className="text-lg font-bold">{(f.risk * 100).toFixed(1)}%</div>
        </div>
      </div>
      <div className="mt-2 text-sm">
        From: {f.from} <br />
        Estimated Loss: {(f.estLoss * 100).toFixed(3)}%
      </div>
    </div>
  );
}

export default function App() {
  const [flags, setFlags] = useState([]);
  useEffect(() => {
    const fetchFlags = async () => {
      const res = await axios.get("http://localhost:3001/api/flags");
      setFlags(res.data);
    };
    fetchFlags();
    const interval = setInterval(fetchFlags, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-700 text-white p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">F1 MEV Guard</h1>
        <p className="text-sm text-gray-300">
          Real-time mempool flags — pit stop for your transactions 🏁
        </p>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {flags.length === 0 ? (
          <div className="col-span-full p-8 rounded bg-gray-800">
            No flagged TXs (yet)
          </div>
        ) : (
          flags.map((f) => <FlagCard key={f.hash} f={f} />)
        )}
      </main>
    </div>
  );
}
