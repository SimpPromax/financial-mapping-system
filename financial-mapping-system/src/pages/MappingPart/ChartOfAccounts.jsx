import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "../../services/api";
import { Plus, X, ChevronDown, ChevronUp, History, FileText, AlertCircle, Database, CheckCircle, XCircle, Calendar } from "lucide-react";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-sql";
import "prismjs/themes/prism-tomorrow.css";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

// Constants
const INITIAL_SQL = "-- Write SQL here\nSELECT * FROM table_name;";
const DEFAULT_ITEMS_PER_PAGE = 4;
const BATCH_SIZE = 5;
const DEBOUNCE_DELAY = 300;

// Common SQL placeholders to replace with dummy values for validation
const SQL_PLACEHOLDERS = {
  ':startDate': "'2024-01-01'",
  ':endDate': "'2024-12-31'",
  ':date': "'2024-06-15'",
  ':userId': "1",
  ':companyId': "1",
  ':accountId': "1000",
  ':period': "'2024-Q1'",
  ':year': "2024",
  ':month': "6",
  ':status': "'ACTIVE'",
  ':type': "'ASSET'",
  ':limit': "100",
  ':offset': "0"
};

// SQL Dangerous Patterns
const DANGEROUS_SQL_PATTERNS = [
  /DROP\s+(TABLE|DATABASE|INDEX|VIEW)\s+/i,
  /DELETE\s+FROM/i,
  /INSERT\s+INTO/i,
  /UPDATE\s+\w+\s+SET/i,
  /TRUNCATE\s+TABLE/i,
  /CREATE\s+(TABLE|DATABASE|INDEX|VIEW)\s+/i,
  /ALTER\s+(TABLE|DATABASE)\s+/i,
  /GRANT\s+/i,
  /REVOKE\s+/i,
  /EXEC\s+/i,
  /EXECUTE\s+/i,
  /;\s*--/i,
  /\/\*.*\*\//gs,
];

