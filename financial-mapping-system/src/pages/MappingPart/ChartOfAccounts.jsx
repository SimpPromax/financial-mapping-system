import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "../../services/api";
import { Plus, X, ChevronDown, ChevronUp, History, FileText, AlertCircle, Database, CheckCircle, XCircle, Calendar, Clock, User, Tag, Archive, ArchiveRestore, Search, RefreshCw, HelpCircle, ShieldAlert, Grid, List, Layout } from "lucide-react";
import Editor from "react-simple-code-editor";
import { highlight, languages } from "prismjs/components/prism-core";
import "prismjs/components/prism-sql";
import "prismjs/themes/prism-tomorrow.css";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import { useAuth } from '../../hooks/useAuth';

// Constants
const INITIAL_SQL = "-- Write SQL here\nSELECT * FROM table_name;";
const BATCH_SIZE = 5;
const DEBOUNCE_DELAY = 300;

// Card Size Configuration with items per page
const CARD_SIZE_CONFIG = {
  small: {
    name: 'small',
    icon: <List size={16} />,
    height: '300px',
    showSql: false,
    showDescription: true,
    showMetadata: false,
    showFullMetadata: false,
    gridCols: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    textSize: 'text-sm',
    padding: 'p-4',
    sqlHeight: '0px',
    titleSize: 'text-xl',
    compact: true,
    itemsPerPage: 12
  },
  medium: {
    name: 'medium',
    icon: <Layout size={16} />,
    height: '400px',
    showSql: true,
    showDescription: true,
    showMetadata: true,
    showFullMetadata: false,
    gridCols: 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3',
    textSize: 'text-base',
    padding: 'p-5',
    sqlHeight: '100px',
    titleSize: 'text-2xl',
    compact: false,
    itemsPerPage: 6
  },
  large: {
    name: 'large',
    icon: <Grid size={16} />,
    height: '550px',
    showSql: true,
    showDescription: true,
    showMetadata: true,
    showFullMetadata: true,
    gridCols: 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3',
    textSize: 'text-lg',
    padding: 'p-6',
    sqlHeight: '180px',
    titleSize: 'text-2xl',
    compact: false,
    itemsPerPage: 6
  }
};

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

// Allowed SQL functions (matching backend)
const ALLOWED_SQL_FUNCTIONS = [
  "SUM", "COUNT", "AVG", "MAX", "MIN", "AVERAGE", "TOTAL",
  "UPPER", "LOWER", "SUBSTRING", "CONCAT", "TRIM", "LTRIM", "RTRIM",
  "ROUND", "CEILING", "FLOOR", "ABS", "SQRT", "POWER",
  "COALESCE", "NULLIF", "ISNULL", "IFNULL", "NVL",
  "CASE", "WHEN", "THEN", "ELSE", "END",
  "CAST", "CONVERT", "TO_DATE", "TO_CHAR", "TO_NUMBER",
  "DATEDIFF", "DATEADD", "DATEPART", "YEAR", "MONTH", "DAY",
  "CURRENT_DATE", "CURRENT_TIME", "CURRENT_TIMESTAMP", "NOW", "SYSDATE",
  "GETDATE", "SYSDATETIME", "DATE_FORMAT", "FORMAT", "TO_TIMESTAMP",
  "EXTRACT", "DATE_PART", "AGE", "ADD_MONTHS", "MONTHS_BETWEEN"
];

