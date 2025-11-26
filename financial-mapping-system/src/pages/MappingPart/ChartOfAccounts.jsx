// src/pages/ChartOfAccounts.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const ChartOfAccounts = () => {
    const [coaList, setCoaList] = useState([]);
    const [coaCode, setCoaCode] = useState('');
    const [coaName, setCoaName] = useState('');
    const [description, setDescription] = useState('');
    const [sqlScript, setSqlScript] = useState('');
    const [loading, setLoading] = useState(false);

    // Fetch all COAs
    const fetchCOAs = async () => {
        try {
            const response = await api.get('/api/coa');
            setCoaList(response.data);
        } catch (err) {
            console.error('Failed to fetch COAs:', err);
        }
    };

    useEffect(() => {
        fetchCOAs();
    }, []);

    // Handle Add COA
    const handleAddCOA = async () => {
        if (!coaCode || !coaName || !sqlScript) {
            alert('Please fill in COA Code, Name, and SQL Script.');
            return;
        }
        setLoading(true);
        try {
            const response = await api.post('/api/coa', {
                coaCode,
                coaName,
                description,
                sqlScript,
                createdBy: 'admin', // You can replace with logged-in user
            });
            setCoaList([...coaList, response.data]);
            setCoaCode('');
            setCoaName('');
            setDescription('');
            setSqlScript('');
            alert('COA added successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to add COA.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-md mt-8">
            <h2 className="text-2xl font-bold mb-6">Chart of Accounts</h2>

            {/* Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                    type="text"
                    placeholder="COA Code"
                    className="border p-2 rounded"
                    value={coaCode}
                    onChange={(e) => setCoaCode(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="COA Name"
                    className="border p-2 rounded"
                    value={coaName}
                    onChange={(e) => setCoaName(e.target.value)}
                />
            </div>
            <textarea
                placeholder="Description"
                className="border p-2 rounded w-full mb-2"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
            />
            <textarea
                placeholder="SQL Script"
                className="border p-2 rounded w-full mb-4"
                value={sqlScript}
                onChange={(e) => setSqlScript(e.target.value)}
                rows={4}
            />
            <button
                className={`bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 ${loading ? 'opacity-50' : ''}`}
                onClick={handleAddCOA}
                disabled={loading}
            >
                {loading ? 'Saving...' : 'Add COA'}
            </button>

            {/* COA Table */}
            <h3 className="text-xl font-semibold mt-6 mb-2">Existing COAs</h3>
            <table className="w-full border border-gray-300">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="border px-2 py-1">Code</th>
                        <th className="border px-2 py-1">Name</th>
                        <th className="border px-2 py-1">SQL Script</th>
                        <th className="border px-2 py-1">Description</th>
                    </tr>
                </thead>
                <tbody>
                    {coaList.map((c) => (
                        <tr key={c.coaId}>
                            <td className="border px-2 py-1">{c.coaCode}</td>
                            <td className="border px-2 py-1">{c.coaName}</td>
                            <td className="border px-2 py-1 font-mono text-sm">{c.sqlScript}</td>
                            <td className="border px-2 py-1">{c.description}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ChartOfAccounts;
