import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';
import {
    Download,
    Eye,
    FileSpreadsheet,
    Calendar,
    Search,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    RefreshCw,
    X,
    Filter,
    SortAsc
} from 'lucide-react';

const Reports = () => {
    // State for data
    const [excelSheets, setExcelSheets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);

    // Download states
    const [downloading, setDownloading] = useState({});
    const [showDateModal, setShowDateModal] = useState(false);
    const [selectedSheet, setSelectedSheet] = useState(null);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        endDate: new Date()
    });

    // Preview states
    const [previewData, setPreviewData] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);

    // Search and pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(9);
    const [sortBy, setSortBy] = useState('name');

    // Refs for modals
    const dateModalRef = useRef(null);
    const previewModalRef = useRef(null);
    const cardsContainerRef = useRef(null);

    // Click outside handler for modals
    const handleClickOutside = useCallback((event, modalRef, closeFunction) => {
        if (modalRef.current && !modalRef.current.contains(event.target)) {
            closeFunction();
        }
    }, []);

    // Set up click outside listeners for modals
    useEffect(() => {
        const handleDateModalClickOutside = (event) => {
            if (showDateModal) {
                handleClickOutside(event, dateModalRef, () => {
                    setShowDateModal(false);
                    setSelectedSheet(null);
                });
            }
        };

        const handlePreviewModalClickOutside = (event) => {
            if (showPreview) {
                handleClickOutside(event, previewModalRef, () => {
                    closePreview();
                });
            }
        };

        document.addEventListener('mousedown', handleDateModalClickOutside);
        document.addEventListener('mousedown', handlePreviewModalClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleDateModalClickOutside);
            document.removeEventListener('mousedown', handlePreviewModalClickOutside);
        };
    }, [showDateModal, showPreview, handleClickOutside]);

    // Fetch Excel sheets from backend with all template info
    const fetchExcelSheets = async () => {
        setLoading(true);
        try {
            // First, get all sheet names
            const sheetsRes = await api.get('/api/reports/sheets');
            const sheetNames = sheetsRes.data;

            console.log('📊 Found Excel sheets:', sheetNames);

            if (sheetNames.length === 0) {
                setExcelSheets([]);
                setInitialLoadComplete(true);
                return;
            }

            // Fetch all template info in parallel with error handling
            const sheetsPromises = sheetNames.map(async (sheetName) => {
                try {
                    const templateRes = await api.get(`/api/reports/template/${sheetName}`);

                    // Use fileName from backend or construct with sheetName
                    const fileName = templateRes.data?.fileName || sheetName;
                    const fileExists = templateRes.data?.fileExists || false;

                    return {
                        id: sheetName,
                        name: sheetName,
                        fileName: fileName,  // Use backend-provided filename with extension
                        fileExists: fileExists,
                        isWorkbook: templateRes.data?.isWorkbook || false,
                        fileSize: templateRes.data?.fileSize || 0,
                        uploadDate: templateRes.data?.uploadDate || new Date().toISOString(),
                        // Add file extension for display purposes
                        fileExtension: getFileExtension(fileName),
                        // Backend data
                        ...templateRes.data
                    };
                } catch (error) {
                    console.warn(`Could not fetch template for ${sheetName}:`, error);

                    // Fallback: use sheetName as filename
                    const fileName = `${sheetName}.xlsx`; // Default extension
                    return {
                        id: sheetName,
                        name: sheetName,
                        fileName: fileName,
                        fileExists: false,  // Mark as unavailable since we couldn't fetch info
                        uploadDate: new Date().toISOString(),
                        isWorkbook: false,
                        fileSize: 0,
                        fileExtension: '.xlsx'
                    };
                }
            });

            // Wait for all template info to be fetched
            const sheetsWithInfo = await Promise.all(sheetsPromises);

            console.log('📊 Sheets with template info:', sheetsWithInfo);
            setExcelSheets(sheetsWithInfo);

        } catch (err) {
            console.error('Error fetching Excel sheets:', err);
            Swal.fire({
                icon: 'error',
                title: 'Load Failed',
                text: 'Failed to load Excel sheets. Please try again.',
                confirmButtonColor: '#3085d6',
            });
            setExcelSheets([]);
        } finally {
            setLoading(false);
            setInitialLoadComplete(true);
        }
    };

    // Helper function to extract file extension
    const getFileExtension = (fileName) => {
        if (!fileName) return '.xlsx'; // Default extension

        const lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex === -1) return '.xlsx';

        return fileName.substring(lastDotIndex).toLowerCase();
    };

    // Helper function to get file type icon based on extension
    const getFileTypeIcon = (extension) => {
        switch (extension) {
            case '.xlsx':
            case '.xls':
                return { icon: '📊', color: 'text-green-600', bg: 'bg-green-100' };
            case '.csv':
                return { icon: '📄', color: 'text-blue-600', bg: 'bg-blue-100' };
            case '.xlsm':
            case '.xlsb':
                return { icon: '⚙️', color: 'text-purple-600', bg: 'bg-purple-100' };
            default:
                return { icon: '📋', color: 'text-gray-600', bg: 'bg-gray-100' };
        }
    };

    useEffect(() => {
        fetchExcelSheets();
    }, []);

    // Filter and sort sheets
    const filteredSheets = useMemo(() => {
        if (!initialLoadComplete) return [];

        let filtered = excelSheets.filter(sheet => {
            if (!sheet || !sheet.name) return false;

            const searchLower = searchTerm.toLowerCase();
            return (
                sheet.name.toLowerCase().includes(searchLower) ||
                (sheet.fileName && sheet.fileName.toLowerCase().includes(searchLower)) ||
                (sheet.fileExtension && sheet.fileExtension.toLowerCase().includes(searchLower))
            );
        });

        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'date':
                    return new Date(b.uploadDate || 0) - new Date(a.uploadDate || 0);
                case 'size':
                    return (b.fileSize || 0) - (a.fileSize || 0);
                case 'name':
                default:
                    return (a.name || '').localeCompare(b.name || '');
            }
        });

        return filtered;
    }, [excelSheets, searchTerm, sortBy, initialLoadComplete]);

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(filteredSheets.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentSheets = filteredSheets.slice(startIndex, endIndex);

    // Format date for display
    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            return 'Invalid Date';
        }
    };

    // Format file size
    const formatFileSize = (bytes) => {
        if (bytes === 0 || !bytes) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Handle Download Click
    const handleDownloadClick = (sheet) => {
        if (!sheet || !sheet.fileExists) return;

        setSelectedSheet(sheet);
        setShowDateModal(true);
    };

    // Handle Download Confirmation
    const handleDownloadConfirm = async () => {
        if (!selectedSheet) return;

        setDownloading(prev => ({ ...prev, [selectedSheet.name]: true }));
        setShowDateModal(false);

        try {
            const startDateStr = dateRange.startDate.toISOString().split('T')[0];
            const endDateStr = dateRange.endDate.toISOString().split('T')[0];

            // Generate and download report
            const response = await api.post(
                `/api/reports/generate/${selectedSheet.name}`,
                {},
                {
                    params: {
                        startDate: startDateStr,
                        endDate: endDateStr
                    },
                    responseType: 'blob',
                    onDownloadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            console.log(`Download progress: ${percentCompleted}%`);
                        }
                    }
                }
            );

            // Create download link using backend-provided filename
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            // Use the backend fileName or construct one
            const baseFileName = selectedSheet.fileName ?
                selectedSheet.fileName.replace(/\.[^/.]+$/, "") : // Remove extension if present
                selectedSheet.name;

            const fileExtension = selectedSheet.fileExtension || '.xlsx';
            link.setAttribute('download', `Report_${baseFileName}_${startDateStr}_to_${endDateStr}${fileExtension}`);

            document.body.appendChild(link);
            link.click();
            link.remove();

            // Show success message
            Swal.fire({
                icon: 'success',
                title: 'Download Complete!',
                text: `Report "${selectedSheet.name}" generated successfully.`,
                timer: 3000,
                showConfirmButton: false
            });

        } catch (error) {
            console.error('Download error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Download Failed',
                text: error.response?.data?.message || 'Failed to generate report. Please try again.',
                confirmButtonColor: '#3085d6',
            });
        } finally {
            setDownloading(prev => ({ ...prev, [selectedSheet.name]: false }));
            setSelectedSheet(null);
        }
    };

    // Handle Preview
    const handlePreview = async (sheet) => {
        if (!sheet) return;

        setPreviewLoading(true);

        try {
            // Ask for date range first
            const { value: formValues } = await Swal.fire({
                title: 'Preview Date Range',
                html: `
          <div style="text-align: left; margin: 20px 0;">
            <p style="margin-bottom: 15px; color: #666;">Select date range for preview:</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <label style="display: block; margin-bottom: 5px; font-size: 14px;">Start Date</label>
                <input type="date" id="previewStartDate" 
                       value="${dateRange.startDate.toISOString().split('T')[0]}" 
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              </div>
              <div>
                <label style="display: block; margin-bottom: 5px; font-size: 14px;">End Date</label>
                <input type="date" id="previewEndDate" 
                       value="${dateRange.endDate.toISOString().split('T')[0]}" 
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
              </div>
            </div>
          </div>
        `,
                showCancelButton: true,
                confirmButtonText: 'Load Preview',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                preConfirm: () => {
                    const startDate = document.getElementById('previewStartDate').value;
                    const endDate = document.getElementById('previewEndDate').value;

                    if (!startDate || !endDate) {
                        Swal.showValidationMessage('Please select both dates');
                        return false;
                    }

                    if (new Date(startDate) > new Date(endDate)) {
                        Swal.showValidationMessage('Start date must be before end date');
                        return false;
                    }

                    return { startDate, endDate };
                }
            });

            if (!formValues) {
                setPreviewLoading(false);
                return;
            }

            // Get preview data
            const response = await api.post(`/api/reports/preview/${sheet.name}`, {
                sheetName: sheet.name,
                startDate: formValues.startDate,
                endDate: formValues.endDate
            });

            setPreviewData({
                sheet,
                startDate: formValues.startDate,
                endDate: formValues.endDate,
                data: response.data
            });
            setShowPreview(true);

        } catch (error) {
            console.error('Preview error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Preview Failed',
                text: error.response?.data?.message || 'Could not load preview data',
                confirmButtonColor: '#3085d6',
            });
        } finally {
            setPreviewLoading(false);
        }
    };

    // Close preview modal
    const closePreview = () => {
        setShowPreview(false);
        setPreviewData(null);
    };

    // Render Date Selection Modal
    const renderDateModal = () => {
        if (!showDateModal || !selectedSheet) return null;

        const fileType = getFileTypeIcon(selectedSheet.fileExtension);

        return (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                {/* Glassmorphism backdrop */}
                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-all duration-300"></div>

                {/* Modal */}
                <div
                    ref={dateModalRef}
                    className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md border border-white/20"
                    style={{
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.98) 100%)',
                        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)'
                    }}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-200/50">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3">
                                <div className={`p-3 ${fileType.bg} rounded-xl shadow-sm`}>
                                    <span className="text-2xl">{fileType.icon}</span>
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-xl font-bold text-gray-900">
                                        Generate Report
                                    </h2>
                                    <p className="text-gray-600 mt-1 text-sm font-medium">
                                        {selectedSheet.name}
                                    </p>
                                    <p className="text-gray-500 text-xs mt-1">
                                        File: {selectedSheet.fileName}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowDateModal(false);
                                    setSelectedSheet(null);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-gray-600 mt-3 text-sm bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                            Select date range for data extraction
                        </p>
                    </div>

                    {/* Date Selection */}
                    <div className="p-6">
                        <div className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={dateRange.startDate.toISOString().split('T')[0]}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: new Date(e.target.value) }))}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    value={dateRange.endDate.toISOString().split('T')[0]}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: new Date(e.target.value) }))}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                />
                            </div>

                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                                <p className="text-sm text-blue-700">
                                    <span className="font-semibold">Note:</span> Data will be fetched from your database using the SQL queries configured for this sheet.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-200/50 flex justify-end space-x-3">
                        <button
                            onClick={() => {
                                setShowDateModal(false);
                                setSelectedSheet(null);
                            }}
                            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDownloadConfirm}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg flex items-center"
                        >
                            <Download size={18} className="mr-2" />
                            Generate Report
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Render Preview Modal
    const renderPreviewModal = () => {
        if (!showPreview || !previewData) return null;

        const { sheet, startDate, endDate, data } = previewData;
        const cellValues = data ? Object.entries(data) : [];
        const totalCells = cellValues.length;
        const successfulCells = cellValues.filter(([_, value]) =>
            value && (typeof value !== 'string' || !value.includes('ERROR'))
        ).length;
        const errorCells = totalCells - successfulCells;

        return (
            <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                {/* Glassmorphism backdrop with blur */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900/20 to-black/30 backdrop-blur-md transition-all duration-300"></div>

                {/* Modal */}
                <div
                    ref={previewModalRef}
                    className="relative w-full max-w-6xl max-h-[90vh] flex flex-col"
                    style={{
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0.96) 100%)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '24px',
                        boxShadow: '0 25px 80px rgba(0, 0, 0, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.3)'
                    }}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-gray-200/50">
                        <div className="flex justify-between items-start">
                            <div className="flex items-start space-x-4">
                                <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl shadow-sm">
                                    <FileSpreadsheet size={24} className="text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                        Report Preview
                                    </h2>
                                    <div className="flex items-center space-x-3 mt-2">
                                        <p className="text-gray-700 font-medium">
                                            {sheet.name}
                                        </p>
                                        <span className="text-gray-400">•</span>
                                        <p className="text-gray-600">
                                            {startDate} to {endDate}
                                        </p>
                                    </div>
                                    {sheet.fileName && (
                                        <p className="text-sm text-gray-500 mt-1 bg-gray-50/50 px-3 py-1 rounded-lg inline-block">
                                            Template: {sheet.fileName}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={closePreview}
                                className="p-2 hover:bg-gray-100/50 rounded-xl transition-all duration-200 text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="p-6 border-b border-gray-200/50">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-100/50">
                                <div className="text-3xl font-bold text-blue-600">{totalCells}</div>
                                <div className="text-sm text-blue-700 font-medium">Total Cells</div>
                            </div>
                            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl border border-green-100/50">
                                <div className="text-3xl font-bold text-green-600">{successfulCells}</div>
                                <div className="text-sm text-green-700 font-medium">Successful</div>
                            </div>
                            <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100/50 rounded-xl border border-red-100/50">
                                <div className="text-3xl font-bold text-red-600">{errorCells}</div>
                                <div className="text-sm text-red-700 font-medium">Errors</div>
                            </div>
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="overflow-x-auto rounded-xl border border-gray-200/50 shadow-sm">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50">
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Cell Reference
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Value
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200/50">
                                    {cellValues.slice(0, 50).map(([cell, value], index) => {
                                        const isError = value && typeof value === 'string' && value.includes('ERROR');

                                        return (
                                            <tr
                                                key={index}
                                                className="hover:bg-gray-50/50 transition-colors duration-150"
                                            >
                                                <td className="px-6 py-3 whitespace-nowrap">
                                                    <span className="font-mono text-sm bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                                                        {cell}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className="font-mono text-gray-800">
                                                        {value === null || value === undefined ? 'N/A' :
                                                            typeof value === 'number'
                                                                ? value.toLocaleString('en-US', { minimumFractionDigits: 2 })
                                                                : String(value)
                                                        }
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className={`px-3 py-1.5 text-xs font-semibold rounded-full ${isError
                                                        ? 'bg-gradient-to-r from-red-50 to-red-100 text-red-700 border border-red-200'
                                                        : 'bg-gradient-to-r from-green-50 to-green-100 text-green-700 border border-green-200'
                                                        }`}>
                                                        {isError ? 'Error' : 'Success'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {cellValues.length > 50 && (
                            <div className="mt-4 text-center text-gray-600 text-sm bg-gray-50/50 p-3 rounded-lg border border-gray-200/50">
                                Showing first 50 of {cellValues.length} cells
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-200/50 flex justify-between items-center">
                        <button
                            onClick={closePreview}
                            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
                        >
                            Close Preview
                        </button>
                        <button
                            onClick={() => {
                                closePreview();
                                setSelectedSheet(sheet);
                                setShowDateModal(true);
                            }}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg flex items-center"
                        >
                            <Download size={18} className="mr-2" />
                            Generate Full Report
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // Render Excel Sheet Card
    const renderSheetCard = (sheet) => {
        if (!sheet) return null;

        const fileType = getFileTypeIcon(sheet.fileExtension);
        const extension = sheet.fileExtension ? sheet.fileExtension.toUpperCase() : 'XLSX';

        return (
            <div key={sheet.id || sheet.name} className="group">
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
                    {/* Card Header */}
                    <div className="p-6">
                        <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3">
                                <div className={`p-3 ${fileType.bg} rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                                    <span className="text-2xl">{fileType.icon}</span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 text-lg mb-2 line-clamp-1">
                                        {sheet.name || 'Unnamed Sheet'}
                                    </h3>
                                    <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                                        <Calendar size={14} className="flex-shrink-0" />
                                        <span className="truncate">Updated: {formatDate(sheet.uploadDate)}</span>
                                    </div>
                                    {sheet.fileName && (
                                        <div className="text-xs text-gray-500 truncate bg-gray-50/50 px-2 py-1 rounded-lg">
                                            {sheet.fileName}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-end space-y-2">
                                <span className={`px-3 py-1 text-xs font-medium rounded-full ${sheet.fileExists
                                    ? 'bg-gradient-to-r from-green-100 to-green-50 text-green-700 border border-green-200'
                                    : 'bg-gradient-to-r from-red-100 to-red-50 text-red-700 border border-red-200'
                                    }`}>
                                    {sheet.fileExists ? 'Available' : 'Missing'}
                                </span>
                                <span className="px-3 py-1 text-xs bg-gradient-to-r from-gray-100 to-gray-50 text-gray-600 rounded-lg border border-gray-200 font-medium">
                                    {extension}
                                </span>
                            </div>
                        </div>

                        {/* File Info */}
                        <div className="mt-6 space-y-3">
                            <div className="flex justify-between items-center bg-gray-50/50 p-3 rounded-xl">
                                <span className="text-sm text-gray-600">File Size:</span>
                                <span className="font-medium text-gray-800">{formatFileSize(sheet.fileSize)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-gray-50/50 p-3 rounded-xl">
                                <span className="text-sm text-gray-600">Type:</span>
                                <span className="font-medium text-gray-800">{sheet.isWorkbook ? 'Workbook' : 'Worksheet'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Card Footer - Actions */}
                    <div className="p-6 pt-4 border-t border-gray-200/50 bg-gradient-to-r from-gray-50/50 to-gray-100/30">
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handlePreview(sheet)}
                                disabled={previewLoading}
                                className="flex items-center justify-center space-x-2 px-4 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 font-medium"
                            >
                                {previewLoading ? (
                                    <RefreshCw className="animate-spin" size={18} />
                                ) : (
                                    <>
                                        <Eye size={18} />
                                        <span>Preview</span>
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => handleDownloadClick(sheet)}
                                disabled={downloading[sheet.name] || !sheet.fileExists}
                                className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${sheet.fileExists
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 hover:shadow-md'
                                    : 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-400 cursor-not-allowed'
                                    } disabled:opacity-50`}
                            >
                                {downloading[sheet.name] ? (
                                    <RefreshCw className="animate-spin" size={18} />
                                ) : (
                                    <>
                                        <Download size={18} />
                                        <span>Download</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 p-4 md:p-8">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900 mb-2 bg-gradient-to-r from-gray-900 to-blue-600 bg-clip-text text-transparent">
                            Excel Reports
                        </h1>
                        <p className="text-gray-600 text-lg">
                            Generate Excel reports with live data from your database
                        </p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={fetchExcelSheets}
                            className="flex items-center space-x-2 px-5 py-2.5 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium shadow-sm hover:shadow"
                        >
                            <RefreshCw size={20} />
                            <span>Refresh</span>
                        </button>
                        <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                            <span className="text-sm font-medium text-blue-700">
                                {excelSheets.length} sheets available
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search and Filters - Sticky Section (Smaller Height) */}
            {initialLoadComplete && excelSheets.length > 0 && (
                <div className="max-w-7xl mx-auto mb-4">
                    <div className="sticky top-4 z-40 bg-gradient-to-r from-white/95 to-gray-50/95 backdrop-blur-lg rounded-xl shadow-lg border border-gray-200/50 p-3 md:p-4 transition-all duration-200">
                        <div className="flex flex-col md:flex-row gap-3">
                            {/* Search */}
                            <div className="flex-1">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search by sheet name, filename, or extension..."
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm bg-white/90 text-sm"
                                    />
                                </div>
                            </div>

                            {/* Sort and Items Per Page - Compact */}
                            <div className="flex items-center space-x-3">
                                <div className="relative">
                                    <SortAsc className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                    <select
                                        value={sortBy}
                                        onChange={(e) => {
                                            setSortBy(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="pl-8 pr-6 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm bg-white/90 text-sm appearance-none"
                                    >
                                        <option value="name">Sort by Name</option>
                                        <option value="date">Sort by Date</option>
                                        <option value="size">Sort by Size</option>
                                    </select>
                                </div>

                                <div className="relative">
                                    <Filter className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="pl-8 pr-6 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm bg-white/90 text-sm appearance-none"
                                    >
                                        <option value="6">6 per page</option>
                                        <option value="9">9 per page</option>
                                        <option value="12">12 per page</option>
                                        <option value="24">24 per page</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content with Scrollable Cards */}
            <div className="max-w-7xl mx-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-96">
                        <div className="relative">
                            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-500 mb-6"></div>
                            <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-4 border-blue-100"></div>
                        </div>
                        <p className="text-gray-600 text-lg font-medium">Loading Excel sheets...</p>
                    </div>
                ) : initialLoadComplete && currentSheets.length > 0 ? (
                    <div className="relative">
                        {/* Cards Grid - Scrollable Container */}
                        <div
                            ref={cardsContainerRef}
                            className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
                            style={{
                                maxHeight: 'calc(100vh - 280px)',
                                minHeight: '400px'
                            }}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-4">
                                {currentSheets.map(renderSheetCard)}
                            </div>

                            {/* Empty space for better scrolling */}
                            <div className="h-8"></div>
                        </div>

                        {/* Pagination - Fixed at bottom */}
                        {filteredSheets.length > itemsPerPage && (
                            <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-6 pb-4 mt-4">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="text-sm text-gray-600 bg-gray-50/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-gray-200/50">
                                        Showing {startIndex + 1} to {Math.min(endIndex, filteredSheets.length)} of {filteredSheets.length} sheets
                                    </div>

                                    <div className="flex items-center space-x-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-gray-200/50">
                                        <button
                                            onClick={() => setCurrentPage(1)}
                                            disabled={currentPage === 1}
                                            className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all duration-200"
                                        >
                                            <ChevronsLeft size={18} />
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all duration-200"
                                        >
                                            <ChevronLeft size={18} />
                                        </button>

                                        <div className="flex items-center space-x-1">
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                let pageNum;
                                                if (totalPages <= 5) {
                                                    pageNum = i + 1;
                                                } else if (currentPage <= 3) {
                                                    pageNum = i + 1;
                                                } else if (currentPage >= totalPages - 2) {
                                                    pageNum = totalPages - 4 + i;
                                                } else {
                                                    pageNum = currentPage - 2 + i;
                                                }

                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => setCurrentPage(pageNum)}
                                                        className={`w-8 h-8 rounded-lg transition-all duration-200 font-medium text-sm ${currentPage === pageNum
                                                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                                                            : 'border border-gray-300 hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                            className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all duration-200"
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(totalPages)}
                                            disabled={currentPage === totalPages}
                                            className="p-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-all duration-200"
                                        >
                                            <ChevronsRight size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : initialLoadComplete && (
                    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200/50 p-16 text-center">
                        <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                            <FileSpreadsheet className="text-blue-600" size={48} />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-3">
                            {searchTerm
                                ? `No Excel sheets matching "${searchTerm}"`
                                : 'No Excel sheets available'}
                        </h3>
                        <p className="text-gray-600 text-lg mb-8">
                            {searchTerm
                                ? 'Try adjusting your search terms'
                                : 'Upload Excel templates to get started'}
                        </p>
                        {searchTerm && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setCurrentPage(1);
                                }}
                                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                            >
                                Clear Search
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Date Selection Modal */}
            {renderDateModal()}

            {/* Preview Modal */}
            {renderPreviewModal()}
        </div>
    );
};

export default Reports;