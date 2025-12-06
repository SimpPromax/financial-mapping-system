import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "../../services/api";
import { Plus, X, ChevronDown, ChevronUp, History, FileText, AlertCircle, Database, CheckCircle, XCircle, Calendar, Clock, User, Tag, Archive, ArchiveRestore, Search, RefreshCw } from "lucide-react";
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

// Common SQL placeholders
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

const ChartOfAccounts = ({ user }) => {
  // Use the user prop passed from App.jsx
  const currentUser = user || {
    username: "admin",
    fullName: "Administrator",
    email: "admin@example.com"
  };

  const [coaList, setCoaList] = useState([]);
  const [archivedList, setArchivedList] = useState([]);
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
  const [fetchingArchived, setFetchingArchived] = useState(false);
  const [showPlaceholderHelp, setShowPlaceholderHelp] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedSearchQuery, setArchivedSearchQuery] = useState("");

  const cardsContainerRef = useRef(null);
  const validationTimeoutsRef = useRef({});

  // Fetch active COAs
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

  // Fetch archived COAs
  const fetchArchivedCOAs = useCallback(async () => {
    setFetchingArchived(true);
    try {
      const res = await api.get("/api/coa/archived");
      setArchivedList(res.data || []);
    } catch (err) {
      console.error("Failed to fetch archived COAs:", err);
    } finally {
      setFetchingArchived(false);
    }
  }, []);

  // Initial fetches
  useEffect(() => {
    fetchCOAs();
    fetchArchivedCOAs();
  }, [fetchCOAs, fetchArchivedCOAs]);

  // Function to replace SQL placeholders with dummy values
  const replacePlaceholders = useCallback((sql) => {
    if (!sql) return sql;

    let processedSQL = sql;

    // Replace all placeholders with their dummy values
    Object.entries(SQL_PLACEHOLDERS).forEach(([placeholder, value]) => {
      const regex = new RegExp(`\\${placeholder}\\b`, 'g');
      processedSQL = processedSQL.replace(regex, value);
    });

    // Also handle generic parameter placeholders
    processedSQL = processedSQL.replace(/:(\w+)\b/g, (match, paramName) => {
      const lowerParam = paramName.toLowerCase();

      if (lowerParam.includes('date') || lowerParam.includes('time')) {
        return "'2024-06-15'";
      }

      if (lowerParam.includes('id') || lowerParam.includes('num') || lowerParam.includes('count')) {
        return "1";
      }

      if (lowerParam.includes('name') || lowerParam.includes('status') || lowerParam.includes('type')) {
        return `'DUMMY_${paramName.toUpperCase()}'`;
      }

      return `'DUMMY_VALUE'`;
    });

    return processedSQL;
  }, []);

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
    setShowPlaceholderHelp(false);
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

      // Fallback: Show mock data
      const coa = [...coaList, ...archivedList].find(c => c.coaId === coaId);
      const mockVersions = [
        {
          versionId: 1,
          coaId: coaId,
          versionNumber: 1,
          coaCode: coa?.coaCode || "Unknown",
          coaName: coa?.coaName || "Unknown",
          description: coa?.description || "",
          sqlScript: coa?.sqlScript || "",
          changedBy: coa?.createdBy || currentUser.username,
          changeType: "CREATE",
          changes: JSON.stringify({
            action: "Initial creation",
            coaCode: coa?.coaCode,
            coaName: coa?.coaName
          }),
          createdAt: new Date().toISOString()
        }
      ];
      setVersionHistory(mockVersions);
      setShowHistory(true);
    } finally {
      setLoadingHistory(false);
    }
  }, [coaList, archivedList, currentUser]);

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
      const cleanedSQL = normalizeSQL(sanitizeSQL(trimmedSQL));

      const payload = {
        coaCode: trimmedCode,
        coaName: trimmedName,
        description: description.trim(),
        sqlScript: cleanedSQL,
        createdBy: currentUser.username,
        createdByName: currentUser.fullName || currentUser.username
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
      } else if (err.message?.includes("dangerous SQL")) {
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
      const cleanedSQL = normalizeSQL(sanitizeSQL(trimmedSQL));

      const res = await api.put(`/api/coa/${editingCoa.coaId}`, {
        coaCode: trimmedCode,
        coaName: trimmedName,
        description: description.trim(),
        sqlScript: cleanedSQL,
        modifiedBy: currentUser.username,
        modifiedByName: currentUser.fullName || currentUser.username
      });

      const updated = res.data || {
        ...editingCoa,
        coaCode: trimmedCode,
        coaName: trimmedName,
        description: description.trim(),
        sqlScript: cleanedSQL,
        modifiedBy: currentUser.username,
        modifiedByName: currentUser.fullName || currentUser.username
      };

      setCoaList((prev) => prev.map((c) => (c.coaId === editingCoa.coaId ? updated : c)));
      toastSuccess("COA updated successfully");
      resetForm();
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        toastError("Another COA already uses this code");
      } else if (err.message?.includes("dangerous SQL")) {
        toastError(err.message);
      } else {
        toastError("Failed to update COA. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle archive COA
  const handleArchiveCOA = async (coa) => {
    if (!coa) return;

    const result = await Swal.fire({
      title: "Archive COA?",
      html: `
        <div class="text-left">
          <p>Are you sure you want to archive <strong>"${coa.coaCode}"</strong>?</p>
          <p class="text-sm text-gray-600 mt-2">
            Archived COAs will be moved to the Archived section and can be restored later.
            They won't appear in the main list.
          </p>
          <div class="mt-4">
            <label class="block text-sm text-gray-700 mb-1">Reason (optional):</label>
            <textarea id="archiveReason" class="w-full border border-gray-300 rounded p-2 text-sm" rows="2" placeholder="Why are you archiving this COA?"></textarea>
          </div>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Archive COA",
      confirmButtonColor: "#f59e0b",
      cancelButtonText: "Cancel",
      backdrop: true,
      allowOutsideClick: false,
      preConfirm: () => {
        return {
          reason: document.getElementById('archiveReason').value
        };
      }
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      console.log("Archiving COA:", coa.coaCode, coa.coaId);

      await api.post(`/api/coa/${coa.coaId}/archive`, {
        archivedBy: currentUser.username,
        archivedByName: currentUser.fullName || currentUser.username,
        reason: result.value?.reason || ""
      });

      // Optimistic update: immediately remove from active list and add to archived list
      setCoaList((prev) => prev.filter((item) => item.coaId !== coa.coaId));

      // Add to archived list with archive metadata
      const archivedCoa = {
        ...coa,
        archived: true,
        archivedBy: currentUser.username,
        archivedByName: currentUser.fullName || currentUser.username,
        archivedDate: new Date().toISOString(),
        archivedReason: result.value?.reason || ""
      };
      setArchivedList((prev) => [...prev, archivedCoa]);

      toastSuccess("COA archived successfully");

      // Reset form if this was the editingCoa
      if (editingCoa?.coaId === coa.coaId) {
        resetForm();
      }

      // Refresh from server to ensure consistency
      fetchArchivedCOAs();
    } catch (err) {
      console.error("Archive error:", err);

      // Revert optimistic updates on error
      setCoaList((prev) => [...prev, coa]);
      setArchivedList((prev) => prev.filter(item => item.coaId !== coa.coaId));

      toastError("Failed to archive COA. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle restore COA
  const handleRestoreCOA = async (coaId, coaCode) => {
    const result = await Swal.fire({
      title: "Restore COA?",
      text: `Are you sure you want to restore "${coaCode}"? It will be moved back to the main list.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Restore",
      confirmButtonColor: "#10b981",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    try {
      await api.post(`/api/coa/${coaId}/restore`, {
        restoredBy: currentUser.username,
        restoredByName: currentUser.fullName || currentUser.username
      });

      // Optimistic update: immediately remove from archived and add to active
      const coaToRestore = archivedList.find(c => c.coaId === coaId);
      if (coaToRestore) {
        const { archivedBy, archivedByName, archivedDate, archivedReason, ...restoredCoa } = coaToRestore;
        restoredCoa.archived = false;
        restoredCoa.restoredBy = currentUser.username;
        restoredCoa.restoredByName = currentUser.fullName || currentUser.username;
        restoredCoa.restoredDate = new Date().toISOString();
        setCoaList((prev) => [...prev, restoredCoa]);
        setArchivedList((prev) => prev.filter((c) => c.coaId !== coaId));
      }

      toastSuccess("COA restored successfully");

      // Refresh from server to ensure consistency
      fetchCOAs();
    } catch (err) {
      console.error(err);

      // Revert optimistic updates
      const restoredCoa = coaList.find(c => c.coaId === coaId);
      if (restoredCoa) {
        setCoaList((prev) => prev.filter(c => c.coaId !== coaId));
        setArchivedList((prev) => [...prev, restoredCoa]);
      }

      toastError("Failed to restore COA. Please try again.");
    }
  };

  // Filter & paginate active COAs
  const filteredCoas = coaList.filter((c) =>
    (c.coaCode || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.coaName || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter archived COAs
  const filteredArchivedCoas = archivedList.filter((c) =>
    (c.coaCode || "").toLowerCase().includes(archivedSearchQuery.toLowerCase()) ||
    (c.coaName || "").toLowerCase().includes(archivedSearchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredCoas.length / DEFAULT_ITEMS_PER_PAGE));
  const paginatedCoas = filteredCoas.slice(
    (currentPage - 1) * DEFAULT_ITEMS_PER_PAGE,
    currentPage * DEFAULT_ITEMS_PER_PAGE
  );

  const totalArchivedPages = Math.max(1, Math.ceil(filteredArchivedCoas.length / DEFAULT_ITEMS_PER_PAGE));
  const paginatedArchivedCoas = filteredArchivedCoas.slice(
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

  // Refresh both lists
  const handleRefresh = () => {
    fetchCOAs();
    if (showArchived) {
      fetchArchivedCOAs();
    }
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

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return "Invalid Date";
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-full bg-white relative">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 z-30 shadow-sm flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-extrabold text-gray-800">📚 Chart of Accounts</h2>
          <div className="flex gap-2">
            <span className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full">
              {coaList.length} Active
            </span>
            <span className="bg-gray-100 text-gray-800 text-sm font-semibold px-3 py-1 rounded-full">
              {archivedList.length} Archived
            </span>
            {currentUser && (
              <span className="bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                <User size={12} />
                {currentUser.username}
                {currentUser.role && ` (${currentUser.role})`}
              </span>
            )}
          </div>
          {(fetchingCOAs || fetchingArchived) && (
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
            title="Refresh"
            disabled={fetchingCOAs || fetchingArchived}
          >
            <RefreshCw size={16} />
            Refresh
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

      {/* Main Content Area with Pill Navigation on Right */}
      <div className="flex-1 overflow-hidden flex flex-col w-full">
        {/* Pill Navigation Container - Fixed at the top */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex justify-between items-center">
            {/* Left side: Title based on current view */}
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-800">
                {showArchived ? "Archived Chart of Accounts" : "Active Chart of Accounts"}
                {currentUser && (
                  <span className="text-sm text-gray-500 ml-2 font-normal">
                    (Logged in as: {currentUser.fullName || currentUser.username})
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {showArchived
                  ? `Viewing ${filteredArchivedCoas.length} archived COAs`
                  : `Viewing ${filteredCoas.length} active COAs`}
              </p>
            </div>

            {/* Right side: Pill-shaped Navigation Tabs */}
            <div className="flex items-center space-x-2">
              {/* Active COAs Pill */}
              <button
                onClick={() => {
                  setShowArchived(false);
                  setCurrentPage(1);
                }}
                className={`
                  relative px-6 py-2.5 rounded-full font-medium text-sm transition-all duration-300 
                  flex items-center gap-2 group overflow-hidden
                  ${!showArchived
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }
                `}
              >
                {/* Active pill background animation */}
                {!showArchived && (
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 opacity-90"></span>
                )}

                {/* Content */}
                <span className="relative z-10 flex items-center gap-2">
                  <FileText size={16} className={!showArchived ? 'text-white' : 'text-gray-600'} />
                  <span>Active</span>
                  {!showArchived && (
                    <span className="bg-white/20 text-white/90 text-xs font-bold px-2 py-0.5 rounded-full">
                      {coaList.length}
                    </span>
                  )}
                </span>

                {/* Hover effect */}
                {showArchived && (
                  <span className="absolute inset-0 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"></span>
                )}
              </button>

              {/* Archived COAs Pill */}
              <button
                onClick={() => {
                  setShowArchived(true);
                  setCurrentPage(1);
                }}
                className={`
                  relative px-6 py-2.5 rounded-full font-medium text-sm transition-all duration-300 
                  flex items-center gap-2 group overflow-hidden
                  ${showArchived
                    ? 'bg-gray-800 text-white shadow-lg'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                  }
                `}
              >
                {/* Archived pill background animation */}
                {showArchived && (
                  <span className="absolute inset-0 bg-gradient-to-r from-gray-700 to-gray-800 opacity-90"></span>
                )}

                {/* Content */}
                <span className="relative z-10 flex items-center gap-2">
                  <Archive size={16} className={showArchived ? 'text-white' : 'text-gray-600'} />
                  <span>Archived</span>
                  {showArchived && (
                    <span className="bg-white/20 text-white/90 text-xs font-bold px-2 py-0.5 rounded-full">
                      {archivedList.length}
                    </span>
                  )}
                </span>

                {/* Hover effect */}
                {!showArchived && (
                  <span className="absolute inset-0 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"></span>
                )}
              </button>
            </div>
          </div>

          {/* Search Bar - Below the title and navigation */}
          <div className="mt-4 flex justify-between items-center">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 select-none">
                  <Search size={18} />
                </span>
                <input
                  type="text"
                  placeholder={showArchived ? "Search archived COAs..." : "Search active COAs..."}
                  value={showArchived ? archivedSearchQuery : searchQuery}
                  onChange={(e) => {
                    if (showArchived) {
                      setArchivedSearchQuery(e.target.value);
                    } else {
                      setSearchQuery(e.target.value);
                    }
                    setCurrentPage(1);
                  }}
                  className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-700 
                           shadow-sm focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 
                           transition-all w-full placeholder-gray-400 hover:border-blue-400
                           disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={showArchived ? "Search archived COAs" : "Search active COAs"}
                  disabled={showArchived ? fetchingArchived : fetchingCOAs}
                />
                {/* Clear search button */}
                {(showArchived ? archivedSearchQuery : searchQuery) && (
                  <button
                    onClick={() => {
                      if (showArchived) {
                        setArchivedSearchQuery("");
                      } else {
                        setSearchQuery("");
                      }
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* View-specific actions */}
            <div className="ml-4">
              {showArchived ? (
                <span className="text-sm text-gray-500">
                  {filteredArchivedCoas.length} of {archivedList.length} archived COAs
                </span>
              ) : (
                <span className="text-sm text-gray-500">
                  {filteredCoas.length} of {coaList.length} active COAs
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">

          {/* Active COAs View */}
          {!showArchived && (
            <>
              {/* Loading State */}
              {fetchingCOAs && coaList.length === 0 && (
                <div className="text-center py-16">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Loading Active COAs...</p>
                </div>
              )}

              {/* Empty State */}
              {!fetchingCOAs && coaList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="mb-6 p-6 bg-blue-50 rounded-full">
                    <Database size={80} className="text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">No Active COAs Found</h3>
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

              {/* Active COAs Cards */}
              {!fetchingCOAs && coaList.length > 0 && (
                <>
                  {/* No Results */}
                  {paginatedCoas.length === 0 && coaList.length > 0 && (
                    <div className="col-span-full text-center py-12">
                      <AlertCircle className="inline-block text-yellow-500 mb-4" size={48} />
                      <p className="text-gray-600 italic">No matching COAs found for "{searchQuery}"</p>
                      <button
                        onClick={() => setSearchQuery("")}
                        className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Clear search
                      </button>
                    </div>
                  )}

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-20" ref={cardsContainerRef}>
                    {paginatedCoas.map((c, idx) => (
                      <div
                        key={c.coaId || idx}
                        className={`bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col transition-all duration-300 hover:shadow-xl ${expandedCards[c.coaId] ? 'min-h-[400px]' : 'min-h-[300px]'}`}
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
                            <div className={`flex-1 bg-gray-800 border border-gray-800 rounded-lg overflow-auto transition-all duration-300 ${expandedCards[c.coaId] ? 'max-h-72' : getSQLHeight(c.sqlScript)}`}>
                              <pre className="p-4 text-sm text-emerald-200 font-mono whitespace-pre-wrap wrap-break-word">
                                <code>{c.sqlScript}</code>
                              </pre>
                            </div>
                          </div>

                          <p className="text-right text-xs text-gray-400 mt-3">
                            Created by: {c.createdByName || c.createdBy || "N/A"}
                            {c.modifiedByName && (
                              <span className="ml-2">| Modified by: {c.modifiedByName}</span>
                            )}
                          </p>
                        </div>

                        {/* Edit and Archive buttons */}
                        <div className="p-6 pt-0 mt-auto">
                          <div className="mt-4 flex justify-between gap-2 border-t pt-4">
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
                            >
                              <FileText size={16} /> Edit
                            </button>
                            <button
                              onClick={() => handleArchiveCOA(c)}
                              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex items-center gap-2"
                            >
                              <Archive size={16} /> Archive
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Sticky Pagination */}
                  {totalPages > 1 && (
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
                </>
              )}
            </>
          )}

          {/* Archived COAs View */}
          {showArchived && (
            <>
              {/* Loading State */}
              {fetchingArchived && archivedList.length === 0 && (
                <div className="text-center py-16">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mb-4"></div>
                  <p className="text-gray-600">Loading Archived COAs...</p>
                </div>
              )}

              {/* Empty State */}
              {!fetchingArchived && archivedList.length === 0 ? (
                <div className="text-center py-16">
                  <Archive className="inline-block text-gray-400 mb-4" size={64} />
                  <p className="text-gray-600 italic">No archived COAs found</p>
                  <p className="text-sm text-gray-500 mt-2">
                    COAs you archive will appear here.
                  </p>
                </div>
              ) : (
                <>
                  {/* No Results */}
                  {paginatedArchivedCoas.length === 0 && archivedList.length > 0 && (
                    <div className="col-span-full text-center py-12">
                      <AlertCircle className="inline-block text-yellow-500 mb-4" size={48} />
                      <p className="text-gray-600 italic">No matching archived COAs found for "{archivedSearchQuery}"</p>
                      <button
                        onClick={() => setArchivedSearchQuery("")}
                        className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Clear search
                      </button>
                    </div>
                  )}

                  {/* Archived Cards Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                    {paginatedArchivedCoas.map((c, idx) => (
                      <div
                        key={c.coaId || idx}
                        className="bg-white rounded-xl shadow border border-gray-200 flex flex-col transition-all duration-300 hover:shadow-md"
                      >
                        <div className="p-6 flex-1 flex flex-col">
                          <div className="flex justify-between items-start gap-4 mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-2xl font-extrabold text-gray-700 wrap-break-word">{c.coaCode}</p>
                                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                                  <Archive size={12} className="inline mr-1" />
                                  Archived
                                </span>
                              </div>
                              <p className="text-sm text-gray-500 mt-1 wrap-break-word">{c.coaName}</p>
                            </div>
                          </div>

                          <p className="text-gray-600 mt-3 wrap-break-word">
                            <span className="font-bold">Description:</span> {c.description || "No description provided."}
                          </p>

                          <div className="mt-4 flex-1">
                            <p className="text-xs font-semibold text-gray-500 mb-1">SQL</p>
                            <div className="bg-gray-800 border border-gray-800 rounded-lg overflow-auto max-h-40">
                              <pre className="p-3 text-xs text-emerald-200 font-mono whitespace-pre-wrap">
                                <code>{c.sqlScript}</code>
                              </pre>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-gray-500">
                            <div>
                              <span className="font-semibold">Archived by:</span> {c.archivedByName || c.archivedBy || "N/A"}
                            </div>
                            <div>
                              <span className="font-semibold">Archived on:</span> {formatDate(c.archivedDate)}
                            </div>
                            <div>
                              <span className="font-semibold">Created by:</span> {c.createdByName || c.createdBy || "N/A"}
                            </div>
                            <div>
                              <span className="font-semibold">Created on:</span> {formatDate(c.createdDate)}
                            </div>
                          </div>
                        </div>

                        <div className="p-6 pt-0 mt-auto">
                          <div className="mt-4 flex justify-between gap-2 border-t pt-4">
                            <button
                              onClick={() => handleRestoreCOA(c.coaId, c.coaCode)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 flex-1 justify-center"
                            >
                              <ArchiveRestore size={16} /> Restore
                            </button>
                            <button
                              onClick={() => fetchVersionHistory(c.coaId)}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center gap-2"
                            >
                              <History size={16} /> History
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Sticky Pagination for Archived */}
                  {totalArchivedPages > 1 && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
                      <div className="inline-flex flex-wrap justify-center items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-gray-300 rounded-xl shadow-md px-3 py-2">
                        <button
                          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className={`px-3 py-1 rounded-lg border transition ${currentPage === 1
                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-800"
                            }`}
                          aria-label="Previous page"
                        >
                          Prev
                        </button>
                        {Array.from({ length: totalArchivedPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1 rounded-lg border transition ${currentPage === page
                              ? "bg-gray-600 text-white border-gray-600"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-800"
                              }`}
                            aria-label={`Page ${page}`}
                            aria-current={currentPage === page ? "page" : undefined}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalArchivedPages))}
                          disabled={currentPage === totalArchivedPages}
                          className={`px-3 py-1 rounded-lg border transition ${currentPage === totalArchivedPages
                            ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-800"
                            }`}
                          aria-label="Next page"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Version History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-center items-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl mx-4 relative p-8">
            <button
              onClick={() => setShowHistory(false)}
              className="absolute top-4 right-4 text-gray-700 hover:text-red-600"
              title="Close History"
              aria-label="Close version history"
            >
              <X size={24} />
            </button>

            <h3 className="text-2xl font-bold mb-6 text-blue-600 flex items-center gap-2">
              <History size={24} /> Version History
            </h3>

            {loadingHistory ? (
              <div className="text-center py-16">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Loading version history...</p>
              </div>
            ) : versionHistory.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="inline-block text-gray-400 mb-4" size={48} />
                <p className="text-gray-600 italic">No version history available</p>
                <p className="text-sm text-gray-500 mt-2">Versions will be created when you edit COAs.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                  <p>Showing {versionHistory.length} version{versionHistory.length !== 1 ? 's' : ''} for this COA. Latest version is at the top.</p>
                </div>

                <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
                  {versionHistory.map((version, idx) => {
                    // Parse changes JSON
                    let parsedChanges = {};
                    let changesString = "No changes recorded";

                    try {
                      if (version.changes) {
                        parsedChanges = JSON.parse(version.changes);
                        if (typeof parsedChanges === 'object' && Object.keys(parsedChanges).length > 0) {
                          changesString = Object.entries(parsedChanges).map(([key, value]) => {
                            if (key === 'sqlScript' && value === 'updated') {
                              return "SQL Script was updated";
                            }
                            if (typeof value === 'object' && value.old && value.new) {
                              return `${key}: "${value.old}" → "${value.new}"`;
                            }
                            if (key === 'action') {
                              return value;
                            }
                            return `${key}: ${JSON.stringify(value)}`;
                          }).join(', ');
                        }
                      }
                    } catch (err) {
                      changesString = version.changes || "No changes recorded";
                    }

                    return (
                      <div key={version.versionId || idx} className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${version.changeType === 'CREATE' ? 'bg-green-100' : version.changeType === 'UPDATE' ? 'bg-blue-100' : version.changeType === 'ARCHIVE' ? 'bg-amber-100' : version.changeType === 'RESTORE' ? 'bg-green-100' : 'bg-red-100'}`}>
                              {version.changeType === 'CREATE' ? (
                                <Plus size={20} className="text-green-600" />
                              ) : version.changeType === 'UPDATE' ? (
                                <FileText size={20} className="text-blue-600" />
                              ) : version.changeType === 'ARCHIVE' ? (
                                <Archive size={20} className="text-amber-600" />
                              ) : version.changeType === 'RESTORE' ? (
                                <ArchiveRestore size={20} className="text-green-600" />
                              ) : (
                                <X size={20} className="text-red-600" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-lg text-gray-800">
                                  Version {version.versionNumber || versionHistory.length - idx}
                                </h4>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${version.changeType === 'CREATE' ? 'bg-green-100 text-green-700' : version.changeType === 'UPDATE' ? 'bg-blue-100 text-blue-700' : version.changeType === 'ARCHIVE' ? 'bg-amber-100 text-amber-700' : version.changeType === 'RESTORE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {version.changeType}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                <Clock size={14} />
                                <span>{formatDate(version.createdAt)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <User size={14} />
                              <span className="font-medium">{version.changedBy || "Unknown"}</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              ID: {version.versionId || "N/A"}
                            </div>
                          </div>
                        </div>

                        {/* COA Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">COA Code</p>
                            <p className="font-mono font-bold text-gray-800">{version.coaCode || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">COA Name</p>
                            <p className="font-medium text-gray-800">{version.coaName || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">Description</p>
                            <p className="text-gray-600">{version.description || "No description"}</p>
                          </div>
                        </div>

                        {/* Changes */}
                        <div className="mb-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Tag size={16} className="text-gray-500" />
                            <p className="text-sm font-semibold text-gray-700">Changes</p>
                          </div>
                          <div className="p-3 bg-gray-100 rounded text-sm text-gray-700 whitespace-pre-wrap">
                            {changesString}
                          </div>
                        </div>

                        {/* SQL Script */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <FileText size={16} className="text-gray-500" />
                            <p className="text-sm font-semibold text-gray-700">SQL Script</p>
                            <span className="text-xs text-gray-500 ml-auto">
                              {version.sqlScript?.split('\n').length || 0} lines
                            </span>
                          </div>
                          <div className="bg-gray-800 border border-gray-800 rounded-lg overflow-hidden">
                            <pre className="p-4 text-sm text-emerald-200 font-mono overflow-x-auto max-h-64">
                              <code>{version.sqlScript || "No SQL script available"}</code>
                            </pre>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
            className="bg-white rounded-xl shadow-xl w-full max-w-6xl mx-4 relative p-8"
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

            {/* User Info Banner */}
            {currentUser && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <User size={16} className="text-blue-600" />
                  <span className="text-sm text-blue-700">
                    Logged in as: <span className="font-semibold">{currentUser.fullName || currentUser.username}</span>
                    {currentUser.role && <span className="ml-2 text-blue-600">({currentUser.role})</span>}
                  </span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  This action will be recorded under your name in the audit trail.
                </p>
              </div>
            )}

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
                  onClick={() => handleArchiveCOA(editingCoa)}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition flex items-center gap-2"
                  aria-label="Archive COA"
                >
                  <Archive size={16} /> Archive COA
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