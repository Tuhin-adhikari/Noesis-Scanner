import React, { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import * as XLSX from "xlsx";

const STORAGE_KEY = "noesis_entries_v1";

function toast(msg) {
  // simple non-blocking toast
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.position = "fixed";
  el.style.right = "20px";
  el.style.bottom = "20px";
  el.style.background = "rgba(17,24,39,0.9)";
  el.style.color = "white";
  el.style.padding = "10px 14px";
  el.style.borderRadius = "8px";
  el.style.zIndex = 9999;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

export default function App() {
  const [entries, setEntries] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null); // holds Html5Qrcode instance
  const [manual, setManual] = useState({ name: "", college: "", email: "", phone: "" });
  const [query, setQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  const startScanner = async () => {
    if (scanning) return;
    setScanning(true);

    // create scanner instance
    const html5Qrcode = new Html5Qrcode("reader");
    scannerRef.current = html5Qrcode;

    // ask for camera permission and start
    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) throw new Error("No cameras found");

      // Try to find the back camera
      const backCamera = devices.find(d =>
        d.label.toLowerCase().includes("back") || d.label.toLowerCase().includes("rear")
      );

      // Prefer back camera if found, else fallback to first one
      const cameraId = backCamera ? backCamera.id : devices[0].id;

      await html5Qrcode.start(
        cameraId,
        { fps: 8, qrbox: { width: 250, height: 250 } },
        (decodedText) => handleScan(decodedText),
        () => { }
      );
    } catch (err) {
      setScanning(false);
      toast("Camera permission denied or no camera found.");
      console.error(err);
    }
  };

  const stopScanner = async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
    } catch (e) {
      console.warn("stop failed", e);
    } finally {
      try {
        scannerRef.current.clear();
      } catch { }
      scannerRef.current = null;
      setScanning(false);
    }
  };

  const parseScanned = (text) => {
    // text is expected to be JSON string like {id,name,college,email,phone}
    try {
      const data = JSON.parse(text);
      // normalization: ensure id exists
      if (!data.id) {
        // optionally generate id if missing
        data.id = "NOESIS" + Math.floor(100000 + Math.random() * 900000);
      }
      // trim strings
      ["name", "college", "email", "phone"].forEach((k) => {
        if (data[k]) data[k] = String(data[k]).trim();
        else data[k] = "";
      });
      return data;
    } catch {
      return null;
    }
  };

  const isDuplicate = (d) => {
    return entries.some((e) =>
      e.id === d.id &&
      e.name === d.name &&
      e.college === d.college &&
      e.email === d.email &&
      e.phone === d.phone
    );
  };

  const handleScan = (decodedText) => {
    const data = parseScanned(decodedText);
    if (!data) {
      toast("⚠️ Invalid QR format");
      return;
    }

    if (isDuplicate(data)) {
      toast("⚠️ Duplicate QR detected — already registered!");
      return;
    }

    // Add to entries
    setEntries((p) => [...p, data]);

    // Show success toast
    toast(`✅ Scan successful: ${data.name || data.email || data.id}`);
  };

  const handleManualAdd = (e) => {
    e.preventDefault();
    const d = { ...manual, id: "NOESIS" + Math.floor(100000 + Math.random() * 900000) };
    if (!d.name || !d.email) {
      toast("Name & email required");
      return;
    }
    if (isDuplicate(d)) {
      toast("Duplicate detected");
      return;
    }
    setEntries((p) => [...p, d]);
    setManual({ name: "", college: "", email: "", phone: "" });
  };

  const handleDelete = (id) => {
    if (!confirm("Delete this entry?")) return;
    setEntries((p) => p.filter((r) => r.id !== id));
  };

  const sortByCollege = () => {
    const sorted = [...entries].sort((a, b) => {
      const A = (a.college || "").toLowerCase();
      const B = (b.college || "").toLowerCase();
      return sortAsc ? A.localeCompare(B) : B.localeCompare(A);
    });
    setEntries(sorted);
    setSortAsc(!sortAsc);
  };

  const exportExcel = () => {
    if (entries.length === 0) {
      toast("Nothing to export");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(entries);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registrations");
    XLSX.writeFile(wb, `NOESIS_registrations_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const clearAll = () => {
    if (!confirm("Clear all entries? This cannot be undone.")) return;
    setEntries([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const filtered = entries.filter((e) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (e.name || "").toLowerCase().includes(q) ||
      (e.college || "").toLowerCase().includes(q) ||
      (e.email || "").toLowerCase().includes(q) ||
      (e.phone || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen p-6 text-white">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-purple-300">NOESIS 2025 — Scanner Dashboard</h1>
            <p className="text-gray-300 mt-1">Scan QR codes to register attendance. Data stored locally; export to Excel when needed.</p>
          </div>

          <div className="flex gap-3 items-center">
            <div className="text-sm text-gray-300">Total: <span className="font-semibold text-white">{entries.length}</span></div>
            <button
              onClick={scanning ? stopScanner : startScanner}
              className={`px-4 py-2 rounded-md font-semibold ${scanning ? "bg-red-600" : "bg-purple-600 hover:bg-purple-500"}`}
            >
              {scanning ? "Stop Scanning" : "Start Scanning"}
            </button>
            <button onClick={sortByCollege} className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 font-semibold">Sort by College</button>
            <button onClick={exportExcel} className="px-4 py-2 rounded-md bg-green-600 hover:bg-green-500 font-semibold">Export Excel</button>
            <button onClick={clearAll} className="px-4 py-2 rounded-md bg-red-700 hover:bg-red-600 font-semibold">Clear All</button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white/6 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Scanner</h3>
              <p className="text-sm text-gray-300 mb-3">Scanner will decode JSON embedded in the QR. Example: {"{name, college, email, phone, id}"}</p>
              <div id="reader" className="mb-3"></div>
              <div className="flex gap-2">
                <button onClick={scanning ? stopScanner : startScanner} className={`px-3 py-2 rounded-md ${scanning ? "bg-red-600" : "bg-purple-600"}`}>{scanning ? "Stop" : "Start"}</button>
                <button onClick={() => { navigator.clipboard.writeText(JSON.stringify({ id: "NOESIS123456", name: "Test User", college: "Test College", email: "test@example.com", phone: "9999999999" })); toast("Test QR JSON copied to clipboard"); }} className="px-3 py-2 rounded-md bg-gray-700">Copy test JSON</button>
              </div>
            </div>

            <div className="bg-white/6 p-4 mt-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Manual Add</h3>
              <form onSubmit={handleManualAdd} className="flex flex-col gap-2">
                <input className="p-2 rounded-md bg-transparent border border-purple-500" placeholder="Name" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} required />
                <input className="p-2 rounded-md bg-transparent border border-purple-500" placeholder="College" value={manual.college} onChange={(e) => setManual({ ...manual, college: e.target.value })} />
                <input className="p-2 rounded-md bg-transparent border border-purple-500" placeholder="Email" type="email" value={manual.email} onChange={(e) => setManual({ ...manual, email: e.target.value })} required />
                <input className="p-2 rounded-md bg-transparent border border-purple-500" placeholder="Phone" value={manual.phone} onChange={(e) => setManual({ ...manual, phone: e.target.value })} />
                <div className="flex gap-2">
                  <button type="submit" className="px-3 py-2 bg-purple-600 rounded-md">Add</button>
                  <button type="button" onClick={() => setManual({ name: "", college: "", email: "", phone: "" })} className="px-3 py-2 bg-gray-700 rounded-md">Reset</button>
                </div>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white/6 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Entries</h3>
                <input placeholder="Search by name/college/email/phone" value={query} onChange={(e) => setQuery(e.target.value)} className="p-2 rounded-md bg-transparent border border-purple-500 w-80" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-sm text-gray-300 border-b border-purple-700/30">
                      <th className="p-2">Name</th>
                      <th className="p-2">College</th>
                      <th className="p-2">Email</th>
                      <th className="p-2">Phone</th>
                      <th className="p-2">ID</th>
                      <th className="p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-b border-purple-800">
                        <td className="p-2">{r.name}</td>
                        <td className="p-2">{r.college}</td>
                        <td className="p-2">{r.email}</td>
                        <td className="p-2">{r.phone}</td>
                        <td className="p-2 font-mono text-sm">{r.id}</td>
                        <td className="p-2">
                          <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(r)); toast("Copied JSON"); }} className="px-2 py-1 mr-2 bg-gray-700 rounded-sm">Copy</button>
                          <button onClick={() => handleDelete(r.id)} className="px-2 py-1 bg-red-600 rounded-sm">Delete</button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-gray-400">No entries</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-8 text-sm text-gray-400 text-center">Physics Student Association • St. Joseph’s University</footer>
      </div>
    </div>
  );
}