const ChartOfAccounts = () => {
  const [coaList, setCoaList] = useState([]);
  const [coaCode, setCoaCode] = useState("");
  const [coaName, setCoaName] = useState("");
  const [description, setDescription] = useState("");
  const [sqlScript, setSqlScript] = useState(INITIAL_SQL);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [editingCoa, setEditingCoa] = useState(null);
  const [isCodeDuplicate, setIsCodeDuplicate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [coaValidationStatus, setCoaValidationStatus] = useState({});
  const [expandedCards, setExpandedCards] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [showHistory, setShowHistory] = useState(false);
  const [versionHistory, setVersionHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [fetchingCOAs, setFetchingCOAs] = useState(false);
  const [showPlaceholderHelp, setShowPlaceholderHelp] = useState(false);

  const cardsContainerRef = useRef(null);
  const validationTimeoutsRef = useRef({});

  // Function to replace SQL placeholders with dummy values
  const replacePlaceholders = useCallback((sql) => {
    if (!sql) return sql;

    let processedSQL = sql;

    // Replace all placeholders with their dummy values
    Object.entries(SQL_PLACEHOLDERS).forEach(([placeholder, value]) => {
      // Create regex that matches the placeholder as a whole word
      const regex = new RegExp(`\\${placeholder}\\b`, 'g');
      processedSQL = processedSQL.replace(regex, value);
    });

    // Also handle generic parameter placeholders like :param1, :param2, etc.
    // Replace any remaining :paramName with appropriate dummy values based on name
    processedSQL = processedSQL.replace(/:(\w+)\b/g, (match, paramName) => {
      const lowerParam = paramName.toLowerCase();

      // Check for date-related parameters
      if (lowerParam.includes('date') || lowerParam.includes('time')) {
        return "'2024-06-15'";
      }

      // Check for numeric parameters
      if (lowerParam.includes('id') || lowerParam.includes('num') || lowerParam.includes('count')) {
        return "1";
      }

      // Check for string parameters
      if (lowerParam.includes('name') || lowerParam.includes('status') || lowerParam.includes('type')) {
        return `'DUMMY_${paramName.toUpperCase()}'`;
      }

      // Default to string value
      return `'DUMMY_VALUE'`;
    });

    return processedSQL;
  }, []);

  // Fetch COAs
  const fetchCOAs = useCallback(async () => {
    setFetchingCOAs(true);
    try {
      const res = await api.get("/api/coa");
      setCoaList(res.data || []);
    } catch (err) {
      console.error("Failed to fetch COAs:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to fetch COAs. Please try again.",
        confirmButtonColor: "#2563eb"
      });
    } finally {
      setFetchingCOAs(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCOAs();
  }, [fetchCOAs]);

  // SQL Security Functions
  const sanitizeSQL = useCallback((sql) => {
    if (!sql) return "";

    let cleaned = sql;

    // Check for dangerous patterns
    for (const pattern of DANGEROUS_SQL_PATTERNS) {
      if (pattern.test(cleaned)) {
        throw new Error("Potentially dangerous SQL detected. Only SELECT statements are allowed.");
      }
    }

    // Remove comments
    cleaned = cleaned.replace(/--.*$/gm, "");
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");

    return cleaned;
  }, []);

  const normalizeSQL = useCallback((sql) => {
    if (!sql) return "";
    return sql
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join(" ");
  }, []);

  const isSelectOnly = useCallback((sql) => {
    if (!sql) return false;
    try {
      const cleaned = sanitizeSQL(sql);
      const normalized = normalizeSQL(cleaned);
      if (!normalized) return false;
      const firstWord = normalized.trim().split(/\s+/)[0].toUpperCase();
      return firstWord === "SELECT";
    } catch {
      return false;
    }
  }, [sanitizeSQL, normalizeSQL]);

  // Validate single COA with placeholder handling
  const validateSingleCoa = useCallback(async (coa) => {
    if (!coa || !coa.coaId || !coa.sqlScript) return { [coa.coaId]: false };

    try {
      // Replace placeholders before sanitizing
      const sqlWithPlaceholdersReplaced = replacePlaceholders(coa.sqlScript);
      const cleanedSQL = normalizeSQL(sanitizeSQL(sqlWithPlaceholdersReplaced));

      const res = await api.post("/api/coa/validate-sql", {
        sqlScript: cleanedSQL
      });
      return { [coa.coaId]: res.data.valid };
    } catch (err) {
      return { [coa.coaId]: false };
    }
  }, [normalizeSQL, sanitizeSQL, replacePlaceholders]);

  // Validate all COAs in batches
  const validateAllCoas = useCallback(async () => {
    if (!coaList.length) return;

    const results = {};

    try {
      // Process in batches
      for (let i = 0; i < coaList.length; i += BATCH_SIZE) {
        const batch = coaList.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(coa => validateSingleCoa(coa));
        const batchResults = await Promise.all(batchPromises);

        batchResults.forEach(result => {
          Object.assign(results, result);
        });

        // Update state after each batch for progressive UI update
        setCoaValidationStatus(prev => ({ ...prev, ...results }));
      }
    } catch (err) {
      console.error("Batch validation failed:", err);
    }
  }, [coaList, validateSingleCoa]);

  // Validate COAs when coaList changes (but not on initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (coaList.length > 0) {
      validateAllCoas();
    }
  }, [coaList, validateAllCoas]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(validationTimeoutsRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  // Toggle card expansion
  const toggleCardExpansion = useCallback((coaId) => {
    setExpandedCards(prev => ({
      ...prev,
      [coaId]: !prev[coaId]
    }));
  }, []);

  // Check for duplicate code with debounce
  const checkForDuplicateCode = useCallback((code) => {
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

    // Clear validation error for coaCode if duplicate check passes
    if (!exists && validationErrors.coaCode?.includes("already exists")) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.coaCode;
        return newErrors;
      });
    }
  }, [coaList, editingCoa, validationErrors]);

  // Debounced duplicate check
  useEffect(() => {
    if (validationTimeoutsRef.current.duplicateCheck) {
      clearTimeout(validationTimeoutsRef.current.duplicateCheck);
    }

    validationTimeoutsRef.current.duplicateCheck = setTimeout(() => {
      checkForDuplicateCode(coaCode);
    }, DEBOUNCE_DELAY);

    return () => {
      if (validationTimeoutsRef.current.duplicateCheck) {
        clearTimeout(validationTimeoutsRef.current.duplicateCheck);
      }
    };
  }, [coaCode, checkForDuplicateCode]);

  // Reset form
  const resetForm = useCallback(() => {
    setEditingCoa(null);
    setCoaCode("");
    setCoaName("");
    setDescription("");
    setSqlScript(INITIAL_SQL);
    setFormVisible(false);
    setShowHistory(false);
    setIsCodeDuplicate(false);
    setValidationResult(null);
    setValidationErrors({});
  }, []);

  // Toast notifications
  const toastSuccess = useCallback((message) => {
    Swal.fire({
      icon: "success",
      title: message,
      toast: true,
      position: "top-end",
      timer: 1500,
      showConfirmButton: false
    });
  }, []);

  const toastError = useCallback((message) => {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: message,
      confirmButtonColor: "#2563eb"
    });
  }, []);

  // Validate form fields
  const validateForm = useCallback(() => {
    const errors = {};

    if (!coaCode.trim()) {
      errors.coaCode = "COA Code is required";
    }

    if (!coaName.trim()) {
      errors.coaName = "COA Name is required";
    }

    const trimmedSQL = sqlScript.trim();
    if (!trimmedSQL || trimmedSQL === INITIAL_SQL) {
      errors.sqlScript = "SQL Script is required";
    } else {
      try {
        if (!isSelectOnly(trimmedSQL)) {
          errors.sqlScript = "Only SELECT statements are allowed";
        }
      } catch (err) {
        errors.sqlScript = err.message || "Invalid SQL detected";
      }
    }

    if (isCodeDuplicate) {
      errors.coaCode = "A COA with this code already exists";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [coaCode, coaName, sqlScript, isCodeDuplicate, isSelectOnly]);

  // Fetch version history
  const fetchVersionHistory = useCallback(async (coaId) => {
    if (!coaId) return;

    setLoadingHistory(true);
    try {
      const res = await api.get(`/api/coa/${coaId}/versions`);
      setVersionHistory(res.data || []);
      setShowHistory(true);
    } catch (err) {
      console.error("Failed to fetch version history:", err);
      toastError("Failed to load version history");
    } finally {
      setLoadingHistory(false);
    }
  }, [toastError]);

  // Handle add COA
  const handleAddCOA = async () => {
    if (!validateForm()) {
      return;
    }

    const trimmedCode = coaCode.trim();
    const trimmedName = coaName.trim();
    const trimmedSQL = sqlScript.trim();

    setLoading(true);
    try {
      // Keep original SQL with placeholders for storage
      const cleanedSQL = normalizeSQL(sanitizeSQL(trimmedSQL));

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
      } else if (err.message.includes("dangerous SQL")) {
        toastError(err.message);
      } else {
        toastError("Failed to add COA. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle update COA
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
      // Keep original SQL with placeholders for storage
      const cleanedSQL = normalizeSQL(sanitizeSQL(trimmedSQL));

      const res = await api.put(`/api/coa/${editingCoa.coaId}`, {
        coaCode: trimmedCode,
        coaName: trimmedName,
        description: description.trim(),
        sqlScript: cleanedSQL,
        createdBy: editingCoa.createdBy,
      });

      const updated = res.data || {
        ...editingCoa,
        coaCode: trimmedCode,
        coaName: trimmedName,
        description: description.trim(),
        sqlScript: cleanedSQL
      };

      setCoaList((prev) => prev.map((c) => (c.coaId === editingCoa.coaId ? updated : c)));
      toastSuccess("COA updated successfully");
      resetForm();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        toastError("Another COA already uses this code");
      } else if (err.message.includes("dangerous SQL")) {
        toastError(err.message);
      } else {
        toastError("Failed to update COA. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle delete COA
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
      backdrop: true,
      allowOutsideClick: false,
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
  const filteredCoas = coaList.filter((c) =>
    (c.coaCode || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.coaName || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredCoas.length / DEFAULT_ITEMS_PER_PAGE));
  const paginatedCoas = filteredCoas.slice(
    (currentPage - 1) * DEFAULT_ITEMS_PER_PAGE,
    currentPage * DEFAULT_ITEMS_PER_PAGE
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [filteredCoas.length, totalPages, currentPage]);

  // Validate SQL with placeholder handling
  const validateSQL = async () => {
    const trimmedSQL = sqlScript.trim();

    if (!trimmedSQL || trimmedSQL === INITIAL_SQL) {
      setValidationResult({ valid: false, error: "SQL Script is required" });
      return;
    }

    try {
      if (!isSelectOnly(trimmedSQL)) {
        setValidationResult({ valid: false, error: "Only SELECT statements are allowed" });
        return;
      }
    } catch (err) {
      setValidationResult({ valid: false, error: err.message });
      return;
    }

    setValidating(true);
    try {
      // Replace placeholders before sending for validation
      const sqlWithPlaceholdersReplaced = replacePlaceholders(trimmedSQL);
      const cleanedSQL = normalizeSQL(sanitizeSQL(sqlWithPlaceholdersReplaced));

      const res = await api.post("/api/coa/validate-sql", { sqlScript: cleanedSQL });
      setValidationResult(res.data);
    } catch (err) {
      setValidationResult({
        valid: false,
        error: err.response?.data?.message || err.message || "Validation failed"
      });
    } finally {
      setValidating(false);
    }
  };

  // Calculate SQL text height dynamically
  const getSQLHeight = useCallback((sql) => {
    if (!sql) return "min-h-[60px]";
    const lines = sql.split('\n').length;
    if (lines <= 3) return "min-h-[60px]";
    if (lines <= 6) return "min-h-[100px]";
    if (lines <= 10) return "min-h-[140px]";
    return "min-h-[180px]";
  }, []);

  // Handle SQL script change
  const handleSqlScriptChange = (value) => {
    setSqlScript(value);
    // Clear validation result when SQL changes
    if (validationResult) {
      setValidationResult(null);
    }
    // Clear SQL validation error
    if (validationErrors.sqlScript) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.sqlScript;
        return newErrors;
      });
    }
  };

  // Refresh COAs
  const handleRefresh = () => {
    fetchCOAs();
  };

  // Function to detect placeholders in SQL
  const detectPlaceholders = (sql) => {
    if (!sql) return [];
    const placeholderRegex = /:(\w+)\b/g;
    const placeholders = [];
    let match;
    while ((match = placeholderRegex.exec(sql)) !== null) {
      if (!placeholders.includes(match[0])) {
        placeholders.push(match[0]);
      }
    }
    return placeholders;
  };

  // Insert placeholder helper
  const insertPlaceholder = (placeholder) => {
    const editor = document.querySelector('.react-simple-code-editor textarea');
    if (editor) {
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const newSql = sqlScript.substring(0, start) + placeholder + sqlScript.substring(end);
      setSqlScript(newSql);

      // Focus back on editor and set cursor position
      setTimeout(() => {
        editor.focus();
        editor.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 0);
    }
  };

  // Check if SQL contains placeholders
  const sqlPlaceholders = detectPlaceholders(sqlScript);

  return (
    <div className="flex flex-col h-[84vh] max-w-6xl mx-auto relative">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-4 z-30 shadow-sm flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-extrabold text-gray-800">📚 Chart of Accounts</h2>
          <span className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full">
            {coaList.length} Accounts
          </span>
          {fetchingCOAs && (
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              Loading...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-1"
            title="Refresh COAs"
            disabled={fetchingCOAs}
          >
            {fetchingCOAs ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-700"></div>
                Refreshing...
              </>
            ) : (
              "↻ Refresh"
            )}
          </button>
          <button
            onClick={() => { resetForm(); setFormVisible(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Add new Chart of Account"
            disabled={fetchingCOAs}
          >
            <Plus size={16} /> <span>Add New COA</span>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        <div className="mt-4 mb-6 flex justify-between items-center">
          <h3 className="text-2xl font-bold text-gray-700">
            Listed Chart of Accounts ({filteredCoas.length})
          </h3>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 select-none">🔍</span>
            <input
              type="text"
              placeholder="Search by COA Code or Name..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl bg-white text-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all w-64 placeholder-gray-400 hover:border-blue-400"
              aria-label="Search Chart of Accounts"
              disabled={fetchingCOAs}
            />
          </div>
        </div>

        {/* Loading State */}
        {fetchingCOAs && coaList.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Loading Chart of Accounts...</p>
          </div>
        )}

        {/* Empty State */}
        {!fetchingCOAs && coaList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="mb-6 p-6 bg-blue-50 rounded-full">
              <Database size={80} className="text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">No Chart of Accounts Found</h3>
            <p className="text-gray-600 mb-8 max-w-md">
              You haven't created any Chart of Accounts yet. Start by adding your first account to manage your financial data.
            </p>
            <button
              onClick={() => { resetForm(); setFormVisible(true); }}
              className="bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 transition flex items-center gap-2 text-lg font-semibold"
            >
              <Plus size={20} /> <span>Add New Chart of Account</span>
            </button>
          </div>
        )}

        {/* Cards */}
        {!fetchingCOAs && coaList.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20" ref={cardsContainerRef}>
            {paginatedCoas.length === 0 && coaList.length > 0 && (
              <div className="col-span-full text-center py-12">
                <AlertCircle className="inline-block text-yellow-500 mb-4" size={48} />
                <p className="text-gray-600 italic">No matching Chart of Accounts found for "{searchQuery}"</p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  Clear search
                </button>
              </div>
            )}

            {paginatedCoas.map((c, idx) => (
              <div
                key={c.coaId || idx}
                className={`bg-white rounded-xl shadow-lg border flex flex-col transition-all duration-300 ${expandedCards[c.coaId] ? 'min-h-[350px]' : 'min-h-[250px]'
                  }`}
                role="article"
                aria-label={`Chart of Account: ${c.coaCode}`}
              >
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-2xl font-extrabold text-blue-800 wrap-break-word">{c.coaCode}</p>
                        {coaValidationStatus[c.coaId] !== undefined && (
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${coaValidationStatus[c.coaId] ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                            {coaValidationStatus[c.coaId] ? (
                              <>
                                <CheckCircle size={12} /> Valid
                              </>
                            ) : (
                              <>
                                <XCircle size={12} /> Invalid
                              </>
                            )}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1 wrap-break-word">{c.coaName}</p>
                    </div>
                    <button
                      onClick={() => toggleCardExpansion(c.coaId)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      aria-expanded={expandedCards[c.coaId]}
                      aria-label={expandedCards[c.coaId] ? "Collapse details" : "Expand details"}
                    >
                      {expandedCards[c.coaId] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>

                  {/* Description */}
                  <div className={`mt-3 transition-all duration-300 ${expandedCards[c.coaId] ? 'max-h-96' : 'max-h-20'} overflow-hidden`}>
                    <p className="text-gray-600 wrap-break-word">
                      <span className="font-bold">Description:</span> {c.description || "No description provided."}
                    </p>
                  </div>

                  {/* SQL Section */}
                  <div className="mt-4 flex-1 flex flex-col min-h-0">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-xs font-semibold text-gray-500">SQL</p>
                      <button
                        onClick={() => fetchVersionHistory(c.coaId)}
                        className="text-xs text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1"
                        aria-label="View version history"
                      >
                        <History size={12} /> History
                      </button>
                    </div>

                    {/* SQL Code Block */}
                    <div className={`flex-1 bg-gray-800 border border-gray-800 rounded-lg overflow-auto transition-all duration-300 ${expandedCards[c.coaId] ? 'max-h-72' : getSQLHeight(c.sqlScript)
                      }`}>
                      <pre className="p-4 text-sm text-emerald-200 font-mono whitespace-pre-wrap wrap-break-word">
                        <code>{c.sqlScript}</code>
                      </pre>
                    </div>
                  </div>

                  <p className="text-right text-xs text-gray-400 mt-3">Created by: {c.createdBy || "N/A"}</p>
                </div>

                {/* Edit Button */}
                <div className="p-6 pt-0 mt-auto">
                  <div className="mt-4 flex justify-end gap-2 border-t pt-4">
                    <button
                      onClick={() => {
                        setEditingCoa(c);
                        setCoaCode(c.coaCode || "");
                        setCoaName(c.coaName || "");
                        setDescription(c.description || "");
                        setSqlScript(c.sqlScript || INITIAL_SQL);
                        setFormVisible(true);
                      }}
                      className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition flex items-center gap-2"
                      aria-label={`Edit ${c.coaCode}`}
                    >
                      <FileText size={16} /> Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Pagination */}
      {totalPages > 1 && coaList.length > 0 && !fetchingCOAs && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
          <div className="inline-flex flex-wrap justify-center items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-gray-300 rounded-xl shadow-md px-3 py-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded-lg border transition ${currentPage === 1
                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700"
                }`}
              aria-label="Previous page"
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
                aria-label={`Page ${page}`}
                aria-current={currentPage === page ? "page" : undefined}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded-lg border transition ${currentPage === totalPages
                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700"
                }`}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl relative p-8">
            <button
              onClick={() => setShowHistory(false)}
              className="absolute top-4 right-4 text-gray-700 hover:text-red-600"
              title="Close History"
              aria-label="Close version history"
            >
              <X size={24} />
            </button>

            <h3 className="text-2xl font-bold mb-4 text-blue-600 flex items-center gap-2">
              <History size={24} /> Version History
            </h3>

            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading version history...</p>
              </div>
            ) : versionHistory.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="inline-block text-gray-400 mb-4" size={48} />
                <p className="text-gray-600 italic">No version history available</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {versionHistory.map((version, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-gray-800">Version {versionHistory.length - idx}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(version.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Changed by:</span> {version.changedBy}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Change type:</span>
                        <span className={`ml-1 px-2 py-0.5 rounded text-xs ${version.changeType === 'CREATE' ? 'bg-green-100 text-green-700' : version.changeType === 'UPDATE' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {version.changeType}
                        </span>
                      </div>
                    </div>
                    {version.changes && Object.keys(version.changes).length > 0 && (
                      <div className="mt-3 text-sm">
                        <span className="font-medium text-gray-700">Changes:</span>
                        <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                          {JSON.stringify(version.changes, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit COA Modal */}
      {formVisible && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center"
          onClick={resetForm}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-5xl relative p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={resetForm}
              className="absolute top-4 right-4 text-gray-700 hover:text-red-600"
              title="Close Form"
              aria-label="Close form"
            >
              <X size={24} />
            </button>

            <h3 className="text-2xl font-bold mb-4 text-blue-600 flex items-center gap-2">
              {editingCoa ? <FileText size={24} /> : <Plus size={24} />}
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
                  className={`mt-1 border p-3 rounded-lg w-full outline-none focus:ring-2 ${validationErrors.coaCode
                      ? "border-red-500 focus:ring-red-200"
                      : isCodeDuplicate
                        ? "border-yellow-500 focus:ring-yellow-200"
                        : "border-gray-300 focus:ring-blue-200"
                    }`}
                  aria-invalid={!!validationErrors.coaCode || isCodeDuplicate}
                  aria-describedby={validationErrors.coaCode || isCodeDuplicate ? "coaCode-error" : undefined}
                />
                {validationErrors.coaCode && (
                  <p id="coaCode-error" className="mt-1 text-sm text-red-600">
                    {validationErrors.coaCode}
                  </p>
                )}
                {isCodeDuplicate && !validationErrors.coaCode && (
                  <p id="coaCode-error" className="mt-1 text-sm text-yellow-600">
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
                  className={`mt-1 border p-3 rounded-lg w-full outline-none focus:ring-2 ${validationErrors.coaName
                      ? "border-red-500 focus:ring-red-200"
                      : "border-gray-300 focus:ring-blue-200"
                    }`}
                  aria-invalid={!!validationErrors.coaName}
                  aria-describedby={validationErrors.coaName ? "coaName-error" : undefined}
                />
                {validationErrors.coaName && (
                  <p id="coaName-error" className="mt-1 text-sm text-red-600">
                    {validationErrors.coaName}
                  </p>
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
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700 font-medium">SQL Script *</span>
                <button
                  type="button"
                  onClick={() => setShowPlaceholderHelp(!showPlaceholderHelp)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Calendar size={14} />
                  {showPlaceholderHelp ? "Hide Placeholder Help" : "Show Placeholder Help"}
                </button>
              </div>

              {/* Placeholder Help Panel */}
              {showPlaceholderHelp && (
                <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-800 mb-2">SQL Placeholders Help</p>
                  <p className="text-sm text-blue-700 mb-2">
                    Use placeholders like :startDate, :endDate, :date in your SQL. These will be automatically replaced with dummy values during validation.
                  </p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {Object.keys(SQL_PLACEHOLDERS).slice(0, 6).map(placeholder => (
                      <button
                        key={placeholder}
                        type="button"
                        onClick={() => insertPlaceholder(placeholder)}
                        className="px-2 py-1 text-xs bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-50 transition"
                      >
                        {placeholder}
                      </button>
                    ))}
                  </div>
                  {sqlPlaceholders.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <p className="text-xs font-medium text-blue-800">Detected Placeholders:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {sqlPlaceholders.map(placeholder => (
                          <span key={placeholder} className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                            {placeholder}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className={`mt-2 flex border rounded-lg shadow-lg overflow-hidden bg-[#1e1e1e] ${validationErrors.sqlScript ? 'border-red-500' : 'border-gray-300'
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
                  aria-label="SQL Script Editor"
                />
              </div>
              {validationErrors.sqlScript && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.sqlScript}</p>
              )}

              {/* Placeholder detection notice */}
              {sqlPlaceholders.length > 0 && !showPlaceholderHelp && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-green-600" />
                    <span className="text-sm text-green-700">
                      {sqlPlaceholders.length} placeholder{sqlPlaceholders.length > 1 ? 's' : ''} detected. These will be replaced with dummy values during validation.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPlaceholderHelp(true)}
                    className="text-xs text-green-700 hover:text-green-900 underline"
                  >
                    View details
                  </button>
                </div>
              )}
            </label>

            {/* Validation Button */}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={validateSQL}
                disabled={validating || !sqlScript.trim() || sqlScript.trim() === INITIAL_SQL}
                className={`px-4 py-2 rounded-lg font-semibold shadow-md transition flex items-center gap-2 ${validating || !sqlScript.trim() || sqlScript.trim() === INITIAL_SQL
                    ? "bg-gray-400 text-gray-100 cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700 hover:scale-105"
                  }`}
                aria-label="Validate SQL"
              >
                {validating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Validating...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} /> Validate SQL
                  </>
                )}
              </button>

              {validationResult && (
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 ${validationResult.valid
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                    }`}>
                    {validationResult.valid ? (
                      <>
                        <CheckCircle size={14} /> Valid SQL
                      </>
                    ) : (
                      <>
                        <AlertCircle size={14} /> Invalid SQL
                      </>
                    )}
                  </span>
                  {validationResult.error && !validationResult.valid && (
                    <span className="text-sm text-red-600">
                      {validationResult.error}
                    </span>
                  )}
                </div>
              )}

              {/* Validation note for placeholders */}
              {sqlPlaceholders.length > 0 && validationResult && validationResult.valid && (
                <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                  ✓ Placeholders replaced with dummy values during validation
                </div>
              )}
            </div>

            <div className="mt-8 flex items-center gap-3">
              <button
                onClick={editingCoa ? handleUpdateCOA : handleAddCOA}
                disabled={loading}
                className={`px-6 py-2 rounded-lg font-semibold shadow-md transition flex items-center gap-2 ${loading
                    ? "bg-gray-400 text-gray-100 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 hover:scale-105"
                  }`}
                aria-label={editingCoa ? "Update COA" : "Add COA"}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : editingCoa ? (
                  <>
                    <FileText size={16} /> Update COA
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Add COA
                  </>
                )}
              </button>

              {editingCoa && (
                <button
                  onClick={handleDeleteCOA}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition flex items-center gap-2"
                  aria-label="Delete COA"
                >
                  <XCircle size={16} /> Delete COA
                </button>
              )}

              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                aria-label="Cancel"
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