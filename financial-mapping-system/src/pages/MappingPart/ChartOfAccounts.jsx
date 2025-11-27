// src/pages/ChartOfAccounts.jsx
import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { Plus, X } from "lucide-react";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-sql";
import "prismjs/themes/prism-tomorrow.css"; // dark theme

const ChartOfAccounts = () => {
    const [coaList, setCoaList] = useState([]);
    const [coaCode, setCoaCode] = useState("");
    const [coaName, setCoaName] = useState("");
    const [description, setDescription] = useState("");
    const [sqlScript, setSqlScript] = useState("-- Write SQL here\nSELECT * FROM table_name;");
    const [loading, setLoading] = useState(false);
    const [formVisible, setFormVisible] = useState(false);
    const [editingCoa, setEditingCoa] = useState(null);

    // Search & Pagination
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Fetch COAs
    const fetchCOAs = async () => {
        try {
            const res = await api.get("/api/coa");
            setCoaList(res.data || []);
        } catch (err) {
            console.error("Failed to fetch COAs:", err);
        }
    };

    useEffect(() => {
        fetchCOAs();
    }, []);

    // SQL Sanitizer Functions
    const removeComments = (sql) => {
        let cleaned = sql.replace(/--.*$/gm, "");
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
        return cleaned;
    };

    const normalizeSQL = (sql) => {
        return sql
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .join(" ");
    };

    const isSelectOnly = (sql) => {
        const firstWord = sql.trim().split(" ")[0].toUpperCase();
        return firstWord === "SELECT";
    };

    // Reset Form
    const resetForm = () => {
        setEditingCoa(null);
        setCoaCode("");
        setCoaName("");
        setDescription("");
        setSqlScript("-- Write SQL here\n");
        setFormVisible(false);
    };

    // Handle Add
    const handleAddCOA = async () => {
        if (!coaCode.trim() || !coaName.trim() || !sqlScript.trim()) {
            alert("Please fill required fields (code, name, SQL).");
            return;
        }

        let cleanedSQL = removeComments(sqlScript);
        cleanedSQL = normalizeSQL(cleanedSQL);

        if (!isSelectOnly(cleanedSQL)) {
            alert("Only SELECT statements are allowed. Comments and other statements are removed.");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                coaCode: coaCode.trim(),
                coaName: coaName.trim(),
                description: description.trim(),
                sqlScript: cleanedSQL,
                createdBy: "admin",
            };
            const res = await api.post("/api/coa", payload);
            setCoaList([...coaList, res.data || payload]);
            alert("COA added successfully!");
            resetForm();
        } catch (err) {
            console.error(err);
            alert("Failed to add COA.");
        } finally {
            setLoading(false);
        }
    };

    // Handle Update
    const handleUpdateCOA = async () => {
        if (!editingCoa) return;

        let cleanedSQL = removeComments(sqlScript);
        cleanedSQL = normalizeSQL(cleanedSQL);
        if (!isSelectOnly(cleanedSQL)) {
            alert("Only SELECT statements are allowed.");
            return;
        }

        setLoading(true);
        try {
            const res = await api.put(`/api/coa/${editingCoa.coaId}`, {
                coaCode,
                coaName,
                description,
                sqlScript: cleanedSQL,
                createdBy: editingCoa.createdBy,
            });
            setCoaList((prev) =>
                prev.map((c) => (c.coaId === editingCoa.coaId ? res.data : c))
            );
            alert("COA updated successfully!");
            resetForm();
        } catch (err) {
            console.error(err);
            alert("Failed to update COA.");
        } finally {
            setLoading(false);
        }
    };

    // Handle Delete
    const handleDeleteCOA = async () => {
        if (!editingCoa) return;
        if (!window.confirm("Are you sure you want to delete this COA?")) return;

        setLoading(true);
        try {
            await api.delete(`/api/coa/${editingCoa.coaId}`);
            setCoaList((prev) => prev.filter((c) => c.coaId !== editingCoa.coaId));
            alert("COA deleted successfully!");
            resetForm();
        } catch (err) {
            console.error(err);
            alert("Failed to delete COA.");
        } finally {
            setLoading(false);
        }
    };

    // Filter and paginate COAs
    const filteredCoas = coaList.filter((c) =>
        c.coaCode.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalPages = Math.ceil(filteredCoas.length / itemsPerPage);
    const paginatedCoas = filteredCoas.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    return (
        <div className="flex flex-col h-[calc(100vh-5rem)] max-w-6xl mx-auto">
            {/* Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-4 z-30 shadow-sm flex justify-between items-center flex-shrink-0">
                <h2 className="text-3xl font-extrabold text-gray-800">📚 Chart of Accounts</h2>
                <button
                    onClick={() => setFormVisible(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 transition flex items-center gap-2"
                >
                    <Plus size={16} /> <span>Add New COA</span>
                </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                {/* Cards Header with Search */}
                <div className="mt-4 mb-4 flex justify-between items-center">
                    <h3 className="text-2xl font-bold text-gray-700">
                        Listed Chart of Accounts ({filteredCoas.length})
                    </h3>
                    <input
                        type="text"
                        placeholder="Search by COA Code..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="border rounded-lg px-3 py-1 outline-none focus:ring-2 focus:ring-blue-200"
                    />
                </div>

                {/* Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-10">
                    {paginatedCoas.length === 0 && (
                        <p className="col-span-full text-center text-gray-500 p-10 italic">
                            No Chart of Accounts found.
                        </p>
                    )}

                    {paginatedCoas.map((c, idx) => (
                        <div key={c.coaId || idx} className="p-6 bg-white rounded-xl shadow-lg border flex flex-col">
                            <div className="flex justify-between items-start gap-4">
                                <div>
                                    <p className="text-2xl font-extrabold text-blue-800">{c.coaCode}</p>
                                    <p className="text-sm text-gray-500 mt-1">{c.coaName}</p>
                                </div>
                            </div>

                            <p className="mt-3 text-gray-600 italic border-l-4 pl-3">
                                <span className="font-bold not-italic">Description:</span> {c.description || "No description provided."}
                            </p>

                            <div className="mt-4">
                                <p className="text-xs font-semibold text-gray-500 mb-1">SQL</p>
                                <pre className="bg-gray-700 border border-gray-800 p-4 rounded-lg text-sm text-emerald-200 font-mono overflow-auto max-h-44">
                                    <code>{c.sqlScript}</code>
                                </pre>
                            </div>

                            <p className="text-right text-xs text-gray-400 mt-3">Created by: {c.createdBy || "N/A"}</p>

                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={() => {
                                        setEditingCoa(c);
                                        setCoaCode(c.coaCode);
                                        setCoaName(c.coaName);
                                        setDescription(c.description);
                                        setSqlScript(c.sqlScript);
                                        setFormVisible(true);
                                    }}
                                    className="px-4 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition"
                                >
                                    Edit
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-4">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            className="px-3 py-1 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-shadow shadow-sm"
                        >
                            Prev
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`px-3 py-1 rounded-lg border border-gray-300 shadow-sm transition ${currentPage === page
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                                    }`}
                            >
                                {page}
                            </button>
                        ))}

                        <button
                            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                            className="px-3 py-1 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-shadow shadow-sm"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {/* Modal Form */}
            {formVisible && (
                <div
                    className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center"
                    onClick={resetForm}
                >
                    <div
                        className="bg-white rounded-xl shadow-xl w-full max-w-5xl relative p-8 translate-x-40"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={resetForm}
                            className="absolute top-4 right-4 text-gray-700 hover:text-red-600"
                            title="Close Form"
                        >
                            <X size={24} />
                        </button>

                        <h3 className="text-2xl font-bold mb-4 text-blue-600">
                            {editingCoa ? "Edit COA" : "Add New COA"}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label>
                                <span className="text-gray-700 font-medium">COA Code</span>
                                <input
                                    type="text"
                                    value={coaCode}
                                    onChange={(e) => setCoaCode(e.target.value)}
                                    placeholder="e.g. 1000-Assets-Cash"
                                    className="mt-1 border p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </label>
                            <label>
                                <span className="text-gray-700 font-medium">COA Name</span>
                                <input
                                    type="text"
                                    value={coaName}
                                    onChange={(e) => setCoaName(e.target.value)}
                                    placeholder="e.g. Cash"
                                    className="mt-1 border p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </label>
                        </div>

                        <label className="block mt-4">
                            <span className="text-gray-700 font-medium">Description</span>
                            <textarea
                                rows={2}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="mt-1 border p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-blue-200"
                                placeholder="Optional description"
                            />
                        </label>

                        {/* SQL Editor with line numbers */}
                        <div className="mt-6 flex border rounded-lg shadow-lg overflow-hidden bg-[#1e1e1e]">
                            <div className="bg-[#1e1e1e] text-gray-500 text-right py-3 px-3 select-none" style={{ lineHeight: "1.5rem" }}>
                                {sqlScript.split("\n").map((_, i) => (<div key={i}>{i + 1}</div>))}
                            </div>
                            <Editor
                                value={sqlScript}
                                onValueChange={setSqlScript}
                                highlight={(code) => highlight(code, languages.sql)}
                                padding={12}
                                style={{
                                    fontFamily: '"Fira code", "Fira Mono", monospace',
                                    fontSize: 14,
                                    color: "#d4d4d4",
                                    backgroundColor: "#1e1e1e",
                                    flex: 1,
                                    minHeight: 180,
                                    overflow: "auto",
                                    whiteSpace: "pre",
                                }}
                            />
                        </div>

                        <div className="mt-6 flex items-center gap-3">
                            <button
                                onClick={editingCoa ? handleUpdateCOA : handleAddCOA}
                                disabled={loading}
                                className={`px-6 py-2 rounded-lg font-semibold shadow-md transition ${loading ? "bg-gray-400 text-gray-100" : "bg-blue-600 text-white hover:bg-blue-700 hover:scale-105"
                                    }`}
                            >
                                {loading ? "Saving..." : editingCoa ? "Update COA" : "Add COA"}
                            </button>

                            {editingCoa && (
                                <button
                                    onClick={handleDeleteCOA}
                                    className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
                                >
                                    Delete COA
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChartOfAccounts;