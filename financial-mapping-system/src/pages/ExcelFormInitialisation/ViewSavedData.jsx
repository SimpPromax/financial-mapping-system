/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, FileText, Search, Grid, Layers, BarChart3, Filter } from 'lucide-react';

const ViewSavedData = () => {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1); // 1-indexed
  const sheetsPerPage = 4;

  // New toggle: when true, even if a sheet name matches the query,
  // only elements matching the query will be shown for that sheet.
  // When false (default), if the sheet name matches the query, show ALL elements for that sheet.
  const [onlyMatchingElementsForMatchedSheets, setOnlyMatchingElementsForMatchedSheets] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/excel/sheets');

      if (Array.isArray(response.data)) {
        setSheets(response.data);
      } else {
        setSheets([]);
        setError('Invalid data format received from server');
      }
    } catch (err) {
      // provide a simple user-friendly message
      setError('Failed to load saved data. Please try again.');
      setSheets([]);
      console.error('loadSavedData error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper that returns elements filtered by query q (case-insensitive)
  const filterElementsByQuery = (elements = [], q) => {
    if (!q) return [...elements];
    const lower = q.toLowerCase();
    return elements.filter(el =>
      (el.excelElement || "").toLowerCase().includes(lower) ||
      (el.exelCellValue || "").toLowerCase().includes(lower)
    );
  };

  // Build the list of sheets to display based on global search:
  // include a sheet if:
  //  - the sheet name matches the query OR
  //  - any element in the sheet matches the query
  const getFilteredSheets = () => {
    const q = search.trim().toLowerCase();
    if (!q) return sheets;

    return sheets.filter(sheet => {
      const sheetNameMatches = (sheet.excellSheetName || "").toLowerCase().includes(q);
      if (sheetNameMatches) return true;

      const elements = sheet.excelElements || [];
      const anyElementMatches = elements.some(el =>
        (el.excelElement || "").toLowerCase().includes(q) ||
        (el.exelCellValue || "").toLowerCase().includes(q)
      );
      return anyElementMatches;
    });
  };

  // For a sheet that will be displayed, decide which elements to show:
  // - If search is empty -> show all elements
  // - If sheet name matches query:
  //     - if onlyMatchingElementsForMatchedSheets === true -> show only matching elements
  //     - else -> show all elements
  // - Else (sheet name doesn't match) -> show only matching elements
  const getDisplayElements = (sheet) => {
    const elements = [...(sheet.excelElements || [])];
    const q = search.trim();
    if (!q) return elements;

    const lower = q.toLowerCase();
    const sheetNameMatches = (sheet.excellSheetName || "").toLowerCase().includes(lower);

    if (sheetNameMatches && !onlyMatchingElementsForMatchedSheets) {
      return elements;
    }

    return elements.filter(el =>
      (el.excelElement || "").toLowerCase().includes(lower) ||
      (el.exelCellValue || "").toLowerCase().includes(lower)
    );
  };

  // Pagination now operates on filteredSheets
  const filteredSheets = getFilteredSheets();
  const totalPages = Math.max(1, Math.ceil(filteredSheets.length / sheetsPerPage));
  const startIndex = (currentPage - 1) * sheetsPerPage;
  const currentSheets = filteredSheets.slice(startIndex, startIndex + sheetsPerPage);

  // Ensure currentPage is valid if filteredSheets length changes (e.g., after search)
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  // helper: total elements across all sheets
  const getTotalElementsCountAllSheets = () => {
    return sheets.reduce((total, sheet) => total + (sheet.excelElements?.length || 0), 0);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center mb-6">
            <div className="relative">
              <div className="animate-spin h-14 w-14 border-[3px] border-blue-500 border-t-transparent rounded-full"></div>
              <FileText className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-500" size={24} />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Loading Saved Data</h3>
          <p className="text-gray-500 max-w-md mx-auto">Fetching your Excel configurations from the server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[81vh] bg-gradient-to-br from-gray-50 to-blue-50/30 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-6 overflow-hidden">
          <div className="p-4 md:p-6">
            {/* Title + Refresh */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm">
                  <FileText className="text-white" size={20} />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900">Saved Excel Data</h1>
                  <p className="text-sm text-gray-500">View & manage your saved Excel configurations</p>
                </div>
              </div>

              <button
                onClick={loadSavedData}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100 transition-all duration-200 shadow-sm text-sm font-medium"
                aria-label="Refresh saved data"
              >
                <RefreshCw size={16} className="text-gray-600 group-hover:text-blue-600 group-hover:rotate-180 transition-all duration-500" />
                Refresh
              </button>
            </div>

            {/* ✅ Stats (left) + Search & Filter (right) in one row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Left: Stats Pills */}
              <div className="flex flex-wrap gap-2">
                {sheets.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1.5 border border-blue-200">
                      <Grid size={14} />
                      <span>Sheets: {sheets.length}</span>
                    </div>
                    <div className="px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-medium flex items-center gap-1.5 border border-green-200">
                      <Layers size={14} />
                      <span>Elements: {getTotalElementsCountAllSheets()}</span>
                    </div>
                    <div className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium flex items-center gap-1.5 border border-purple-200">
                      <BarChart3 size={14} />
                      <span>Avg/Sheet: {Math.round(getTotalElementsCountAllSheets() / (sheets.length || 1)) || 0}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Right: Search + Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search sheets or elements..."
                    className="w-full pl-10 pr-3 py-2.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 placeholder-gray-400 hover:border-blue-400"
                    aria-label="Search sheets or elements"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-gray-700 select-none bg-white border border-gray-300 rounded-md px-3 py-1.5 hover:border-blue-400 transition cursor-pointer whitespace-nowrap">
                    <Filter className="text-gray-500" size={14} />
                    <input
                      type="checkbox"
                      checked={onlyMatchingElementsForMatchedSheets}
                      onChange={(e) => setOnlyMatchingElementsForMatchedSheets(e.target.checked)}
                      className="h-3.5 w-3.5 text-blue-600 rounded focus:ring-1 focus:ring-blue-500/20"
                      aria-label="Only show matching elements for sheets that match search"
                    />
                    <span>Only matching</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-3">
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                  {error}
                </div>
              </div>
            )}

            {/* Search Results Info */}
            {search && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-600">
                <Search size={12} />
                <span>
                  Found <span className="font-semibold text-blue-600">{filteredSheets.length}</span> sheet{filteredSheets.length !== 1 ? 's' : ''} matching "{search}"
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {filteredSheets.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="max-w-md mx-auto">
                <div className="p-5 bg-gradient-to-br from-gray-100 to-gray-200/50 rounded-2xl inline-block mb-6">
                  <FileText size={48} className="text-gray-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">No Data Found</h3>
                <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                  {search ? "No sheets or elements match your search criteria." : "No saved Excel data available yet."}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => {
                      setSearch("");
                      setCurrentPage(1);
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    Show All Sheets
                  </button>
                  <button
                    onClick={loadSavedData}
                    className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
                  >
                    Try Refreshing
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Sheets Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 md:p-8">
                {currentSheets.map((sheet, index) => {
                  const displayElements = getDisplayElements(sheet);
                  const totalElements = sheet.excelElements?.length || 0;
                  const sheetMatches = search.trim()
                    ? (sheet.excellSheetName || "").toLowerCase().includes(search.trim().toLowerCase())
                    : false;

                  return (
                    <div
                      key={`${startIndex + index}-${sheet.id ?? index}`}
                      className="group bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 hover:border-blue-300 flex flex-col overflow-hidden"
                    >
                      {/* Sheet Header */}
                      <div className="px-6 pt-6 pb-4 bg-gradient-to-r from-gray-50 to-blue-50/30 border-b border-gray-100">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm group-hover:scale-110 transition-transform duration-300">
                              <Grid className="text-white" size={18} />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                                {sheet.excellSheetName}
                              </h3>
                              <p className="text-sm text-gray-500 mt-1">
                                {totalElements} element{totalElements !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {sheetMatches && !onlyMatchingElementsForMatchedSheets && (
                              <span className="px-2.5 py-1 bg-gradient-to-r from-green-50 to-green-100 text-green-700 text-xs font-medium rounded-full border border-green-200">
                                Sheet Matched
                              </span>
                            )}
                            <span className="px-3 py-1.5 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 text-sm font-semibold rounded-lg border border-gray-300 shadow-sm">
                              {displayElements.length}/{totalElements}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Filtered Elements</span>
                            <span>{Math.round((displayElements.length / totalElements) * 100) || 0}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
                              style={{ width: `${(displayElements.length / totalElements) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>

                      {/* Elements Table */}
                      <div className="px-6 py-4 flex-1 overflow-y-auto max-h-96">
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50">
                              <tr>
                                <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-700 border-r border-gray-200">
                                  Line Item
                                </th>
                                <th className="px-4 py-3.5 text-left text-sm font-semibold text-gray-700">
                                  Cell Value
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {displayElements.length > 0 ? (
                                displayElements.map((el, i) => (
                                  <tr
                                    key={i}
                                    className="hover:bg-gradient-to-r from-blue-50/30 to-blue-50/10 transition-colors group/row"
                                  >
                                    <td className="px-4 py-3.5 text-gray-800 font-medium border-r border-gray-100 group-hover/row:text-blue-700">
                                      {el.excelElement}
                                    </td>
                                    <td className="px-4 py-3.5">
                                      <div className="font-mono text-sm bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 group-hover/row:border-blue-200 group-hover/row:bg-blue-50/30 group-hover/row:text-blue-600 transition-colors">
                                        {el.exelCellValue}
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan="2" className="px-4 py-8 text-center">
                                    <div className="max-w-xs mx-auto">
                                      <div className="p-3 bg-gradient-to-br from-gray-100 to-gray-200/50 rounded-xl inline-block mb-3">
                                        <Search className="text-gray-400" size={20} />
                                      </div>
                                      <p className="text-gray-500 font-medium">
                                        {search.trim() ? "No matching elements found" : "No elements in this sheet"}
                                      </p>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ✅ PAGINATION INSIDE THE CARD */}
              {totalPages > 1 && (
                <div className="border-t border-gray-200 pt-5 pb-6 px-6">
                  <div className="flex justify-center">
                    <div
                      className="inline-flex flex-wrap justify-center items-center gap-1.5
                                  bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-2 transition"
                    >
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className={`px-3.5 py-1.5 text-sm font-medium rounded-lg border transition ${currentPage === 1
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-400'
                          }`}
                      >
                        Prev
                      </button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3.5 py-1.5 text-sm font-medium rounded-lg border transition ${currentPage === page
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-400'
                            }`}
                        >
                          {page}
                        </button>
                      ))}

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className={`px-3.5 py-1.5 text-sm font-medium rounded-lg border transition ${currentPage === totalPages
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-400'
                          }`}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>


      </div>
    </div>
  );
};

export default ViewSavedData;