// SQL Dangerous Patterns - Updated to match backend
const DANGEROUS_SQL_PATTERNS = [
  /SELECT.*INTO/i,
  /SELECT.*DROP/i,
  /SELECT.*DELETE/i,
  /SELECT.*UPDATE/i,
  /SELECT.*INSERT/i,
  /SELECT.*CREATE/i,
  /SELECT.*ALTER/i,
  /SELECT.*EXEC/i,
  /SELECT.*EXECUTE/i,
  /SELECT.*TRUNCATE/i,
  /UNION.*SELECT.*DROP/i,
  /UNION.*SELECT.*DELETE/i,
  /UNION.*SELECT.*UPDATE/i,
  /UNION.*SELECT.*INSERT/i,
  /UNION.*SELECT.*CREATE/i,
  /UNION.*SELECT.*ALTER/i,
  /UNION.*SELECT.*TRUNCATE/i,
  /FROM.*INFORMATION_SCHEMA/i,
  /FROM.*SYS\./i,
  /XP_/i,
  /SLEEP\s*\(/i,
  /WAITFOR\s+DELAY/i,
  /PG_SLEEP\s*\(/i,
  /BENCHMARK\s*\(/i,
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
  /MERGE\s+/i,
  /CALL\s+/i,
  /DECLARE\s+/i,
  /BEGIN\s+/i,
  /COMMIT\s+/i,
  /ROLLBACK\s+/i,
  /SAVEPOINT\s+/i,
  /LOCK\s+/i,
  /UNLOCK\s+/i,
  /KILL\s+/i,
  /SHUTDOWN\s+/i,
  /BACKUP\s+/i,
  /RESTORE\s+/i,
  /DENY\s+/i,
  /USE\s+/i,
  /SET\s+/i,
  /DESCRIBE\s+/i,
  /SHOW\s+/i,
  /EXPLAIN\s+/i
];

// Forbidden keywords (matching backend)
const FORBIDDEN_KEYWORDS = [
  "DROP", "DELETE", "UPDATE", "INSERT", "CREATE", "ALTER", "TRUNCATE",
  "GRANT", "REVOKE", "EXEC", "EXECUTE", "MERGE", "PURGE", "RENAME",
  "CALL", "DECLARE", "BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT",
  "LOCK", "UNLOCK", "KILL", "SHUTDOWN", "BACKUP", "RESTORE",
  "DENY", "USE", "SET", "DESCRIBE", "SHOW", "EXPLAIN"
];

// Safe division examples for user guidance
const SAFE_DIVISION_EXAMPLES = [
  {
    unsafe: "SUM(numerator) / SUM(denominator)",
    safe: "SUM(numerator) / NULLIF(SUM(denominator), 0)",
    description: "Use NULLIF to handle division by zero"
  },
  {
    unsafe: "COUNT(*) / total_count",
    safe: "COUNT(*) / CASE WHEN total_count = 0 THEN 1 ELSE total_count END",
    description: "Use CASE WHEN to provide a default value"
  },
  {
    unsafe: "amount / divisor",
    safe: "amount / COALESCE(NULLIF(divisor, 0), 1)",
    description: "Combine COALESCE and NULLIF for robust handling"
  },
  {
    unsafe: "SUM(CASE WHEN condition THEN value END) / SUM(total)",
    safe: "SUM(CASE WHEN condition THEN value END) / NULLIF(SUM(total), 0)",
    description: "Protect division in CASE expressions"
  }
];

const ChartOfAccounts = () => {
  // Use the user prop passed from App.jsx
  const { user } = useAuth();
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
  const [showDivisionSafetyHelp, setShowDivisionSafetyHelp] = useState(false);
  const [divisionSafetyIssues, setDivisionSafetyIssues] = useState([]);
  const [cardSize, setCardSize] = useState(() => {
    const saved = localStorage.getItem('coaCardSize');
    return saved || 'large';
  });
  const cardsContainerRef = useRef(null);
  const validationTimeoutsRef = useRef({});

  // Get current items per page based on card size
  const getItemsPerPage = () => {
    return CARD_SIZE_CONFIG[cardSize].itemsPerPage;
  };

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

  // Card size handler
  const handleCardSizeChange = useCallback((size) => {
    setCardSize(size);
    localStorage.setItem('coaCardSize', size);
    // Reset expanded cards when changing size
    setExpandedCards({});
    // Reset to first page when changing card size
    setCurrentPage(1);
  }, []);

  // ✅ CORRECTED: checkDivisionSafety
  const checkDivisionSafety = useCallback((sql) => {
    if (!sql) return [];
    const issues = [];
    // Remove comments and string literals safely
    let cleanSql = sql
      .replace(/--.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/'[^']*'/g, "''");

    // Simple but effective: find divisions where denominator starts with safety wrapper
    const lines = cleanSql.split('\n');
    let fullText = lines.join(' ');

    // Use a robust regex to capture full expressions around '/'
    const divisionRegex = /([^\/\n\r]+?)\s*\/\s*([^\/\n\r]+)/gi;
    let match;

    while ((match = divisionRegex.exec(fullText)) !== null) {
      const fullMatch = match[0].trim();
      const numerator = match[1].trim();
      const denominator = match[2].trim();

      if (!denominator) continue;

      // ✅ SAFE: Denominator starts with a safety wrapper
      if (
        /^\s*NULLIF\s*\(/i.test(denominator) ||
        /^\s*COALESCE\s*\(/i.test(denominator) ||
        /^\s*CASE\s+/i.test(denominator)
      ) {
        continue;
      }

      // ❌ UNSAFE: Potentially zero denominator
      let isUnsafe = false;
      let reason = "";
      const denUpper = denominator.toUpperCase().trim();

      if (denUpper === "0" || denUpper === "0.0") {
        isUnsafe = true;
        reason = "Denominator is literal zero";
      } else if (/^\s*(SUM|COUNT|AVG|MAX|MIN)\s*\(/i.test(denominator)) {
        isUnsafe = true;
        reason = "Denominator is an aggregate function that could be NULL or zero";
      } else if (/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(denominator)) {
        isUnsafe = true;
        reason = "Denominator is a column that could contain zero";
      }

      if (isUnsafe) {
        issues.push({
          division: fullMatch,
          numerator,
          denominator,
          reason,
          position: match.index,
          length: fullMatch.length
        });
      }
    }

    return issues;
  }, []);

  // Function to replace SQL placeholders with dummy values
  const replacePlaceholders = useCallback((sql) => {
    if (!sql) return sql;
    let processedSQL = sql;
    Object.entries(SQL_PLACEHOLDERS).forEach(([placeholder, value]) => {
      const regex = new RegExp(`\\${placeholder}\\b`, 'g');
      processedSQL = processedSQL.replace(regex, value);
    });
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
    for (const pattern of DANGEROUS_SQL_PATTERNS) {
      if (pattern.test(cleaned)) {
        throw new Error("Potentially dangerous SQL detected. Only SELECT or WITH (CTE) statements are allowed.");
      }
    }
    cleaned = cleaned.replace(/--.*$/gm, "");
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
    return cleaned;
  }, []);

  const normalizeSQL = useCallback((sql) => {
    if (!sql) return "";
    return sql
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ', ')
      .replace(/\s*\(\s*/g, '(')
      .replace(/\s*\)\s*/g, ')')
      .trim();
  }, []);

  // Enhanced function to check if keyword is part of allowed function
  const isPartOfAllowedFunction = useCallback((sql, keyword) => {
    for (const functionName of ALLOWED_SQL_FUNCTIONS) {
      if (functionName.toUpperCase().includes(keyword.toUpperCase())) {
        const functionPattern = new RegExp(`\\b${functionName}\\s*\\(`, 'i');
        if (functionPattern.test(sql)) {
          return true;
        }
      }
    }
    return false;
  }, []);

  // Enhanced function to validate if SQL is safe (SELECT or WITH/SELECT)
  const isSelectOrWithOnly = useCallback((sql) => {
    if (!sql) return false;
    try {
      const cleaned = sanitizeSQL(sql);
      const normalized = normalizeSQL(cleaned);
      if (!normalized) return false;
      const sqlUpper = normalized.toUpperCase();
      if (sqlUpper.startsWith('WITH ')) {
        return sqlUpper.includes('SELECT');
      }
      if (sqlUpper.startsWith('SELECT ')) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [sanitizeSQL, normalizeSQL]);

  // Enhanced function to check for dangerous keywords with context awareness
  const containsDangerousKeyword = useCallback((sql, keyword) => {
    const keywordPattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (!keywordPattern.test(sql)) {
      return false;
    }
    const sqlWithoutStrings = sql.replace(/'[^']*'/g, "''");
    if (!keywordPattern.test(sqlWithoutStrings)) {
      return false;
    }
    if (isPartOfAllowedFunction(sql, keyword)) {
      return false;
    }
    const safeContextPattern = new RegExp(
      `\\b(AS|FROM|JOIN|INTO|TABLE|DATABASE|INDEX|VIEW|COLUMN|ALIAS|COLUMNS)\\s+${keyword}\\b`,
      'i'
    );
    if (safeContextPattern.test(sqlWithoutStrings)) {
      return false;
    }
    const sqlUpper = sql.toUpperCase();
    if (sqlUpper.startsWith('WITH ') || sqlUpper.startsWith('SELECT ')) {
      const selectListPattern = new RegExp(
        `SELECT\\s+.*?\\b${keyword}\\b.*?FROM`,
        'is'
      );
      if (selectListPattern.test(sqlWithoutStrings)) {
        return false;
      }
      const caseWhenPattern = new RegExp(
        `CASE\\s+WHEN.*?\\b${keyword}\\b.*?THEN`,
        'is'
      );
      if (caseWhenPattern.test(sqlWithoutStrings)) {
        return false;
      }
    }
    return true;
  }, [isPartOfAllowedFunction]);

  // Enhanced function to validate SQL syntax for complex queries
  const validateComplexSQL = useCallback((sql) => {
    const trimmed = sql.trim();
    if (!trimmed || trimmed === INITIAL_SQL) {
      return { valid: false, error: "SQL Script is required" };
    }
    try {
      const sqlWithoutComments = trimmed
        .replace(/--.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim();
      if (!sqlWithoutComments) {
        return { valid: false, error: "SQL Script is required" };
      }
      const sqlUpper = sqlWithoutComments.toUpperCase();
      const normalizedForCheck = sqlWithoutComments.replace(/\s+/g, ' ').toUpperCase();
      if (!normalizedForCheck.startsWith('SELECT ') && !normalizedForCheck.startsWith('WITH ')) {
        return {
          valid: false,
          error: "Only SELECT or WITH (CTE) statements are allowed"
        };
      }
      for (const pattern of DANGEROUS_SQL_PATTERNS) {
        if (pattern.test(trimmed)) {
          return {
            valid: false,
            error: "Potentially dangerous SQL detected. Only SELECT and WITH/SELECT statements are allowed."
          };
        }
      }
      // ✅ Use the CORRECTED division safety checker
      const divisionIssues = checkDivisionSafety(sqlWithoutComments);
      if (divisionIssues.length > 0) {
        const firstIssue = divisionIssues[0];
        return {
          valid: false,
          error: `Unsafe division detected: "${firstIssue.division}". Denominator "${firstIssue.denominator}" could be zero. Use NULLIF or CASE WHEN to handle division by zero. Example: SUM(numerator) / NULLIF(SUM(denominator), 0)`,
          divisionIssues: divisionIssues
        };
      }
      for (const keyword of FORBIDDEN_KEYWORDS) {
        if (containsDangerousKeyword(sqlWithoutComments, keyword)) {
          return {
            valid: false,
            error: `Query contains forbidden keyword: ${keyword}`
          };
        }
      }
      if (normalizedForCheck.startsWith('WITH ')) {
        const ctePattern = /WITH\s+\w+\s+AS\s*\(/i;
        if (!ctePattern.test(sqlWithoutComments)) {
          return {
            valid: false,
            error: "Invalid CTE syntax. Expected format: WITH cte_name AS (SELECT ...)"
          };
        }
        const openParen = (sqlWithoutComments.match(/\(/g) || []).length;
        const closeParen = (sqlWithoutComments.match(/\)/g) || []).length;
        if (openParen !== closeParen) {
          return {
            valid: false,
            error: "Unbalanced parentheses in SQL statement"
          };
        }
        if (!normalizedForCheck.includes('SELECT')) {
          return {
            valid: false,
            error: "CTE must contain a SELECT statement"
          };
        }
      }
      if (normalizedForCheck.startsWith('SELECT ')) {
        if (normalizedForCheck.includes('UNION')) {
          const unionParts = normalizedForCheck.split(/UNION\s+(ALL\s+)?/i);
          for (let i = 1; i < unionParts.length; i++) {
            const part = unionParts[i].trim();
            if (part && !part.startsWith('SELECT ') && !part.startsWith('(')) {
              return {
                valid: false,
                error: "UNION operations must only combine SELECT statements"
              };
            }
          }
        }
      }
      return { valid: true };
    } catch (err) {
      return {
        valid: false,
        error: err.message || "Invalid SQL syntax"
      };
    }
  }, [containsDangerousKeyword, checkDivisionSafety]);

  // Validate single COA with placeholder handling
  const validateSingleCoa = useCallback(async (coa) => {
    if (!coa || !coa.coaId || !coa.sqlScript) return { [coa.coaId]: false };
    try {
      const sqlWithPlaceholdersReplaced = replacePlaceholders(coa.sqlScript);
      const res = await api.post("/api/coa/validate-sql", {
        sqlScript: sqlWithPlaceholdersReplaced
      });
      return { [coa.coaId]: res.data.valid };
    } catch (err) {
      return { [coa.coaId]: false };
    }
  }, [replacePlaceholders]);

  // Validate all COAs in batches
  const validateAllCoas = useCallback(async () => {
    if (!coaList.length) return;
    const results = {};
    try {
      for (let i = 0; i < coaList.length; i += BATCH_SIZE) {
        const batch = coaList.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(coa => validateSingleCoa(coa));
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(result => {
          Object.assign(results, result);
        });
        setCoaValidationStatus(prev => ({ ...prev, ...results }));
      }
    } catch (err) {
      console.error("Batch validation failed:", err);
    }
  }, [coaList, validateSingleCoa]);

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

  useEffect(() => {
    if (sqlScript && sqlScript.trim() !== INITIAL_SQL) {
      const issues = checkDivisionSafety(sqlScript);
      setDivisionSafetyIssues(issues);
    } else {
      setDivisionSafetyIssues([]);
    }
  }, [sqlScript, checkDivisionSafety]);

  useEffect(() => {
    return () => {
      Object.values(validationTimeoutsRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  const toggleCardExpansion = useCallback((coaId) => {
    setExpandedCards(prev => ({
      ...prev,
      [coaId]: !prev[coaId]
    }));
  }, []);

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
    if (!exists && validationErrors.coaCode?.includes("already exists")) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.coaCode;
        return newErrors;
      });
    }
  }, [coaList, editingCoa, validationErrors]);

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
    setShowDivisionSafetyHelp(false);
    setDivisionSafetyIssues([]);
  }, []);

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
        const sqlValidation = validateComplexSQL(trimmedSQL);
        if (!sqlValidation.valid) {
          errors.sqlScript = sqlValidation.error;
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
  }, [coaCode, coaName, sqlScript, isCodeDuplicate, validateComplexSQL]);

  const fetchVersionHistory = useCallback(async (coaId) => {
    if (!coaId) return;
    setLoadingHistory(true);
    try {
      const res = await api.get(`/api/coa/${coaId}/versions`);
      setVersionHistory(res.data || []);
      setShowHistory(true);
    } catch (err) {
      console.error("Failed to fetch version history:", err);
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

  const handleAddCOA = async () => {
    if (!validateForm()) {
      return;
    }
    const trimmedCode = coaCode.trim();
    const trimmedName = coaName.trim();
    const trimmedSQL = sqlScript.trim();
    setLoading(true);
    try {
      const cleanedSQL = trimmedSQL;
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
      } else if (err.message?.includes("division")) {
        toastError(err.message);
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
      const cleanedSQL = trimmedSQL;
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
      } else if (err.message?.includes("division")) {
        toastError(err.message);
      } else {
        toastError("Failed to update COA. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

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
      await api.post(`/api/coa/${coa.coaId}/archive`, {
        archivedBy: currentUser.username,
        archivedByName: currentUser.fullName || currentUser.username,
        reason: result.value?.reason || ""
      });
      setCoaList((prev) => prev.filter((item) => item.coaId !== coa.coaId));
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
      if (editingCoa?.coaId === coa.coaId) {
        resetForm();
      }
      fetchArchivedCOAs();
    } catch (err) {
      console.error("Archive error:", err);
      setCoaList((prev) => [...prev, coa]);
      setArchivedList((prev) => prev.filter(item => item.coaId !== coa.coaId));
      toastError("Failed to archive COA. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
      const coaToRestore = archivedList.find(c => c.coaId === coaId);
      if (coaToRestore) {
        const { archivedBy, archivedByName, archivedDate, archivedReason, ...restoredCoa } = coaToRestore;
        restoredCoa.archived = false;
        restoredCoa.restoredBy = currentUser.username,
          restoredCoa.restoredByName = currentUser.fullName || currentUser.username,
          restoredCoa.restoredDate = new Date().toISOString();
        setCoaList((prev) => [...prev, restoredCoa]);
        setArchivedList((prev) => prev.filter((c) => c.coaId !== coaId));
      }
      toastSuccess("COA restored successfully");
      fetchCOAs();
    } catch (err) {
      console.error(err);
      const restoredCoa = coaList.find(c => c.coaId === coaId);
      if (restoredCoa) {
        setCoaList((prev) => prev.filter(c => c.coaId !== coaId));
        setArchivedList((prev) => [...prev, restoredCoa]);
      }
      toastError("Failed to restore COA. Please try again.");
    }
  };

  const filteredCoas = coaList.filter((c) =>
    (c.coaCode || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.coaName || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredArchivedCoas = archivedList.filter((c) =>
    (c.coaCode || "").toLowerCase().includes(archivedSearchQuery.toLowerCase()) ||
    (c.coaName || "").toLowerCase().includes(archivedSearchQuery.toLowerCase())
  );

  // Calculate pagination based on current card size
  const itemsPerPage = getItemsPerPage();
  const totalPages = Math.max(1, Math.ceil(filteredCoas.length / itemsPerPage));
  const paginatedCoas = filteredCoas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalArchivedPages = Math.max(1, Math.ceil(filteredArchivedCoas.length / itemsPerPage));
  const paginatedArchivedCoas = filteredArchivedCoas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Update current page when card size changes or filtered results change
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [filteredCoas.length, totalPages, currentPage, itemsPerPage]);

  const validateSQL = async () => {
    const trimmedSQL = sqlScript.trim();
    if (!trimmedSQL || trimmedSQL === INITIAL_SQL) {
      setValidationResult({ valid: false, error: "SQL Script is required" });
      return;
    }
    const syntaxValidation = validateComplexSQL(trimmedSQL);
    if (!syntaxValidation.valid) {
      setValidationResult(syntaxValidation);
      return;
    }
    setValidating(true);
    try {
      const sqlWithPlaceholdersReplaced = replacePlaceholders(trimmedSQL);
      const res = await api.post("/api/coa/validate-sql", {
        sqlScript: sqlWithPlaceholdersReplaced
      });
      if (res.data && typeof res.data === 'object') {
        setValidationResult(res.data);
      } else if (typeof res.data === 'boolean') {
        setValidationResult({
          valid: res.data,
          message: res.data ? "SQL is valid" : "SQL validation failed"
        });
      } else {
        setValidationResult({
          valid: false,
          error: "Invalid response from server"
        });
      }
    } catch (err) {
      console.error("Validation error:", err);
      if (err.response?.data) {
        setValidationResult(err.response.data);
      } else {
        setValidationResult({
          valid: false,
          error: err.message || "Validation failed. Please check your connection."
        });
      }
    } finally {
      setValidating(false);
    }
  };

  const handleSqlScriptChange = (value) => {
    setSqlScript(value);
    if (validationResult) {
      setValidationResult(null);
    }
    if (validationErrors.sqlScript) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.sqlScript;
        return newErrors;
      });
    }
  };

  const insertSafeDivisionExample = (example) => {
    const editor = document.querySelector('.react-simple-code-editor textarea');
    if (editor) {
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const newSql = sqlScript.substring(0, start) + example + sqlScript.substring(end);
      setSqlScript(newSql);
      setTimeout(() => {
        editor.focus();
        editor.setSelectionRange(start + example.length, start + example.length);
      }, 0);
    }
  };

  const handleRefresh = () => {
    fetchCOAs();
    if (showArchived) {
      fetchArchivedCOAs();
    }
  };

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

  const insertPlaceholder = (placeholder) => {
    const editor = document.querySelector('.react-simple-code-editor textarea');
    if (editor) {
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const newSql = sqlScript.substring(0, start) + placeholder + sqlScript.substring(end);
      setSqlScript(newSql);
      setTimeout(() => {
        editor.focus();
        editor.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 0);
    }
  };

  const sqlPlaceholders = detectPlaceholders(sqlScript);

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

  // Render COA Card based on size
  const renderCOACard = (c, idx, isArchived = false) => {
    const sizeConfig = CARD_SIZE_CONFIG[cardSize];

    if (isArchived) {
      // Archived cards have a simpler design
      return (
        <div
          key={c.coaId || idx}
          className="bg-white rounded-xl shadow border border-gray-200 flex flex-col transition-all duration-300 hover:shadow-md h-[500px] max-h-[500px] overflow-hidden"
        >
          <div className="p-6 flex-1 flex flex-col min-h-0 overflow-hidden">
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
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <p className="text-gray-600 wrap-break-word text-sm">
                <span className="font-bold">Description:</span> {c.description || "No description provided."}
              </p>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-500 mb-1">SQL</p>
                <div className="bg-gray-800 border border-gray-800 rounded-lg overflow-auto min-h-[120px] max-h-[180px]">
                  <pre className="p-3 text-xs text-emerald-200 font-mono whitespace-pre-wrap">
                    <code>{c.sqlScript}</code>
                  </pre>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
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
          </div>
          <div className="p-6 pt-0 mt-auto border-t border-gray-100">
            <div className="mt-4 flex justify-between gap-2 pt-4">
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
      );
    }

    // Active COA cards with size variations
    return (
      <div
        key={c.coaId || idx}
        className={`bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col transition-all duration-300 hover:shadow-xl h-[${sizeConfig.height}] max-h-[${sizeConfig.height}] overflow-hidden`}
      >
        <div className={`${sizeConfig.padding} flex-1 flex flex-col min-h-0 overflow-hidden`}>
          {/* Card Header */}
          <div className="flex justify-between items-start gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className={`${sizeConfig.titleSize} font-extrabold text-blue-800 wrap-break-word`}>
                  {c.coaCode}
                </p>
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
              <p className={`${sizeConfig.textSize === 'text-sm' ? 'text-xs' : 'text-sm'} text-gray-500 mt-1 wrap-break-word`}>
                {c.coaName}
              </p>
            </div>
            {/* Only show expand button in medium/large sizes when SQL is shown */}
            {sizeConfig.showSql && (
              <button
                onClick={() => toggleCardExpansion(c.coaId)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-expanded={expandedCards[c.coaId]}
                aria-label={expandedCards[c.coaId] ? "Collapse details" : "Expand details"}
              >
                {expandedCards[c.coaId] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            )}
          </div>

          {/* Card Content */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {/* Description - Show in all sizes */}
            {sizeConfig.showDescription && (
              <div className="transition-all duration-300">
                <p className={`text-gray-600 wrap-break-word ${sizeConfig.textSize === 'text-sm' ? 'text-xs' : 'text-sm'}`}>
                  <span className="font-bold">Description:</span> {c.description || "No description provided."}
                </p>
              </div>
            )}

            {/* SQL Section - Only show in medium/large sizes */}
            {sizeConfig.showSql && (
              <div className="flex-1 flex flex-col min-h-0">
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
                <div
                  className={`flex-1 bg-gray-800 border border-gray-800 rounded-lg overflow-auto min-h-[${sizeConfig.sqlHeight}] ${expandedCards[c.coaId] ? 'max-h-[400px]' : `max-h-[${sizeConfig.sqlHeight}]`}`}
                >
                  <pre className="p-4 text-sm text-emerald-200 font-mono whitespace-pre-wrap wrap-break-word">
                    <code>{c.sqlScript}</code>
                  </pre>
                </div>
              </div>
            )}

            {/* Metadata - Show in medium/large sizes */}
            {sizeConfig.showMetadata && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-right text-xs text-gray-400">
                  Created by: {c.createdByName || c.createdBy || "N/A"}
                  {c.modifiedByName && sizeConfig.showFullMetadata && (
                    <span className="ml-2">| Modified by: {c.modifiedByName}</span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Card Footer - Show in all sizes */}
        <div className={`${sizeConfig.padding} pt-0 mt-auto border-t border-gray-100`}>
          <div className={`mt-4 flex ${sizeConfig.compact ? 'justify-between gap-1' : 'justify-between gap-2'} pt-4`}>
            <button
              onClick={() => {
                setEditingCoa(c);
                setCoaCode(c.coaCode || "");
                setCoaName(c.coaName || "");
                setDescription(c.description || "");
                setSqlScript(c.sqlScript || INITIAL_SQL);
                setFormVisible(true);
              }}
              className={`${sizeConfig.compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'} bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition flex items-center gap-2`}
            >
              <FileText size={sizeConfig.compact ? 14 : 16} /> {sizeConfig.compact ? 'Edit' : 'Edit'}
            </button>
            <button
              onClick={() => handleArchiveCOA(c)}
              className={`${sizeConfig.compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'} bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex items-center gap-2`}
            >
              <Archive size={sizeConfig.compact ? 14 : 16} /> {sizeConfig.compact ? 'Archive' : 'Archive'}
            </button>
            {!sizeConfig.compact && (
              <button
                onClick={() => fetchVersionHistory(c.coaId)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
              >
                <History size={16} /> History
              </button>
            )}
          </div>
        </div>
      </div>
    );
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
          {/* Card Size Toggle */}
          <div className="flex items-center mr-4">
            <span className="text-sm text-gray-500 mr-2 hidden md:inline">View:</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {Object.values(CARD_SIZE_CONFIG).map((size) => (
                <button
                  key={size.name}
                  onClick={() => handleCardSizeChange(size.name)}
                  className={`px-3 py-1.5 text-xs rounded-md transition flex items-center gap-1 ${cardSize === size.name
                    ? 'bg-white shadow text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'}`}
                  title={`${size.name.charAt(0).toUpperCase() + size.name.slice(1)} view (${size.itemsPerPage} per page)`}
                >
                  {size.icon}
                  <span className="hidden sm:inline">{size.name}</span>
                  <span className="text-xs opacity-70 ml-1">({size.itemsPerPage})</span>
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center gap-1"
            title="Refresh"
            disabled={fetchingCOAs || fetchingArchived}
          >
            <RefreshCw size={16} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => { resetForm(); setFormVisible(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-blue-700 hover:scale-105 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Add new Chart of Account"
            disabled={fetchingCOAs}
          >
            <Plus size={16} /> <span className="hidden sm:inline">Add New COA</span>
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
                  ? `Viewing ${filteredArchivedCoas.length} archived COAs in ${cardSize} view (${itemsPerPage} per page)`
                  : `Viewing ${filteredCoas.length} active COAs in ${cardSize} view (${itemsPerPage} per page)`}
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
                {!showArchived && (
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 opacity-90"></span>
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <FileText size={16} className={!showArchived ? 'text-white' : 'text-gray-600'} />
                  <span>Active</span>
                  {!showArchived && (
                    <span className="bg-white/20 text-white/90 text-xs font-bold px-2 py-0.5 rounded-full">
                      {coaList.length}
                    </span>
                  )}
                </span>
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
                {showArchived && (
                  <span className="absolute inset-0 bg-gradient-to-r from-gray-700 to-gray-800 opacity-90"></span>
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Archive size={16} className={showArchived ? 'text-white' : 'text-gray-600'} />
                  <span>Archived</span>
                  {showArchived && (
                    <span className="bg-white/20 text-white/90 text-xs font-bold px-2 py-0.5 rounded-full">
                      {archivedList.length}
                    </span>
                  )}
                </span>
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
            <div className="ml-4">
              {showArchived ? (
                <span className="text-sm text-gray-500">
                  Page {currentPage} of {totalArchivedPages} • {filteredArchivedCoas.length} of {archivedList.length} archived COAs
                </span>
              ) : (
                <span className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages} • {filteredCoas.length} of {coaList.length} active COAs
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
              {fetchingCOAs && coaList.length === 0 && (
                <div className="text-center py-16">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Loading Active COAs...</p>
                </div>
              )}
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
              {!fetchingCOAs && coaList.length > 0 && (
                <>
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
                  <div className={`grid ${CARD_SIZE_CONFIG[cardSize].gridCols} gap-6 pb-20`} ref={cardsContainerRef}>
                    {paginatedCoas.map((c, idx) => renderCOACard(c, idx, false))}
                  </div>
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
              {fetchingArchived && archivedList.length === 0 && (
                <div className="text-center py-16">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mb-4"></div>
                  <p className="text-gray-600">Loading Archived COAs...</p>
                </div>
              )}
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
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                    {paginatedArchivedCoas.map((c, idx) => renderCOACard(c, idx, true))}
                  </div>
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
                        <div className="mb-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Tag size={16} className="text-gray-500" />
                            <p className="text-sm font-semibold text-gray-700">Changes</p>
                          </div>
                          <div className="p-3 bg-gray-100 rounded text-sm text-gray-700 whitespace-pre-wrap">
                            {changesString}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <FileText size={16} className="text-gray-500" />
                            <p className="text-sm font-semibold text-gray-700">SQL Script</p>
                            <span className="text-xs text-gray-500 ml-auto">
                              {version.sqlScript?.split('\n').length || 0} lines
                            </span>
                          </div>
                          <div className="bg-gray-800 border border-gray-800 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                            <p className="p-4 text-sm text-emerald-200 font-mono overflow-x-auto">
                              <code>{version.sqlScript || "No SQL script available"}</code>
                            </p>
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
      {/* Add/Edit COA Modal with Glassmorphic Effect */}
      {formVisible && (
        <div
          className="fixed inset-0 backdrop-blur-sm bg-white/30 z-50 flex justify-center items-center"
          onClick={resetForm}
        >
          <div
            className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-6xl mx-4 relative p-8 border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={resetForm}
              className="absolute top-4 right-4 text-gray-700 hover:text-red-600 bg-white/80 backdrop-blur-sm p-2 rounded-full border border-white/30"
              title="Close Form"
              aria-label="Close form"
            >
              <X size={24} />
            </button>
            <h3 className="text-2xl font-bold mb-4 text-blue-600 flex items-center gap-2">
              {editingCoa ? <FileText size={24} /> : <Plus size={24} />}
              {editingCoa ? "Edit COA" : "Add New COA"}
            </h3>
            {currentUser && (
              <div className="mb-4 p-3 bg-blue-50/70 backdrop-blur-sm rounded-lg border border-blue-200/50">
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
                  className={`mt-1 border p-3 rounded-lg w-full outline-none focus:ring-2 backdrop-blur-sm bg-white/70 ${validationErrors.coaCode
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
                  className={`mt-1 border p-3 rounded-lg w-full outline-none focus:ring-2 backdrop-blur-sm bg-white/70 ${validationErrors.coaName
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
                className="mt-1 border p-3 rounded-lg w-full outline-none focus:ring-2 focus:ring-blue-200 border-gray-300 backdrop-blur-sm bg-white/70"
                placeholder="Optional description"
              />
            </label>
            <label className="block mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700 font-medium">SQL Script *</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDivisionSafetyHelp(!showDivisionSafetyHelp)}
                    className="text-sm text-amber-600 hover:text-amber-800 flex items-center gap-1"
                  >
                    <ShieldAlert size={14} />
                    {showDivisionSafetyHelp ? "Hide Safety Help" : "Show Safety Help"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPlaceholderHelp(!showPlaceholderHelp)}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <Calendar size={14} />
                    {showPlaceholderHelp ? "Hide Placeholders" : "Show Placeholders"}
                  </button>
                </div>
              </div>
              {showDivisionSafetyHelp && (
                <div className="mb-3 p-3 bg-amber-50/80 backdrop-blur-sm rounded-lg border border-amber-200/70">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-amber-800">Division Safety Help</p>
                    {divisionSafetyIssues.length > 0 && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">
                        {divisionSafetyIssues.length} unsafe division{divisionSafetyIssues.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-amber-700 mb-2">
                    Prevent division by zero errors by using safety measures in your SQL:
                  </p>
                  {divisionSafetyIssues.length > 0 && (
                    <div className="mb-3 p-2 bg-red-50/80 border border-red-200/70 rounded">
                      <p className="text-xs font-medium text-red-800 mb-1">Unsafe divisions detected:</p>
                      <ul className="text-xs text-red-700 space-y-1">
                        {divisionSafetyIssues.map((issue, idx) => (
                          <li key={idx} className="flex items-start gap-1">
                            <span className="text-red-500 mt-0.5">•</span>
                            <span><code className="bg-red-100 px-1 rounded">{issue.division}</code> - {issue.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mb-2">
                    <p className="text-xs font-medium text-amber-800 mb-1">Safe division examples:</p>
                    <div className="space-y-2">
                      {SAFE_DIVISION_EXAMPLES.map((example, idx) => (
                        <div key={idx} className="text-xs">
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <div className="text-red-600 line-through mb-1">
                                <code className="bg-red-50 px-1 rounded">{example.unsafe}</code>
                              </div>
                              <div className="text-green-700">
                                <code className="bg-green-50 px-1 rounded">{example.safe}</code>
                              </div>
                              <div className="text-amber-600 text-xs mt-1">
                                {example.description}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => insertSafeDivisionExample(example.safe)}
                              className="px-2 py-1 text-xs bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition"
                            >
                              Insert
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-amber-600">
                    <strong>Best practices:</strong> Always use NULLIF, CASE WHEN, or COALESCE to handle potential division by zero.
                  </div>
                </div>
              )}
              {showPlaceholderHelp && (
                <div className="mb-3 p-3 bg-blue-50/80 backdrop-blur-sm rounded-lg border border-blue-200/70">
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
                        className="px-2 py-1 text-xs bg-white/80 backdrop-blur-sm border border-blue-300 text-blue-700 rounded hover:bg-blue-50 transition"
                      >
                        {placeholder}
                      </button>
                    ))}
                  </div>
                  {sqlPlaceholders.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-blue-200/70">
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
              <div
                className={`mt-2 border rounded-lg shadow-lg overflow-hidden bg-[#1e1e1e] ${validationErrors.sqlScript ? 'border-red-500' : 'border-gray-300'}`}
                style={{ maxHeight: '300px', overflow: 'auto' }}
              >
                <div className="flex min-h-[180px]">
                  <div className="bg-[#1e1e1e] text-gray-500 text-right py-3 px-3 select-none sticky top-0" style={{ lineHeight: "1.5rem" }}>
                    {sqlScript.split("\n").map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  <div className="flex-1 overflow-auto">
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
                        minHeight: '180px',
                        width: '100%',
                      }}
                      textareaClassName="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
                      preClassName="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
                      aria-label="SQL Script Editor"
                    />
                  </div>
                </div>
              </div>
              {validationErrors.sqlScript && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.sqlScript}</p>
              )}
              {sqlPlaceholders.length > 0 && !showPlaceholderHelp && (
                <div className="mt-2 p-2 bg-green-50/80 backdrop-blur-sm border border-green-200/70 rounded flex items-center justify-between">
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
              {divisionSafetyIssues.length > 0 && !showDivisionSafetyHelp && (
                <div className="mt-2 p-2 bg-red-50/80 backdrop-blur-sm border border-red-200/70 rounded flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={14} className="text-red-600" />
                    <span className="text-sm text-red-700">
                      {divisionSafetyIssues.length} unsafe division{divisionSafetyIssues.length > 1 ? 's' : ''} detected. Your query may fail due to division by zero.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDivisionSafetyHelp(true)}
                    className="text-xs text-red-700 hover:text-red-900 underline"
                  >
                    View fixes
                  </button>
                </div>
              )}
            </label>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={validateSQL}
                disabled={validating || !sqlScript.trim() || sqlScript.trim() === INITIAL_SQL}
                className={`px-4 py-2 rounded-lg font-semibold shadow-md transition flex items-center gap-2 backdrop-blur-sm ${validating || !sqlScript.trim() || sqlScript.trim() === INITIAL_SQL
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
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 backdrop-blur-sm ${validationResult.valid
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
                  {validationResult.databaseType && (
                    <span className="text-xs text-gray-500">
                      Database: {validationResult.databaseType}
                    </span>
                  )}
                </div>
              )}
              {sqlPlaceholders.length > 0 && validationResult && validationResult.valid && (
                <div className="text-xs text-green-600 bg-green-50/80 backdrop-blur-sm px-2 py-1 rounded">
                  ✓ Placeholders replaced with dummy values during validation
                </div>
              )}
            </div>
            <div className="mt-8 flex items-center gap-3">
              <button
                onClick={editingCoa ? handleUpdateCOA : handleAddCOA}
                disabled={loading}
                className={`px-6 py-2 rounded-lg font-semibold shadow-md transition flex items-center gap-2 backdrop-blur-sm ${loading
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
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition flex items-center gap-2 backdrop-blur-sm"
                  aria-label="Archive COA"
                >
                  <Archive size={16} /> Archive COA
                </button>
              )}
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition backdrop-blur-sm bg-white/70"
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