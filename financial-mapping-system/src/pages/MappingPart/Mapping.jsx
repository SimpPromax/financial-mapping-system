import React, { useState, useEffect } from 'react';
import api from '../../services/api';

const Mapping = () => {
    const [sheets, setSheets] = useState([]);
    const [elements, setElements] = useState([]);
    const [coas, setCoas] = useState([]);

    const [selectedSheet, setSelectedSheet] = useState('');
    const [selectedElement, setSelectedElement] = useState('');
    const [selectedCoa, setSelectedCoa] = useState('');
    const [loading, setLoading] = useState(false);

    // Fetch Sheets and COA
    const fetchSheets = async () => {
        try {
            const res = await api.get('/api/excel-sheets');
            setSheets(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchCoas = async () => {
        try {
            const res = await api.get('/api/coa');
            setCoas(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchSheets();
        fetchCoas();
    }, []);

    // Fetch elements when sheet changes
    useEffect(() => {
        if (selectedSheet) {
            const fetchElements = async () => {
                try {
                    const res = await api.get(`/api/excel-elements?sheetId=${selectedSheet}`);
                    setElements(res.data);
                } catch (err) {
                    console.error(err);
                }
            };
            fetchElements();
        } else {
            setElements([]);
            setSelectedElement('');
        }
    }, [selectedSheet]);

    const handleSaveMapping = async () => {
        if (!selectedSheet || !selectedElement || !selectedCoa) {
            alert('Please select Sheet, Element, and COA.');
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('/api/mappings', {
                sheetId: selectedSheet, // will now be the numeric ID
                elementId: selectedElement,
                coaId: selectedCoa,
                createdBy: 'admin', // Replace with logged-in user
            });
            alert(`Mapping saved! ID: ${res.data.mappingId}`);
            // Reset selections if needed
            setSelectedSheet('');
            setSelectedElement('');
            setSelectedCoa('');
        } catch (err) {
            console.error(err);
            alert('Failed to save mapping.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white shadow-md rounded-md mt-8">
            <h2 className="text-2xl font-bold mb-6">Map Excel Element to COA</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Sheet Dropdown */}
                <select
                    className="border p-2 rounded"
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                >
                    <option value="">Select Sheet</option>
                    {sheets.map((s) => (
                        <option key={s.sheetId} value={s.sheetId}>
                            {s.excellSheetName} {/* displayed to user */}
                        </option>
                    ))}
                </select>

                {/* Element Dropdown */}
                <select
                    className="border p-2 rounded"
                    value={selectedElement}
                    onChange={(e) => setSelectedElement(e.target.value)}
                    disabled={!selectedSheet}
                >
                    <option value="">Select Element</option>
                    {elements.map((el) => (
                        <option key={el.elementId} value={el.elementId}>
                            {el.excelElement} ({el.cellReference || 'No ref'})
                        </option>
                    ))}
                </select>

                {/* COA Dropdown */}
                <select
                    className="border p-2 rounded"
                    value={selectedCoa}
                    onChange={(e) => setSelectedCoa(e.target.value)}
                >
                    <option value="">Select COA</option>
                    {coas.map((c) => (
                        <option key={c.coaId} value={c.coaId}>
                            {c.coaName} ({c.coaCode})
                        </option>
                    ))}
                </select>
            </div>

            <button
                className={`bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 ${loading ? 'opacity-50' : ''}`}
                onClick={handleSaveMapping}
                disabled={loading}
            >
                {loading ? 'Saving...' : 'Save Mapping'}
            </button>
        </div>
    );
};

export default Mapping;
