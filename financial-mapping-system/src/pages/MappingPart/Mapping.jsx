import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';
import { Search, Save, X, Move, CheckCircle, AlertCircle, Trash2, ArrowLeft, List, RefreshCw, FileSpreadsheet, Calendar, BarChart3, Users, Database, Hash, Clock } from 'lucide-react';

const Mapping = () => {
    // State for data
    const [sheets, setSheets] = useState([]);
    const [elements, setElements] = useState([]);
    const [coas, setCoas] = useState([]);
    const [mappings, setMappings] = useState([]);
    const [sheetElementsCount, setSheetElementsCount] = useState({}); // Store element counts per sheet

    // State for UI
    const [currentView, setCurrentView] = useState('sheet-selection');
    const [selectedSheet, setSelectedSheet] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [coaSearch, setCoaSearch] = useState('');
    const [sheetSearch, setSheetSearch] = useState('');
    const [draggedElement, setDraggedElement] = useState(null);
    const [dragOverCoa, setDragOverCoa] = useState(null);
    const [refreshingSheets, setRefreshingSheets] = useState(false);

    // Fetch data
    const fetchSheets = async () => {
        setRefreshingSheets(true);
        try {
            const res = await api.get('/api/excel-sheets');
            setSheets(res.data);

            // Fetch element counts for all sheets
            await fetchAllSheetElementsCounts(res.data);
        } catch (err) {
            console.error(err);
            Swal.fire({
                icon: 'error',
                title: 'Failed to Load Sheets',
                text: 'Unable to fetch Excel sheets. Please try again.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
            });
        } finally {
            setRefreshingSheets(false);
        }
    };

    const fetchAllSheetElementsCounts = async (sheetsData) => {
        const counts = {};

        // Fetch element counts for each sheet
        for (const sheet of sheetsData) {
            try {
                const res = await api.get(`/api/excel-elements?sheetId=${sheet.sheetId}`);
                counts[sheet.sheetId] = res.data.length;
            } catch (err) {
                console.error(`Failed to fetch elements for sheet ${sheet.sheetId}:`, err);
                counts[sheet.sheetId] = 0;
            }
        }

        setSheetElementsCount(counts);
    };

    const fetchCoas = async () => {
        try {
            const res = await api.get('/api/coa');
            setCoas(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchMappings = async () => {
        try {
            const res = await api.get('/api/mappings');
            setMappings(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchSheets();
        fetchCoas();
        fetchMappings();
    }, []);

    // Fetch elements when sheet changes
    useEffect(() => {
        if (selectedSheet) {
            const fetchElements = async () => {
                try {
                    const res = await api.get(`/api/excel-elements?sheetId=${selectedSheet}`);
                    console.log('📊 Elements response:', res.data);
                    setElements(res.data);

                    // Update element count for this sheet
                    setSheetElementsCount(prev => ({
                        ...prev,
                        [selectedSheet]: res.data.length
                    }));
                } catch (err) {
                    console.error(err);
                }
            };
            fetchElements();
        } else {
            setElements([]);
        }
    }, [selectedSheet]);

    // Navigation handlers
    const handleSheetSelect = (sheetId) => {
        setSelectedSheet(sheetId);
        setCurrentView('mapping');
    };

    const handleSelectAnotherSheet = () => {
        setCurrentView('sheet-selection');
    };

    const handleNavigateToSummary = () => {
        setCurrentView('summary');
    };

    const handleBackToMapping = () => {
        setCurrentView('mapping');
    };

    // Handle refresh sheets
    const handleRefreshSheets = async () => {
        await fetchSheets();
        await fetchMappings();

        Swal.fire({
            icon: 'success',
            title: 'Sheets Refreshed!',
            text: 'Excel sheets list has been updated.',
            timer: 1000,
            timerProgressBar: true,
            showConfirmButton: false
        });
    };

    // Filter functions
    const filteredSheets = sheets.filter(sheet =>
        sheet.excellSheetName?.toLowerCase().includes(sheetSearch.toLowerCase()) ||
        sheet.description?.toLowerCase().includes(sheetSearch.toLowerCase()) ||
        sheet.category?.toLowerCase().includes(sheetSearch.toLowerCase())
    );

    const filteredCoas = coas.filter(coa =>
        coa.coaName.toLowerCase().includes(coaSearch.toLowerCase()) ||
        coa.coaCode.toLowerCase().includes(coaSearch.toLowerCase())
    );

    const filteredElements = elements.filter(element =>
        element.excelElement.toLowerCase().includes(searchTerm.toLowerCase()) ||
        element.exelCellValue?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        element.cellReference?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Helper functions
    const unmappedElements = filteredElements.filter(element =>
        !mappings.some(mapping => mapping.elementId === element.elementId)
    );

    const getMappedElementsForCoa = (coaId) => {
        return mappings
            .filter(mapping => mapping.coaId === coaId)
            .map(mapping => {
                const element = elements.find(e => e.elementId === mapping.elementId);
                return element ? { ...element, mappingId: mapping.mappingId } : null;
            })
            .filter(Boolean);
    };

    const getSheetMappings = () => {
        return mappings.filter(mapping => mapping.sheetId === selectedSheet);
    };

    const currentSheet = sheets.find(sheet => sheet.sheetId === selectedSheet);

    // Helper function to get mapping count for each sheet
    const getMappingCountForSheet = (sheetId) => {
        return mappings.filter(mapping => mapping.sheetId === sheetId).length;
    };

    // Get element count for sheet from our stored state
    const getElementCountForSheet = (sheetId) => {
        return sheetElementsCount[sheetId] || 0;
    };

    // Calculate mapping progress percentage
    const getMappingProgress = (sheetId) => {
        const elementCount = getElementCountForSheet(sheetId);
        const mappingCount = getMappingCountForSheet(sheetId);

        if (elementCount === 0) return 0;

        // Calculate ratio and ensure it's between 0-100
        const progress = (mappingCount / elementCount) * 100;
        return Math.min(Math.max(progress, 0), 100);
    };

    // Get progress bar color based on progress
    const getProgressBarColor = (progress) => {
        if (progress === 0) return 'bg-gray-300';
        if (progress < 25) return 'bg-red-400';
        if (progress < 50) return 'bg-yellow-400';
        if (progress < 75) return 'bg-blue-400';
        if (progress < 100) return 'bg-blue-500';
        return 'bg-green-500';
    };

    // Get progress bar text color
    const getProgressTextColor = (progress) => {
        if (progress === 0) return 'text-gray-600';
        if (progress < 25) return 'text-red-600';
        if (progress < 50) return 'text-yellow-600';
        if (progress < 75) return 'text-blue-600';
        if (progress < 100) return 'text-blue-700';
        return 'text-green-700';
    };

    // Get progress status text
    const getProgressStatus = (progress) => {
        if (progress === 0) return 'Not Started';
        if (progress < 25) return 'Just Started';
        if (progress < 50) return 'In Progress';
        if (progress < 75) return 'Mostly Done';
        if (progress < 100) return 'Almost Complete';
        return 'Complete';
    };

    // Format date if available
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    // Get category color
    const getCategoryColor = (category) => {
        if (!category) return 'bg-gray-100 text-gray-700';

        const colors = {
            financial: 'bg-blue-100 text-blue-700 border-blue-200',
            sales: 'bg-green-100 text-green-700 border-green-200',
            inventory: 'bg-purple-100 text-purple-700 border-purple-200',
            hr: 'bg-pink-100 text-pink-700 border-pink-200',
            marketing: 'bg-orange-100 text-orange-700 border-orange-200',
            operations: 'bg-indigo-100 text-indigo-700 border-indigo-200',
            reporting: 'bg-cyan-100 text-cyan-700 border-cyan-200',
            default: 'bg-gray-100 text-gray-700 border-gray-200'
        };

        const key = category.toLowerCase();
        return colors[key] || colors.default;
    };

    // Drag & Drop handlers
    const handleDragStart = (e, element) => {
        setDraggedElement(element);
        e.dataTransfer.setData('text/plain', element.elementId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, coa = null) => {
        e.preventDefault();
        setDragOverCoa(coa);
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragLeave = () => {
        setDragOverCoa(null);
    };

    const handleDrop = async (e, coa) => {
        e.preventDefault();
        setDragOverCoa(null);

        if (draggedElement && coa) {
            await handleMapElement(draggedElement.elementId, coa.coaId);
        }
        setDraggedElement(null);
    };

    // Mapping handlers
    const handleMapElement = async (elementId, coaId) => {
        if (!selectedSheet || !elementId || !coaId) {
            Swal.fire({
                icon: 'error',
                title: 'Missing Information',
                text: 'Please select Sheet, Element, and COA.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
            });
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/api/mappings', {
                sheetId: selectedSheet,
                elementId: elementId,
                coaId: coaId,
                createdBy: 'admin',
            });

            setMappings(prev => [...prev, {
                mappingId: res.data.mappingId,
                elementId,
                coaId,
                sheetId: selectedSheet
            }]);

            Swal.fire({
                icon: 'success',
                title: 'Mapping Saved!',
                text: 'Element successfully mapped to COA account.',
                timer: 500,
                timerProgressBar: true,
                showConfirmButton: false
            });

        } catch (err) {
            console.error(err);
            Swal.fire({
                icon: 'error',
                title: 'Failed to Save',
                text: 'Failed to save mapping. Please try again.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#3085d6',
            });
        } finally {
            setLoading(false);
        }
    };

    const removeMapping = async (mappingId, element, coa) => {
        const result = await Swal.fire({
            icon: 'question',
            title: 'Confirm Unmapping',
            html: `Do you want to unmap <strong>"${element.excelElement}"</strong> from <strong>"${coa.coaName}"</strong>?`,
            showCancelButton: true,
            confirmButtonText: 'Yes, Unmap',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            reverseButtons: true
        });

        if (result.isConfirmed) {
            try {
                await api.delete(`/api/mappings/${mappingId}`);
                setMappings(prev => prev.filter(m => m.mappingId !== mappingId));

                Swal.fire({
                    icon: 'success',
                    title: 'Unmapped!',
                    text: 'Element has been unmapped from COA account.',
                    timer: 500,
                    timerProgressBar: true,
                    showConfirmButton: false
                });

            } catch (err) {
                console.error(err);
                Swal.fire({
                    icon: 'error',
                    title: 'Failed to Unmap',
                    text: 'Failed to remove mapping. Please try again.',
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#3085d6',
                });
            }
        }
    };

    // View 1: Enhanced Sheet Selection with accurate progress bars
    const renderSheetSelection = () => {
        // Calculate overall stats
        const totalSheets = filteredSheets.length;
        let totalElements = 0;
        let totalMappings = 0;

        filteredSheets.forEach(sheet => {
            const elementCount = getElementCountForSheet(sheet.sheetId);
            const mappingCount = getMappingCountForSheet(sheet.sheetId);
            totalElements += elementCount;
            totalMappings += mappingCount;
        });

        const overallProgress = totalElements > 0 ? (totalMappings / totalElements) * 100 : 0;

        return (
            <div className="max-w-8xl mx-auto p-6 bg-white shadow-lg rounded-xl mt-8 h-[81vh] flex flex-col">
                {/* Header Section */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">Excel Sheets Dashboard</h2>
                    <p className="text-gray-500">Select a sheet to configure data mappings with COA accounts</p>
                </div>

                {/* Compact Search and Stats Bar */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200 min-h-0">
                    {/* Compact Stats Section - Pill shaped similar to View 3 */}
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
                            Sheets: <span className="font-bold">{totalSheets}</span>
                        </span>
                        <span className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-medium">
                            Elements: <span className="font-bold">{totalElements}</span>
                        </span>
                        <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
                            Mapped: <span className="font-bold">{totalMappings}</span>
                        </span>
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col min-w-[120px]">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-medium text-gray-600">Overall</span>
                                    <span className="text-xs font-bold text-blue-600">
                                        {Math.round(overallProgress)}%
                                    </span>
                                </div>
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${getProgressBarColor(overallProgress)} transition-all duration-300`}
                                        style={{ width: `${overallProgress}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Compact Search and Refresh Section */}
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        {/* Search Bar */}
                        <div className="relative flex-1 sm:flex-none sm:w-64">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search sheets..."
                                    value={sheetSearch}
                                    onChange={(e) => setSheetSearch(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-sm"
                                />
                            </div>
                        </div>

                        {/* Refresh Button - Compact */}
                        <button
                            onClick={handleRefreshSheets}
                            disabled={refreshingSheets}
                            className={`flex items-center justify-center gap-1 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm hover:shadow ${refreshingSheets ? 'opacity-70 cursor-not-allowed' : 'hover:border-gray-400'}`}
                            title="Refresh sheets list"
                        >
                            <RefreshCw
                                size={16}
                                className={`text-gray-600 ${refreshingSheets ? 'animate-spin' : ''}`}
                            />
                            <span className="text-sm font-medium text-gray-700 hidden sm:inline">
                                {refreshingSheets ? '...' : 'Refresh'}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Sheets Grid - 3 columns on large screens (Now has more height) */}
                <div className="flex-1 overflow-y-auto pr-2">
                    {filteredSheets.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pb-4">
                            {filteredSheets.map((sheet) => {
                                const elementCount = getElementCountForSheet(sheet.sheetId);
                                const mappingCount = getMappingCountForSheet(sheet.sheetId);
                                const progress = getMappingProgress(sheet.sheetId);
                                const isComplete = progress === 100;
                                const isStarted = progress > 0 && progress < 100;
                                const categoryColor = getCategoryColor(sheet.category);

                                return (
                                    <div
                                        key={sheet.sheetId}
                                        onClick={() => handleSheetSelect(sheet.sheetId)}
                                        className={`bg-white rounded-xl border transition-all duration-300 cursor-pointer group overflow-hidden flex flex-col h-[450px] hover:shadow-lg ${isComplete
                                            ? 'border-green-200 hover:border-green-300'
                                            : isStarted
                                                ? 'border-blue-200 hover:border-blue-300'
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        {/* Header with status indicator */}
                                        <div className={`p-4 ${isComplete
                                            ? 'bg-gradient-to-r from-green-50 to-emerald-50'
                                            : isStarted
                                                ? 'bg-gradient-to-r from-blue-50 to-indigo-50'
                                                : 'bg-gradient-to-r from-gray-50 to-slate-50'
                                            } border-b`}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${isComplete
                                                        ? 'bg-green-100'
                                                        : isStarted
                                                            ? 'bg-blue-100'
                                                            : 'bg-gray-100'
                                                        }`}>
                                                        <FileSpreadsheet size={20} className={
                                                            isComplete
                                                                ? 'text-green-600'
                                                                : isStarted
                                                                    ? 'text-blue-600'
                                                                    : 'text-gray-600'
                                                        } />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-bold text-gray-800 text-lg truncate group-hover:text-blue-600 transition-colors">
                                                            {sheet.excellSheetName}
                                                        </h3>
                                                        {sheet.description && (
                                                            <p className="text-sm text-gray-600 truncate mt-1">
                                                                {sheet.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                {isComplete && (
                                                    <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Content Area */}
                                        <div className="p-4 flex-1 flex flex-col justify-between">
                                            {/* Stats Row */}
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                <div className="bg-gray-50 p-3 rounded-lg">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Hash size={14} className="text-gray-500" />
                                                        <span className="text-xs text-gray-500 font-medium">Elements</span>
                                                    </div>
                                                    <div className="text-xl font-bold text-gray-800">
                                                        {elementCount}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        Total in sheet
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 p-3 rounded-lg">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <BarChart3 size={14} className={
                                                            isComplete
                                                                ? 'text-green-500'
                                                                : isStarted
                                                                    ? 'text-blue-500'
                                                                    : 'text-gray-400'
                                                        } />
                                                        <span className="text-xs text-gray-500 font-medium">Mapped</span>
                                                    </div>
                                                    <div className={`text-xl font-bold ${isComplete
                                                        ? 'text-green-600'
                                                        : isStarted
                                                            ? 'text-blue-600'
                                                            : 'text-gray-600'
                                                        }`}>
                                                        {mappingCount}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {mappingCount === elementCount ? 'All mapped!' : 'Need more'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Progress Section */}
                                            <div className="mb-4">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs font-medium text-gray-600">
                                                        Mapping Progress
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-bold ${getProgressTextColor(progress)}`}>
                                                            {Math.round(progress)}%
                                                        </span>
                                                        <span className="text-xs font-medium text-gray-500">
                                                            ({mappingCount}/{elementCount})
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Progress Bar */}
                                                <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-1">
                                                    <div
                                                        className={`h-full ${getProgressBarColor(progress)} transition-all duration-700 ease-out`}
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>

                                                {/* Progress Status */}
                                                <div className="flex justify-between items-center">
                                                    <span className={`text-xs font-medium ${getProgressTextColor(progress)}`}>
                                                        {getProgressStatus(progress)}
                                                    </span>
                                                    {elementCount > 0 && (
                                                        <span className="text-xs text-gray-500">
                                                            {Math.round((mappingCount / elementCount) * 100)}% complete
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Footer with metadata */}
                                            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                                {/* Category Badge */}
                                                {sheet.category && (
                                                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium border ${categoryColor}`}>
                                                        {sheet.category}
                                                    </span>
                                                )}

                                                {/* Action Button */}
                                                <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${isComplete
                                                    ? 'bg-green-100 text-green-700'
                                                    : isStarted
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {isComplete ? 'Review' : isStarted ? 'Continue' : 'Start'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Hover Action Indicator */}
                                        <div className={`absolute inset-x-0 bottom-0 h-1 ${isComplete
                                            ? 'bg-green-500'
                                            : isStarted
                                                ? 'bg-blue-500'
                                                : 'bg-gray-400'
                                            } transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left`} />
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="col-span-full text-center py-16 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border border-gray-200">
                            <div className="text-gray-300 mb-4">
                                <FileSpreadsheet size={64} className="mx-auto" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-600 mb-2">No sheets found</h3>
                            <p className="text-gray-500 max-w-md mx-auto mb-6">
                                {sheetSearch
                                    ? `No sheets match "${sheetSearch}". Try different keywords.`
                                    : 'No Excel sheets are currently available. Upload an Excel file to get started.'}
                            </p>
                            {sheetSearch && (
                                <button
                                    className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
                                    onClick={() => setSheetSearch('')}
                                >
                                    Clear Search
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex flex-wrap items-center gap-6 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span>Complete (100%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span>In Progress</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                            <span>Not Started</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-400"></div>
                            <span>Just Started (0-25%)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                            <span>Progressing (25-50%)</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // View 2: Mapping Interface
    const renderMappingInterface = () => (
        <div className="max-w-7xl mx-auto p-6 bg-white shadow-lg rounded-lg mt-8 h-[81vh] flex flex-col">
            {/* Header with Navigation */}
            <div className="flex justify-between items-center mb-6">
                <button
                    onClick={handleSelectAnotherSheet}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <ArrowLeft size={20} />
                    <span>Select Another Sheet</span>
                </button>

                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-800">Map Excel Elements to COA</h2>
                    {currentSheet && (
                        <p className="text-gray-600 mt-1">
                            Current Sheet: <span className="font-semibold text-blue-600">{currentSheet.excellSheetName}</span>
                        </p>
                    )}
                </div>

                <button
                    onClick={handleNavigateToSummary}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                >
                    <List size={20} />
                    <span>Mapping Summary</span>
                </button>
            </div>

            {/* Mapping Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                {/* Left Panel - Excel Elements */}
                <div className="bg-green-100 p-4 rounded-lg border h-full flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">Available Excel Elements</h3>
                        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                            {unmappedElements.length} unmapped
                        </span>
                    </div>

                    {/* Search for Elements */}
                    <div className="flex items-center gap-4 mb-4">
                        {/* Excel Icon Container */}
                        <div className="shrink-0">
                            <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center border border-green-200">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-6 w-6 text-green-600"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16.2 20H7.8C7.4 20 7 19.6 7 19.2V16.8H10.6L12.6 18.8L14.6 16.8H17V19.2C17 19.6 16.6 20 16.2 20ZM17 15H14.4L12.4 17L10.4 15H7V9H17V15ZM14 9V3.5L18.5 8H14V9Z" />
                                </svg>
                            </div>
                        </div>

                        {/* Search Bar - Takes remaining space */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Search elements or cell values..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Scrollable content area */}
                    <div className="space-y-2 flex-1 overflow-y-auto min-h-0">
                        {unmappedElements.map((element) => (
                            <div
                                key={element.elementId}
                                draggable
                                onDragStart={(e) => handleDragStart(e, element)}
                                className="bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-300 transition-all cursor-move group"
                            >
                                <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                        <h4 className="font-medium text-gray-800">{element.excelElement}</h4>
                                        <div className="text-sm text-gray-600 space-y-1">
                                            {element.exelCellValue && (
                                                <p>
                                                    <span className="font-medium">Value:</span> {element.exelCellValue}
                                                </p>
                                            )}
                                            {element.cellReference && (
                                                <p>
                                                    <span className="font-medium">Cell:</span> {element.cellReference}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Move size={16} className="text-gray-400" />
                                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                            Drag to map
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {unmappedElements.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
                                <p>All elements are mapped!</p>
                                {searchTerm && <p className="text-sm">Try adjusting your search</p>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - COA Accounts with Mapped Elements */}
                <div className="bg-gray-50 p-4 rounded-lg border h-full flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">Chart of Accounts</h3>
                        <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
                            {filteredCoas.length} accounts
                        </span>
                    </div>

                    {/* Search for COA */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search COA..."
                            value={coaSearch}
                            onChange={(e) => setCoaSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                    </div>

                    {/* Scrollable content area */}
                    <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
                        {filteredCoas.map((coa) => {
                            const isDragOver = dragOverCoa?.coaId === coa.coaId;
                            const mappedElements = getMappedElementsForCoa(coa.coaId);

                            return (
                                <div
                                    key={coa.coaId}
                                    onDragOver={(e) => handleDragOver(e, coa)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={(e) => handleDrop(e, coa)}
                                    className={`bg-white p-4 rounded-lg border transition-all ${isDragOver
                                        ? 'border-green-500 bg-green-50 shadow-md scale-105'
                                        : mappedElements.length > 0
                                            ? 'border-green-200 bg-green-50'
                                            : 'border-gray-200 hover:border-green-300'
                                        }`}
                                >
                                    {/* COA Header */}
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex-1">
                                            <h4 className="font-medium text-gray-800">{coa.coaName}</h4>
                                            <p className="text-sm text-gray-600">Code: {coa.coaCode}</p>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {mappedElements.length > 0 && (
                                                <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                                                    {mappedElements.length} mapped
                                                </span>
                                            )}
                                            {isDragOver && (
                                                <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full animate-pulse">
                                                    Drop here
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Mapped Elements for this COA */}
                                    {mappedElements.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                                Mapped Elements:
                                            </p>
                                            <div className="space-y-1">
                                                {mappedElements.map((element) => (
                                                    <div
                                                        key={element.mappingId}
                                                        className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded border border-blue-200"
                                                    >
                                                        <div className="flex-1">
                                                            <span className="text-sm font-medium text-blue-800">
                                                                {element.excelElement}
                                                            </span>
                                                            <div className="text-xs text-blue-600 space-y-1">
                                                                {element.exelCellValue && (
                                                                    <div>
                                                                        <span className="font-medium">Value:</span> {element.exelCellValue}
                                                                    </div>
                                                                )}
                                                                {element.cellReference && (
                                                                    <div>
                                                                        <span className="font-medium">Cell:</span> {element.cellReference}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => removeMapping(
                                                                element.mappingId,
                                                                element,
                                                                coa
                                                            )}
                                                            className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
                                                            title={`Unmap ${element.excelElement}`}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Empty State */}
            {mappings.length === 0 && unmappedElements.length > 0 && (
                <div className="text-center py-8 bg-yellow-50 rounded-lg border border-yellow-200 mt-6">
                    <AlertCircle size={32} className="mx-auto mb-2 text-yellow-500" />
                    <h3 className="text-lg font-medium text-yellow-800 mb-2">No Mappings Yet</h3>
                    <p className="text-yellow-700">
                        Drag elements from the left panel and drop them on COA accounts to create mappings.
                    </p>
                </div>
            )}

            {loading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-2 text-gray-700">Saving mapping...</p>
                    </div>
                </div>
            )}
        </div>
    );

    // View 3: Mapping Summary (Only for selected sheet)
    const renderMappingSummary = () => {
        const sheetMappings = getSheetMappings();

        return (
            <div className="max-w-7xl mx-auto p-6 bg-white shadow-lg rounded-lg mt-8 h-[81vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={handleBackToMapping}
                        className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span>Back to Mapping</span>
                    </button>

                    <div className="text-center">
                        <h2 className="text-2xl font-bold text-gray-800">Mapping Summary</h2>
                        {currentSheet && (
                            <p className="text-gray-600 mt-1">
                                Sheet: <span className="font-semibold text-blue-600">{currentSheet.excellSheetName}</span>
                            </p>
                        )}
                    </div>

                    <div className="w-32"></div> {/* Spacer for balance */}
                </div>

                {/* Summary Stats - Pill shaped on left side */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex items-center space-x-4">
                        <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium">
                            Total Mappings: <span className="font-bold">{sheetMappings.length}</span>
                        </span>
                        <span className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
                            Total Elements: <span className="font-bold">{elements.length}</span>
                        </span>
                        <span className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-medium">
                            COA Accounts: <span className="font-bold">{coas.length}</span>
                        </span>
                    </div>
                </div>

                {/* Mappings List - Scrollable */}
                <div className="bg-gray-50 p-6 rounded-lg border flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">
                            Mappings for {currentSheet?.excellSheetName}
                        </h3>
                        <span className="text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                            {sheetMappings.length} mappings
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0">
                        {sheetMappings.length > 0 ? (
                            <div className="space-y-4 pr-2">
                                {sheetMappings.map((mapping) => {
                                    const element = elements.find(e => e.elementId === mapping.elementId);
                                    const coa = coas.find(c => c.coaId === mapping.coaId);

                                    if (!element || !coa) return null;

                                    return (
                                        <div key={mapping.mappingId} className="bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <div className="flex items-start space-x-6">
                                                        {/* Element */}
                                                        <div className="flex-1">
                                                            <div className="flex items-center space-x-2 mb-2">
                                                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                                <h4 className="font-medium text-gray-800">{element.excelElement}</h4>
                                                            </div>
                                                            <div className="text-sm text-gray-600 ml-4 space-y-1">
                                                                {element.exelCellValue && (
                                                                    <p>
                                                                        <span className="font-medium">Value:</span> {element.exelCellValue}
                                                                    </p>
                                                                )}
                                                                {element.cellReference && (
                                                                    <p>
                                                                        <span className="font-medium">Cell:</span> {element.cellReference}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Arrow */}
                                                        <div className="text-gray-400 pt-2">
                                                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                                →
                                                            </div>
                                                        </div>

                                                        {/* COA */}
                                                        <div className="flex-1">
                                                            <div className="flex items-center space-x-2 mb-2">
                                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                                <h4 className="font-medium text-gray-800">{coa.coaName}</h4>
                                                            </div>
                                                            <p className="text-sm text-gray-600 ml-4">Code: {coa.coaCode}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeMapping(mapping.mappingId, element, coa)}
                                                    className="ml-4 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Remove mapping"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-white rounded-lg border border-gray-200 h-full flex items-center justify-center">
                                <div>
                                    <CheckCircle size={48} className="mx-auto mb-4 text-gray-400" />
                                    <h3 className="text-lg font-medium text-gray-600 mb-2">No Mappings Found</h3>
                                    <p className="text-gray-500">
                                        No mappings found for the selected sheet.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Main render
    return (
        <div>
            {currentView === 'sheet-selection' && renderSheetSelection()}
            {currentView === 'mapping' && renderMappingInterface()}
            {currentView === 'summary' && renderMappingSummary()}
        </div>
    );
};

export default Mapping;