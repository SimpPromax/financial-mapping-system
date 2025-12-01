import React, { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-sql";
import "prismjs/themes/prism-tomorrow.css";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const ChartOfAccounts = () => {
  const [coaList, setCoaList] = useState([]);
  const [coaCode, setCoaCode] = useState("");
  const [coaName, setCoaName] = useState("");
  const [description, setDescription] = useState("");
  const [sqlScript, setSqlScript] = useState("-- Write SQL here\nSELECT * FROM table_name;");
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingCoa, setEditingCoa] = useState(null);
  const [isCodeDuplicate, setIsCodeDuplicate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [coaValidationStatus, setCoaValidationStatus] = useState({});
  const [expandedCards, setExpandedCards] = useState({});
  const [validationErrors, setValidationErrors] = useState({});

  const cardsContainerRef = useRef(null);

  // Fetch COAs
  const fetchCOAs = async () => {
    try {
      const res = await api.get("/api/coa");
      setCoaList(res.data || []);
    } catch (err) {
      console.error("Failed to fetch COAs:", err);
      Swal.fire({ icon: "error", title: "Error", text: "Failed to fetch COAs." });
    }
  };

  useEffect(() => {
    fetchCOAs();
  }, []);

  // Validate all COAs for cards
  const validateAllCoas = async () => {
    const results = {};
    for (const c of coaList) {
      try {
        const res = await api.post("/api/coa/validate-sql", { sqlScript: c.sqlScript });
        results[c.coaId] = res.data.valid;
      } catch (err) {
        results[c.coaId] = false, err;
      }
    }
    setCoaValidationStatus(results);
  };

  useEffect(() => {
    if (coaList.length > 0) validateAllCoas();
  }, [coaList]);

  // Toggle card expansion
  const toggleCardExpansion = (coaId) => {
    setExpandedCards(prev => ({
      ...prev,
      [coaId]: !prev[coaId]
    }));
  };

  // Helpers
  const removeComments = (sql) => {
    if (!sql) return "";
    let cleaned = sql.replace(/--.*$/gm, "");
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
    return cleaned;
  };

  const normalizeSQL = (sql) => {
    if (!sql) return "";
    return sql
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join(" ");
  };

  const isSelectOnly = (sql) => {
    if (!sql) return false;
    const cleaned = removeComments(sql);
    const normalized = normalizeSQL(cleaned);
    if (!normalized) return false;
    const firstWord = normalized.trim().split(/\s+/)[0].toUpperCase();
    return firstWord === "SELECT";
  };

  const checkForDuplicateCode = (code) => {
    if (!code.trim()) {
      setIsCodeDuplicate(false);
      return;
    }
    const exists = coaList.some(
      (c) =>
        c.coaCode?.toLowerCase() === code.trim().toLowerCase() &&
        c.coaId !== (editingCoa?.coaId || null)
    );
    setIsCodeDuplicate(exists);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkForDuplicateCode(coaCode);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [coaCode, coaList, editingCoa]);

  const resetForm = () => {
    setEditingCoa(null);
    setCoaCode("");
    setCoaName("");
    setDescription("");
    setSqlScript("-- Write SQL here\nSELECT * FROM table_name;");
    setFormVisible(false);
    setIsCodeDuplicate(false);
    setValidationResult(null);
    setValidationErrors({});
  };

  const toastSuccess = (message) => {
    Swal.fire({ icon: "success", title: message, toast: true, position: "top-end", timer: 1500, showConfirmButton: false });
  };

  const toastError = (message) => {
    Swal.fire({ icon: "error", title: "Error", text: message });
  };

  // Validate form fields
  const validateForm = () => {
    const errors = {};
    
    if (!coaCode.trim()) {
      errors.coaCode = "COA Code is required";
    }
    
    if (!coaName.trim()) {
      errors.coaName = "COA Name is required";
    }
    
    const trimmedSQL = sqlScript.trim();
    if (!trimmedSQL || trimmedSQL === "-- Write SQL here\n") {
      errors.sqlScript = "SQL Script is required";
    } else if (!isSelectOnly(trimmedSQL)) {
      errors.sqlScript = "Only SELECT statements are allowed";
    }
    
    if (isCodeDuplicate) {
      errors.coaCode = "A COA with this code already exists";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddCOA = async () => {
    if (!validateForm()) {
      return;
    }

    const trimmedCode = coaCode.trim();
    const trimmedName = coaName.trim();
    const trimmedSQL = sqlScript.trim();

    setLoading(true);
    try {
      const cleanedSQL = normalizeSQL(removeComments(trimmedSQL));
      
      const payload = {
        coaCode: trimmedCode,
        coaName: trimmedName,
        description: description.trim(),
        sqlScript: cleanedSQL,
        createdBy: "admin"
      };
      
      const res = await api.post("/api/coa", payload);
      const newItem = res.data || payload;
      setCoaList((prev) => [...prev, newItem]);
      toastSuccess("COA added successfully");
      resetForm();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        toastError("A COA with this code already exists");
      } else {
        toastError("Failed to add COA. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCOA = async () => {
    if (!editingCoa) return;
    
    if (!validateForm()) {
      return;
    }

    const trimmedCode = coaCode.trim();
    const trimmedName = coaName.trim();
    const trimmedSQL = sqlScript.trim();

    setLoading(true);
    try {
      const cleanedSQL = normalizeSQL(removeComments(trimmedSQL));
      
      const res = await api.put(`/api/coa/${editingCoa.coaId}`, {
        coaCode: trimmedCode,
        coaName: trimmedName,
        description: description.trim(),
        sqlScript: cleanedSQL,
        createdBy: editingCoa.createdBy,
      });
      
      const updated = res.data || { ...editingCoa, coaCode: trimmedCode, coaName: trimmedName, description: description.trim(), sqlScript: cleanedSQL };
      setCoaList((prev) => prev.map((c) => (c.coaId === editingCoa.coaId ? updated : c)));
      toastSuccess("COA updated successfully");
      resetForm();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        toastError("Another COA already uses this code");
      } else {
        toastError("Failed to update COA. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCOA = async () => {
    if (!editingCoa) return;
    const result = await Swal.fire({
      title: "Delete COA?",
      text: `Are you sure you want to delete "${editingCoa.coaCode}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      confirmButtonColor: "#dc2626",
      cancelButtonText: "Cancel",
    });
    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      await api.delete(`/api/coa/${editingCoa.coaId}`);
      setCoaList((prev) => prev.filter((c) => c.coaId !== editingCoa.coaId));
      toastSuccess("COA deleted successfully");
      resetForm();
    } catch (err) {
      console.error(err);
      toastError("Failed to delete COA. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Filter & paginate
  const filteredCoas = coaList.filter((c) => (c.coaCode || "").toLowerCase().includes(searchQuery.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filteredCoas.length / itemsPerPage));
  const paginatedCoas = filteredCoas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [filteredCoas.length, totalPages]);

  const validateSQL = async () => {
    const trimmedSQL = sqlScript.trim();
    
    if (!trimmedSQL || trimmedSQL === "-- Write SQL here\n") {
      setValidationResult({ valid: false, error: "SQL Script is required" });
      return;
    }
    
    if (!isSelectOnly(trimmedSQL)) {
      setValidationResult({ valid: false, error: "Only SELECT statements are allowed" });
      return;
    }
    
    setValidating(true);
    try {
      const cleanedSQL = normalizeSQL(removeComments(trimmedSQL));
      const res = await api.post("/api/coa/validate-sql", { sqlScript: cleanedSQL });
      setValidationResult(res.data);
    } catch (err) {
      setValidationResult({ valid: false, error: err.response?.data?.message || err.message || "Validation failed" });
    } finally {
      setValidating(false);
    }
  };

  // Calculate SQL text height dynamically
  const getSQLHeight = (sql) => {
    if (!sql) return "min-h-[60px]";
    const lines = sql.split('\n').length;
    if (lines <= 3) return "min-h-[60px]";
    if (lines <= 6) return "min-h-[100px]";
    if (lines <= 10) return "min-h-[140px]";
    return "min-h-[180px]";
  };

  // Handle SQL script change
  const handleSqlScriptChange = (value) => {
    setSqlScript(value);
    // Clear validation result when SQL changes
    if (validationResult) {
      setValidationResult(null);
    }
  };

  return (
    <div className="flex flex-col h-[84vh] max-w-6xl mx-auto relative">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-4 z-30 shadow-sm flex justify-between items-center shrink-0">
        <h2 className="text-3xl font-extrabold text-gray-800">📚 Chart of Accounts</h2>
        <button
          onClick={() => { resetForm(); setFormVisible(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 transition flex items-center gap-2"
        >
          <Plus size={16} /> <span>Add New COA</span>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        <div className="mt-4 mb-4 flex justify-between items-center">
          <h3 className="text-2xl font-bold text-gray-700">
            Listed Chart of Accounts ({filteredCoas.length})
          </h3>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 select-none">🔍</span>
            <input
              type="text"
              placeholder="Search by COA Code..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl bg-white text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all w-64 placeholder-gray-400 hover:border-blue-400"
            />
          </div>
        </div>

        {/* Cards - Now with variable height */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20" ref={cardsContainerRef}>
          {paginatedCoas.length === 0 && (
            <p className="col-span-full text-center text-gray-500 p-10 italic">No Chart of Accounts found.</p>
          )}
          {paginatedCoas.map((c, idx) => (
            <div 
              key={c.coaId || idx} 
              className={`bg-white rounded-xl shadow-lg border flex flex-col transition-all duration-300 ${
                expandedCards[c.coaId] ? 'min-h-[350px]' : 'min-h-[250px]'
              }`}
            >
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <p className="text-2xl font-extrabold text-blue-800 wrap-break-word">{c.coaCode}</p>
                    <p className="text-sm text-gray-500 mt-1 wrap-break-word">{c.coaName}</p>
                  </div>
                  <button
                    onClick={() => toggleCardExpansion(c.coaId)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title={expandedCards[c.coaId] ? "Collapse" : "Expand"}
                  >
                    {expandedCards[c.coaId] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>
                
                {/* Description - Now expands with content */}
                <div className={`mt-3 transition-all duration-300 ${expandedCards[c.coaId] ? 'max-h-96' : 'max-h-20'} overflow-hidden`}>
                  <p className="text-gray-600 wrap-break-word">
                    <span className="font-bold">Description:</span> {c.description || "No description provided."}
                  </p>
                </div>
                
                {/* SQL Section - Expands based on content */}
                <div className="mt-4 flex-1 flex flex-col min-h-0">
                  <p className="text-xs font-semibold text-gray-500 mb-1 flex justify-between items-center">
                    SQL
                    {coaValidationStatus[c.coaId] !== undefined && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${coaValidationStatus[c.coaId] ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {coaValidationStatus[c.coaId] ? "Valid" : "Invalid"}
                      </span>
                    )}
                  </p>
                  
                  {/* SQL Code Block - Dynamic height */}
                  <div className={`flex-1 bg-gray-800 border border-gray-800 rounded-lg overflow-auto transition-all duration-300 ${
                    expandedCards[c.coaId] ? 'max-h-72' : getSQLHeight(c.sqlScript)
                  }`}>
                    <pre className="p-4 text-sm text-emerald-200 font-mono whitespace-pre-wrap wrap-break-word">
                      <code>{c.sqlScript}</code>
                    </pre>
                  </div>
                </div>
                
                <p className="text-right text-xs text-gray-400 mt-3">Created by: {c.createdBy || "N/A"}</p>
              </div>
              
              {/* Edit Button - Always visible at bottom */}
              <div className="p-6 pt-0 mt-auto">
                <div className="mt-4 flex justify-end border-t pt-4">
                  <button
                    onClick={() => {
                      setEditingCoa(c);
                      setCoaCode(c.coaCode || "");
                      setCoaName(c.coaName || "");
                      setDescription(c.description || "");
                      setSqlScript(c.sqlScript || "-- Write SQL here\n");
                      setFormVisible(true);
                    }}
                    className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Pagination */}
      {totalPages > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
          <div className="inline-flex flex-wrap justify-center items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-gray-300 rounded-xl shadow-md px-3 py-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              className={`px-3 py-1 rounded-lg border transition ${currentPage === 1
                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700"
                }`}
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 rounded-lg border transition ${currentPage === page
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700"
                  }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              className={`px-3 py-1 rounded-lg border transition ${currentPage === totalPages
                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700"
                }`}
            >
              Next
            </button>
          </div>
        </div>
      )}

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
                <span className="text-gray-700 font-medium">COA Code *</span>
                <input
                  type="text"
                  value={coaCode}
                  onChange={(e) => setCoaCode(e.target.value)}
                  placeholder="e.g. 1000-Assets-Cash"
                  className={`mt-1 border p-3 rounded-lg w-full outline-none focus:ring-2 ${
                    validationErrors.coaCode 
                      ? "border-red-500 focus:ring-red-200" 
                      : isCodeDuplicate 
                      ? "border-yellow-500 focus:ring-yellow-200" 
                      : "border-gray-300 focus:ring-blue-200"
                  }`}
                />
                {validationErrors.coaCode && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.coaCode}</p>
                )}
                {isCodeDuplicate && !validationErrors.coaCode && (
                  <p className="mt-1 text-sm text-yellow-600">
                    A COA with this code already exists.
                  </p>
                )}
              </label>

              <label>
                <span className="text-gray-700 font-medium">COA Name *</span>
                <input
                  type="text"
                  value={coaName}
                  onChange={(e) => setCoaName(e.target.value)}
                  placeholder="e.g. Cash"
                  className={`mt-1 border p-3 rounded-lg w-full outline-none focus:ring-2 ${
                    validationErrors.coaName 
                      ? "border-red-500 focus:ring-red-200" 
                      : "border-gray-300 focus:ring-blue-200"
                  }`}
                />
                {validationErrors.coaName && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.coaName}</p>
                )}
              </label>
            </div>

            <label className="block mt-4">
              <span className="text-gray-700 font-medium">Description</span>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 border p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-blue-200 border-gray-300"
                placeholder="Optional description"
              />
            </label>

            <label className="block mt-4">
              <span className="text-gray-700 font-medium">SQL Script *</span>
              <div className={`mt-2 flex border rounded-lg shadow-lg overflow-hidden bg-[#1e1e1e] ${
                validationErrors.sqlScript ? 'border-red-500' : 'border-gray-300'
              }`}>
                <div className="bg-[#1e1e1e] text-gray-500 text-right py-3 px-3 select-none" style={{ lineHeight: "1.5rem" }}>
                  {sqlScript.split("\n").map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <Editor
                  value={sqlScript}
                  onValueChange={handleSqlScriptChange}
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
              {validationErrors.sqlScript && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.sqlScript}</p>
              )}
            </label>

            {/* Validation Button */}
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={validateSQL}
                disabled={validating || !sqlScript.trim()}
                className={`px-4 py-1 rounded-lg font-semibold shadow-md transition ${
                  validating || !sqlScript.trim()
                    ? "bg-gray-400 text-gray-100 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700 hover:scale-105"
                }`}
              >
                {validating ? "Validating..." : "Validate SQL"}
              </button>
              {validationResult && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  validationResult.valid 
                    ? "bg-green-100 text-green-700" 
                    : "bg-red-100 text-red-700"
                }`}>
                  {validationResult.valid ? "Valid SQL" : `Invalid SQL${validationResult.error ? `: ${validationResult.error}` : ""}`}
                </span>
              )}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={editingCoa ? handleUpdateCOA : handleAddCOA}
                disabled={loading}
                className={`px-6 py-2 rounded-lg font-semibold shadow-md transition ${
                  loading
                    ? "bg-gray-400 text-gray-100 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 hover:scale-105"
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
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartOfAccounts;