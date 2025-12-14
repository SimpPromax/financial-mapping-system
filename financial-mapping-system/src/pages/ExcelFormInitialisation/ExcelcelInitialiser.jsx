/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';
import { Plus, Save, Eye, X, Search, FileText, ChevronRight, RefreshCw } from 'lucide-react';

const ExcelDataCollector = () => {
  // Save state to localStorage
  const saveStateToLocalStorage = (state) => {
    localStorage.setItem('excelCollectorState', JSON.stringify({
      sheets: state.sheets,
      sheetData: state.sheetData,
      sheetUnsavedStatus: state.sheetUnsavedStatus,
      selectedSheetId: state.selectedSheetId,
      hasLoadedInitialData: state.hasLoadedInitialData,
      initialSheetData: state.initialSheetData
    }));
  };

  // Load state from localStorage
  const loadStateFromLocalStorage = () => {
    const saved = localStorage.getItem('excelCollectorState');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error('Error loading saved state:', error);
      }
    }
    return null;
  };

  // Load initial state from localStorage or use defaults
  const savedState = loadStateFromLocalStorage();

  const [sheets, setSheets] = useState(savedState?.sheets || []);
  const [availableSheetNames, setAvailableSheetNames] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSheetId, setSelectedSheetId] = useState(savedState?.selectedSheetId || null);
  const [loadingSheetId, setLoadingSheetId] = useState(null);
  const [sheetElementCounts, setSheetElementCounts] = useState({});
  const [showAddSuccess, setShowAddSuccess] = useState(false);
  const [sheetUnsavedStatus, setSheetUnsavedStatus] = useState(savedState?.sheetUnsavedStatus || {});
  const [sheetData, setSheetData] = useState(savedState?.sheetData || {});
  const [initialSheetData, setInitialSheetData] = useState(savedState?.initialSheetData || {});
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(savedState?.hasLoadedInitialData || false);
  const [animatingSheetId, setAnimatingSheetId] = useState(null);

  // Save state to localStorage whenever relevant state changes
  useEffect(() => {
    saveStateToLocalStorage({
      sheets,
      sheetData,
      sheetUnsavedStatus,
      selectedSheetId,
      hasLoadedInitialData,
      initialSheetData
    });
  }, [sheets, sheetData, sheetUnsavedStatus, selectedSheetId, hasLoadedInitialData, initialSheetData]);

  // Function to update unsaved sheets count for header notification
  const updateUnsavedSheetsCount = () => {
    const unsavedCount = Object.keys(sheetUnsavedStatus).filter(
      sheetId => sheetUnsavedStatus[sheetId]
    ).length;

    localStorage.setItem('unsavedSheetsCount', unsavedCount.toString());

    window.dispatchEvent(new CustomEvent('unsavedSheetsChanged', {
      detail: { count: unsavedCount }
    }));
  };

  // Function to check if sheet has unsaved changes compared to initial state
  const checkSheetHasUnsavedChanges = (sheetId) => {
    const currentElements = sheetData[sheetId]?.elements || [];
    const initialElements = initialSheetData[sheetId]?.elements || [];

    if (currentElements.length !== initialElements.length) {
      return true;
    }

    for (let i = 0; i < currentElements.length; i++) {
      const currentElement = currentElements[i];
      const initialElement = initialElements[i];

      if (!initialElement ||
        currentElement.elementName !== initialElement.elementName ||
        currentElement.cellValue !== initialElement.cellValue) {
        return true;
      }
    }

    return false;
  };

  // Update unsaved status whenever sheetData changes
  useEffect(() => {
    const newUnsavedStatus = {};

    sheets.forEach(sheet => {
      if (sheetData[sheet.id] && initialSheetData[sheet.id]) {
        newUnsavedStatus[sheet.id] = checkSheetHasUnsavedChanges(sheet.id);
      }
    });

    setSheetUnsavedStatus(newUnsavedStatus);
  }, [sheetData, initialSheetData, sheets]);

  // Call updateUnsavedSheetsCount whenever sheetUnsavedStatus changes
  useEffect(() => {
    updateUnsavedSheetsCount();
  }, [sheetUnsavedStatus]);

  // Load sheets from backend API
  useEffect(() => {
    const loadSheetsFromBackend = async () => {
      // Only load from server if we don't have saved data
      if (hasLoadedInitialData && sheets.length > 0) {
        return;
      }

      try {
        setIsLoading(true);

        // 1. Load all sheets from backend
        const sheetsResponse = await api.get('/api/excel/sheets');
        const backendSheets = Array.isArray(sheetsResponse.data) ? sheetsResponse.data : [];

        console.log('📊 Loaded sheets from backend:', backendSheets);

        // Transform backend data to frontend format
        const transformedSheets = backendSheets.map(sheet => ({
          id: sheet.sheetId,
          sheetName: sheet.excellSheetName,
          headerText: sheet.excellSheetName,
          elementCount: sheet.excelElements?.length || 0
        }));

        setSheets(transformedSheets);

        // Load element counts
        const countsResponse = await api.get('/api/excel/all-counts');
        const countsMap = countsResponse.data || {};
        setSheetElementCounts(countsMap);

        // Initialize sheet data storage
        const initialSheetDataObj = {};
        const sheetDataObj = {};

        transformedSheets.forEach(sheet => {
          initialSheetDataObj[sheet.id] = {
            elements: [],
            lastLoaded: null
          };
          sheetDataObj[sheet.id] = {
            elements: [],
            lastLoaded: null
          };
        });

        setInitialSheetData(initialSheetDataObj);
        setSheetData(sheetDataObj);

        // Select first sheet if available
        if (transformedSheets.length > 0 && !selectedSheetId) {
          setSelectedSheetId(transformedSheets[0].id);
        }

        setHasLoadedInitialData(true);
      } catch (error) {
        console.error('Error loading sheets from backend:', error);

        // Fallback to sample data if backend fails
        const fallbackSheets = [
          {
            id: 1,
            sheetName: 'Sample Sheet 1',
            headerText: 'Sample Sheet 1',
            elementCount: 0
          },
          {
            id: 2,
            sheetName: 'Sample Sheet 2',
            headerText: 'Sample Sheet 2',
            elementCount: 0
          }
        ];

        if (!savedState) {
          setSheets(fallbackSheets);

          const fallbackInitialSheetData = {};
          const fallbackSheetData = {};
          fallbackSheets.forEach(sheet => {
            fallbackInitialSheetData[sheet.id] = {
              elements: [],
              lastLoaded: null
            };
            fallbackSheetData[sheet.id] = {
              elements: [],
              lastLoaded: null
            };
          });
          setInitialSheetData(fallbackInitialSheetData);
          setSheetData(fallbackSheetData);
        }

        if (fallbackSheets.length > 0 && !selectedSheetId) {
          setSelectedSheetId(fallbackSheets[0].id);
        }
        setHasLoadedInitialData(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadSheetsFromBackend();
  }, []);

  // Automatically load elements for all sheets when component mounts or when sheets are loaded
  useEffect(() => {
    const loadAllSheetsElements = async () => {
      if (sheets.length === 0 || !hasLoadedInitialData) return;

      console.log('🔄 Loading elements for all sheets...');

      for (const sheet of sheets) {
        // Only load if we don't have the data already (from localStorage or previous load)
        const hasData = sheetData[sheet.id]?.elements && sheetData[sheet.id]?.elements.length > 0;
        const hasLastLoaded = sheetData[sheet.id]?.lastLoaded;

        if (!hasData || !hasLastLoaded) {
          console.log(`📥 Loading elements for sheet ID: ${sheet.id}`);
          await handleSheetSelect(sheet.id, false);
        } else {
          console.log(`✅ Sheet ${sheet.sheetName} already has data, skipping load`);
        }
      }
    };

    loadAllSheetsElements();
  }, [sheets, hasLoadedInitialData]);

  // ✅ REFRESH LOGIC: Clear localStorage and reload fresh data from backend
  const handleRefresh = async () => {
    // Clear localStorage
    localStorage.removeItem('excelCollectorState');

    // Reset all state to initial values
    setSheets([]);
    setSheetData({});
    setInitialSheetData({});
    setSheetUnsavedStatus({});
    setSelectedSheetId(null);
    setHasLoadedInitialData(false);

    try {
      setIsLoading(true);

      // 1. Load all sheets from backend
      const sheetsResponse = await api.get('/api/excel/sheets');
      const backendSheets = Array.isArray(sheetsResponse.data) ? sheetsResponse.data : [];

      console.log('📊 Refreshed sheets from backend:', backendSheets);

      // Transform backend data to frontend format
      const transformedSheets = backendSheets.map(sheet => ({
        id: sheet.sheetId,
        sheetName: sheet.excellSheetName,
        headerText: sheet.excellSheetName,
        elementCount: sheet.excelElements?.length || 0
      }));

      setSheets(transformedSheets);

      // Load element counts
      const countsResponse = await api.get('/api/excel/all-counts');
      const countsMap = countsResponse.data || {};
      setSheetElementCounts(countsMap);

      // Initialize fresh sheet data
      const initialSheetDataObj = {};
      const sheetDataObj = {};

      transformedSheets.forEach(sheet => {
        initialSheetDataObj[sheet.id] = {
          elements: [],
          lastLoaded: null
        };
        sheetDataObj[sheet.id] = {
          elements: [],
          lastLoaded: null
        };
      });

      setInitialSheetData(initialSheetDataObj);
      setSheetData(sheetDataObj);

      // Select first sheet if available
      if (transformedSheets.length > 0) {
        setSelectedSheetId(transformedSheets[0].id);
      }

      setHasLoadedInitialData(true);
      showAlert('success', 'Sheets refreshed successfully!');
    } catch (error) {
      console.error('Error refreshing sheets:', error);
      showAlert('error', 'Failed to refresh sheets');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshElementCounts = async () => {
    try {
      const countsResponse = await api.get('/api/excel/all-counts');
      const countsMap = countsResponse.data || {};
      setSheetElementCounts(countsMap);

      setSheets(prev => prev.map(sheet => ({
        ...sheet,
        elementCount: countsMap[sheet.sheetName] || 0
      })));
    } catch (error) {
      console.error('Error refreshing element counts:', error);
    }
  };

  const filteredSheets = useMemo(() => {
    return sheets.filter(sheet =>
      sheet.sheetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sheet.headerText.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sheets, searchTerm]);

  const selectedSheet = sheets.find(sheet => sheet.id === selectedSheetId);
  const selectedSheetElements = selectedSheetId ? sheetData[selectedSheetId]?.elements || [] : [];

  const showAlert = (type, message) => {
    Swal.fire({
      icon: type,
      title: message,
      timer: 500,
      timerProgressBar: true,
      showConfirmButton: false,
      position: 'top-end',
      toast: true
    });
  };

  const handleSheetSelect = async (sheetId, shouldSwitchSelection = true) => {
    if (shouldSwitchSelection) {
      setAnimatingSheetId(sheetId);
      setSelectedSheetId(sheetId);

      setTimeout(() => {
        setAnimatingSheetId(null);
      }, 600);
    }

    const sheet = sheets.find(s => s.id === sheetId);
    if (!sheet) return;

    // Only load from server if we don't have the data already
    const hasData = sheetData[sheetId]?.elements && sheetData[sheetId]?.elements.length > 0;
    const hasLastLoaded = sheetData[sheetId]?.lastLoaded;

    if (!hasData || !hasLastLoaded) {
      setLoadingSheetId(sheetId);

      try {
        // Use the new endpoint to get elements by sheet ID
        const response = await api.get(`/api/excel/sheets/${sheetId}/elements`);
        const backendElements = Array.isArray(response.data) ? response.data : [];

        const newElements = backendElements.map(el => ({
          id: el.elementId, // REAL ID from backend
          elementName: el.excelElement || '',
          cellValue: el.exelCellValue || ''
        }));

        setSheetData(prev => ({
          ...prev,
          [sheetId]: {
            elements: newElements,
            lastLoaded: new Date().toISOString()
          }
        }));

        setInitialSheetData(prev => ({
          ...prev,
          [sheetId]: {
            elements: JSON.parse(JSON.stringify(newElements)),
            lastLoaded: new Date().toISOString()
          }
        }));

        console.log(`📥 Loaded ${newElements.length} elements for sheet ID: ${sheetId}`);
      } catch (error) {
        console.error('Error loading elements:', error);

        // Fallback: try to get sheet data directly
        try {
          const sheetResponse = await api.get(`/api/excel/sheets/${sheetId}`);
          const sheetDataResponse = sheetResponse.data;

          const elementsFromSheet = sheetDataResponse.excelElements || [];
          const newElements = elementsFromSheet.map(el => ({
            id: el.elementId, // REAL ID from backend
            elementName: el.excelElement || '',
            cellValue: el.exelCellValue || ''
          }));

          setSheetData(prev => ({
            ...prev,
            [sheetId]: {
              elements: newElements,
              lastLoaded: new Date().toISOString()
            }
          }));

          setInitialSheetData(prev => ({
            ...prev,
            [sheetId]: {
              elements: JSON.parse(JSON.stringify(newElements)),
              lastLoaded: new Date().toISOString()
            }
          }));
        } catch (fallbackError) {
          console.error('Fallback error loading sheet:', fallbackError);
          showAlert('error', 'Could not load Excel elements');
          setSheetData(prev => ({
            ...prev,
            [sheetId]: {
              elements: [],
              lastLoaded: new Date().toISOString()
            }
          }));
          setInitialSheetData(prev => ({
            ...prev,
            [sheetId]: {
              elements: [],
              lastLoaded: new Date().toISOString()
            }
          }));
        }
      } finally {
        setLoadingSheetId(null);
      }
    }
  };

  const addNewElement = () => {
    if (!selectedSheetId) return;

    const currentElements = sheetData[selectedSheetId]?.elements || [];

    let nextCellValue = '';

    if (currentElements.length > 0) {
      const lastElement = currentElements[0]; // Topmost = most recently added
      const lastValue = lastElement.cellValue?.trim();

      // Regex to match Excel-style cell refs: letters + numbers (e.g., C12, AA100)
      const match = lastValue.match(/^([A-Za-z]+)(\d+)$/);
      if (match) {
        const col = match[1]; // e.g., "C" or "AA"
        const row = parseInt(match[2], 10); // e.g., 12

        if (!isNaN(row) && row >= 1) {
          nextCellValue = col.toUpperCase() + (row + 1); // e.g., C12 → C13
        }
      }
    }

    // Create new element with auto-incremented (or empty) cellValue
    const newElement = {
      id: `temp-${Date.now()}-${Math.random()}`,
      elementName: '',
      cellValue: nextCellValue // Could be '', 'C13', 'AA101', etc.
    };

    setSheetData(prev => ({
      ...prev,
      [selectedSheetId]: {
        ...prev[selectedSheetId],
        elements: [newElement, ...(prev[selectedSheetId]?.elements || [])]
      }
    }));

    setShowAddSuccess(true);
    setTimeout(() => setShowAddSuccess(false), 2000);
  };

  const deleteElement = async (elementId) => {
    if (!selectedSheetId) return;

    const currentElements = sheetData[selectedSheetId]?.elements || [];
    const element = currentElements.find(el => el.id === elementId);
    const elementName = element?.elementName || 'this element';

    Swal.fire({
      title: 'Are you sure?',
      text: `You want to delete "${elementName}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          // If element has a REAL ID (not temporary), delete from backend
          if (elementId && typeof elementId === 'number') {
            await api.delete(`/api/excel/elements/${elementId}`);
            showAlert('success', 'Element deleted successfully!');
          }

          // Update local state
          setSheetData(prev => ({
            ...prev,
            [selectedSheetId]: {
              ...prev[selectedSheetId],
              elements: (prev[selectedSheetId]?.elements || []).filter(el => el.id !== elementId)
            }
          }));

          // Refresh element counts
          refreshElementCounts();
        } catch (error) {
          console.error('Error deleting element:', error);
          showAlert('error', 'Failed to delete element');
        }
      }
    });
  };

  const updateElement = (elementId, field, value) => {
    if (!selectedSheetId) return;

    setSheetData(prev => ({
      ...prev,
      [selectedSheetId]: {
        ...prev[selectedSheetId],
        elements: (prev[selectedSheetId]?.elements || []).map(el =>
          el.id === elementId ? { ...el, [field]: value } : el
        )
      }
    }));
  };

  const validateCurrentSheet = () => {
    if (!selectedSheetId) {
      return { isValid: false, message: 'No sheet selected.' };
    }

    const sheet = sheets.find(s => s.id === selectedSheetId);
    if (!sheet) {
      return { isValid: false, message: 'Selected sheet not found.' };
    }

    const currentElements = sheetData[selectedSheetId]?.elements || [];

    if (currentElements.length === 0) {
      return {
        isValid: false,
        message: `Sheet "${sheet.headerText}" has no elements. Please add at least one element.`
      };
    }

    const emptyElements = [];
    currentElements.forEach((element, index) => {
      const elementName = element.elementName.trim();
      const cellValue = element.cellValue.trim();

      if (!elementName || !cellValue) {
        emptyElements.push({
          elementIndex: index + 1,
          missingField: !elementName ? 'Line Item' : 'Cell Value'
        });
      }
    });

    if (emptyElements.length > 0) {
      const errorDetails = emptyElements.map(item =>
        `Element ${item.elementIndex}: Missing ${item.missingField}`
      ).join('\n');

      return {
        isValid: false,
        message: `Please fill in all fields in "${sheet.headerText}":\n${errorDetails}`
      };
    }

    const elementNames = new Set();
    const cellValues = new Set();
    const duplicateErrors = [];

    for (const element of currentElements) {
      const name = element.elementName.trim();
      const value = element.cellValue.trim();

      if (elementNames.has(name)) {
        duplicateErrors.push(`Duplicate Line Item: "${name}"`);
      }
      elementNames.add(name);

      if (cellValues.has(value)) {
        duplicateErrors.push(`Duplicate Cell Value: "${value}"`);
      }
      cellValues.add(value);
    }

    if (duplicateErrors.length > 0) {
      return {
        isValid: false,
        message: `Duplicate entries in "${sheet.headerText}":\n${duplicateErrors.join('\n')}`
      };
    }

    return { isValid: true, message: 'Sheet is valid.' };
  };

  const saveCurrentSheet = async () => {
    const validation = validateCurrentSheet();

    if (!validation.isValid) {
      Swal.fire({
        icon: 'error',
        title: 'Cannot Save Sheet',
        html: validation.message.replace(/\n/g, '<br>'),
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    const sheet = sheets.find(s => s.id === selectedSheetId);
    const currentElements = sheetData[selectedSheetId]?.elements || [];

    // Prepare payload for backend
    // Send NULL for elementId if it's a temporary ID (starts with 'temp-')
    const payload = {
      excellSheetName: sheet.sheetName,
      excelElements: currentElements.map(el => ({
        elementId: el.id && typeof el.id === 'number' ? el.id : null,
        excelElement: el.elementName.trim(),
        exelCellValue: el.cellValue.trim()
      }))
    };

    console.log('📤 Saving sheet with payload:', payload);

    try {
      setIsLoading(true);

      // Use PUT to update the existing sheet
      const response = await api.put(`/api/excel/sheets/${sheet.id}`, payload);

      if (response.data.success) {
        // Update local state with new sheet data from backend
        const updatedSheetData = response.data.data;

        // Get the updated elements from backend response
        const updatedElements = (updatedSheetData.excelElements || []).map(el => ({
          id: el.elementId, // REAL ID from backend
          elementName: el.excelElement,
          cellValue: el.exelCellValue
        }));

        console.log('✅ Backend returned updated elements with IDs:', updatedElements);

        // Update sheets list
        setSheets(prev => prev.map(s =>
          s.id === sheet.id ? {
            ...s,
            sheetName: updatedSheetData.excellSheetName || s.sheetName,
            headerText: updatedSheetData.excellSheetName || s.headerText,
            elementCount: updatedElements.length
          } : s
        ));

        // Update sheet data with REAL IDs from backend
        setSheetData(prev => ({
          ...prev,
          [selectedSheetId]: {
            elements: updatedElements,
            lastLoaded: new Date().toISOString()
          }
        }));

        setInitialSheetData(prev => ({
          ...prev,
          [selectedSheetId]: {
            elements: JSON.parse(JSON.stringify(updatedElements)),
            lastLoaded: new Date().toISOString()
          }
        }));

        // Update element counts
        setSheetElementCounts(prev => ({
          ...prev,
          [sheet.sheetName]: updatedElements.length
        }));

        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: response.data.message || 'Sheet saved successfully!',
          timer: 500,
          timerProgressBar: true,
          showConfirmButton: false
        });
      } else {
        throw new Error(response.data.message || 'Error saving sheet');
      }
    } catch (error) {
      console.error('Save error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || error.message || 'Failed to save sheet',
        confirmButtonText: 'OK'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add keyboard shortcut for saving (Ctrl + S)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveCurrentSheet();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedSheetId, sheetData]);

  return (
    <div className="min-h-[80vh] bg-cover bg-center bg-fixed bg-gray-100">
      <div className="h-[80vh] flex flex-col">
        <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200 py-4 px-6">
          <div className="flex-1 text-center mx-4">
            <h2 className="text-3xl font-bold text-gray-800">Excel Data Collector</h2>
            <p className="text-xs text-gray-500">Manage and validate your Excel sheets</p>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Section - Sheet Cards */}
          <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleRefresh}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
                  title="Refresh sheet list"
                  disabled={isLoading}
                >
                  <RefreshCw size={20} className={`text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search sheets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="p-4 space-y-3">
                {filteredSheets.map((sheet) => {
                  const isLoadingSheet = loadingSheetId === sheet.id;
                  const isUnsaved = sheetUnsavedStatus[sheet.id];
                  const currentElements = sheetData[sheet.id]?.elements || [];
                  const isSelected = selectedSheetId === sheet.id;
                  const isAnimating = animatingSheetId === sheet.id;

                  return (
                    <div
                      key={sheet.id}
                      onClick={() => handleSheetSelect(sheet.id)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${isSelected
                        ? 'border-green-500 bg-green-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                        } ${currentElements.length > 0 ? 'bg-green-50' : 'bg-red-50'} ${isAnimating ? 'animate-horizontal-shake' : ''
                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1 min-w-0">
                          <FileText
                            size={20}
                            className={`mt-1 ${currentElements.length > 0 ? 'text-green-600' : 'text-red-500'}`}
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-800 truncate">
                              {sheet.headerText}
                            </h3>
                            <p className="text-sm text-gray-600 truncate">
                              {sheet.sheetName}
                            </p>
                            <div className="flex items-center flex-wrap gap-1 mt-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${currentElements.length > 0
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                                }`}>
                                {isLoadingSheet ? (
                                  <div className="flex items-center space-x-1">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
                                    <span>Loading...</span>
                                  </div>
                                ) : (
                                  currentElements.length > 0
                                    ? `${currentElements.length} element${currentElements.length !== 1 ? 's' : ''}`
                                    : 'No elements'
                                )}
                              </span>
                              {isUnsaved && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 animate-pulse">
                                  Unsaved
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* ChevronRight icon for visual balance */}
                        <ChevronRight
                          size={16}
                          className={`mt-1 transition-colors ${isSelected ? 'text-green-500' : 'text-gray-400'
                            } ${isAnimating ? 'animate-horizontal-shake' : ''}`}
                        />
                      </div>
                    </div>
                  );
                })}

                {filteredSheets.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <FileText size={32} className="mx-auto mb-2 text-gray-300" />
                    <p>No sheets found</p>
                    {searchTerm && (
                      <p className="text-sm">Try adjusting your search</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Section - Element Management */}
          <div className="w-2/3 bg-gray-50 flex flex-col">
            <div className="flex-1 flex flex-col overflow-hidden">
              {selectedSheet ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="bg-white border-b border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">
                          {selectedSheet.headerText}
                        </h3>
                        <p className="text-gray-600 text-sm">
                          {selectedSheet.sheetName}
                        </p>
                        <div className="flex items-center flex-wrap gap-1 mt-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${selectedSheetElements.length > 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                            }`}>
                            {selectedSheetElements.length > 0
                              ? `${selectedSheetElements.length} element${selectedSheetElements.length !== 1 ? 's' : ''}`
                              : 'No elements'
                            }
                          </span>
                          {sheetUnsavedStatus[selectedSheetId] && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 animate-pulse">
                              Unsaved
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <a
                          href="/viewsaveddata"
                          className="bg-white border border-gray-300 rounded-lg px-4 py-2 flex items-center space-x-2 text-gray-700 font-medium hover:bg-gray-50 transition-colors shadow-sm"
                        >
                          <Eye size={16} />
                          <span>View Saved Data</span>
                        </a>

                        <button
                          onClick={saveCurrentSheet}
                          disabled={isLoading}
                          className={`bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border-0 rounded-lg px-6 py-3 flex items-center space-x-2 font-medium text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95 transition-all duration-300 ${isLoading ? 'opacity-75 cursor-not-allowed' : ''
                            }`}
                        >
                          {isLoading ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <Save size={16} />
                          )}
                          <span>{isLoading ? 'Saving...' : 'Save Current Sheet'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden p-6">
                    <div className="h-full flex flex-col">
                      <div className="flex-1 overflow-y-auto scrollbar-hide">
                        <div className="space-y-3">
                          {selectedSheetElements.map((element) => (
                            <div key={element.id} className="flex flex-col md:flex-row gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Line Item
                                </label>
                                <input
                                  type="text"
                                  value={element.elementName}
                                  onChange={(e) => updateElement(element.id, 'elementName', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Line Item"
                                  maxLength={100}
                                  required
                                />
                              </div>

                              <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Cell Value
                                </label>
                                <input
                                  type="text"
                                  value={element.cellValue}
                                  onChange={(e) => updateElement(element.id, 'cellValue', e.target.value.toUpperCase())}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  placeholder="Cell Value"
                                  required
                                />
                              </div>

                              <div className="flex items-end">
                                <button
                                  onClick={() => deleteElement(element.id)}
                                  className="w-full md:w-auto px-3 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 transition-colors flex items-center space-x-1"
                                >
                                  <X size={14} />
                                  <span>Remove</span>
                                </button>
                              </div>
                            </div>
                          ))}

                          {selectedSheetElements.length === 0 && !loadingSheetId && (
                            <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                              <FileText size={48} className="mx-auto mb-3 text-gray-300" />
                              <h4 className="text-lg font-medium text-gray-600 mb-1">No Elements Added</h4>
                              <p className="text-gray-500 text-sm">Click "Add Element" to start defining your data points</p>
                            </div>
                          )}

                          {loadingSheetId === selectedSheetId && (
                            <div className="text-center py-12">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-3"></div>
                              <p className="text-gray-600">Loading elements...</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-200">
                        <button
                          onClick={addNewElement}
                          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-0 rounded-xl px-6 py-4 text-white font-semibold shadow-lg hover:shadow-2xl transform hover:scale-[1.02] hover:-translate-y-0.5 active:scale-95 active:translate-y-0 transition-all duration-300 flex items-center justify-center space-x-3 group relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                          <div className="relative z-10 flex items-center space-x-3">
                            <div className="bg-white/20 p-2 rounded-full group-hover:bg-white/30 group-hover:rotate-90 transition-all duration-500">
                              <Plus size={18} />
                            </div>
                            <span className="text-lg">Add Data Element</span>
                          </div>
                        </button>
                      </div>

                      {showAddSuccess && (
                        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-fadeIn z-50">
                          ✅ New element added to the top!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <FileText size={64} className="mx-auto mb-4 text-gray-300" />
                    <h3 className="text-xl font-medium text-gray-600 mb-2">No Sheet Selected</h3>
                    <p className="text-gray-500">Select a sheet from the left panel to start adding elements</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add CSS for the horizontal shake animation */}
      <style jsx>{`
        @keyframes horizontalShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          50% { transform: translateX(4px); }
          75% { transform: translateX(-2px); }
        }
        .animate-horizontal-shake {
          animation: horizontalShake 0.6s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ExcelDataCollector;