import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useNavigate } from 'react-router-dom';
import { RefreshCwIcon, FileTextIcon, SearchIcon } from 'lucide-react';

const ViewSavedData = () => {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1); // 1-indexed
  const sheetsPerPage = 4;

  const navigate = useNavigate();

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/excel/data');

      if (Array.isArray(response.data)) {
        setSheets(response.data);
      } else {
        setSheets([]);
        setError('Invalid data format received from server');
      }
    } catch (err) {
      setError('Failed to load saved data. Please try again.',err);
      setSheets([]);
    } finally {
      setLoading(false);
    }
  };

  const getTotalElements = () => {
    return sheets.reduce((total, sheet) => total + (sheet.excelElements?.length || 0), 0);
  };

  const getDisplayElements = (sheet) => {
    let elements = [...(sheet.excelElements || [])];

    if (search.trim()) {
      const q = search.toLowerCase();
      elements = elements.filter(el =>
        el.excelElement?.toLowerCase().includes(q) ||
        el.exelCellValue?.toLowerCase().includes(q)
      );
    }

    return elements;
  };

  const totalPages = Math.ceil(sheets.length / sheetsPerPage);
  const startIndex = (currentPage - 1) * sheetsPerPage;
  const currentSheets = sheets.slice(startIndex, startIndex + sheetsPerPage);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="text-center py-20">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading saved data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[84vh] bg-white rounded-2xl shadow-xl flex flex-col relative overflow-hidden">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-white z-30 border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center">
          <button
            onClick={loadSavedData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition shadow-sm"
          >
            <RefreshCwIcon size={16} />
            Refresh
          </button>

          <div className="flex-1 text-center mx-4">
            <h1 className="text-3xl font-bold text-gray-800">Saved Excel Data</h1>
            <p className="text-xs text-gray-500">View & manage your saved configurations</p>
          </div>
          <div className="w-[88px]"></div>
        </div>

        <div className="max-w-6xl mx-auto px-4 pb-3 flex items-center justify-between">
          {sheets.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <div className="bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-xs font-medium border border-blue-200 whitespace-nowrap">
                Sheets: {sheets.length}
              </div>
              <div className="bg-green-50 text-green-800 px-3 py-1 rounded-full text-xs font-medium border border-green-200 whitespace-nowrap">
                Elements: {getTotalElements()}
              </div>
              <div className="bg-purple-50 text-purple-800 px-3 py-1 rounded-full text-xs font-medium border border-purple-200 whitespace-nowrap">
                Avg/Sheet: {Math.round(getTotalElements() / sheets.length) || 0}
              </div>
            </div>
          ) : (
            <div></div>
          )}

          <div className="relative w-56">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search elements..."
              className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition placeholder-gray-400"
            />
          </div>
        </div>

        {error && (
          <div className="max-w-6xl mx-auto px-4 pb-2">
            <div className="bg-red-50 border border-red-300 text-red-700 px-3 py-1.5 rounded-md text-xs">
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto pb-16">
        <div className="max-w-6xl mx-auto p-4">
          {sheets.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 border-2 border-gray-300 border-dashed rounded-xl">
              <FileTextIcon size={48} className="mx-auto mb-3 text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-700">No Saved Data Found</h3>
              <button
                onClick={() => navigate('/')}
                className="px-5 py-2 mt-4 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition shadow"
              >
                Create Excel Configuration
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {currentSheets.map((sheet, index) => (
                <div
                  key={startIndex + index}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition flex flex-col"
                >
                  <div className="px-5 pt-5 pb-3 flex justify-between items-start">
                    <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      {sheet.excellSheetName}
                    </h3>
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full whitespace-nowrap">
                      {getDisplayElements(sheet).length} / {sheet.excelElements?.length || 0}
                      {search.trim() && getDisplayElements(sheet).length !== (sheet.excelElements?.length || 0) && ' filtered'}
                    </span>
                  </div>

                  <div className="px-5 pb-4 overflow-y-auto max-h-80">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-2 py-2 text-left font-medium text-gray-600">Line Item</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-600">Cell Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {getDisplayElements(sheet).length > 0 ? (
                          getDisplayElements(sheet).map((el, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="px-2 py-2 text-gray-800">{el.excelElement}</td>
                              <td className="px-2 py-2 text-gray-600 font-mono">{el.exelCellValue}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="2" className="px-2 py-4 text-center text-gray-500 text-sm">
                              {search.trim() ? "No matching results" : "No elements"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ✅ FLOATING HOVERABLE PAGINATION */}
      {totalPages > 1 && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="inline-flex flex-wrap justify-center items-center gap-1.5
                          bg-white/0 hover:bg-white/80 hover:backdrop-blur-sm
                          border border-gray-200 rounded-xl shadow-md px-3 py-2 transition">

            {/* Previous */}
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-lg border transition ${currentPage === 1
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white/0 text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-400'
                }`}
            >
              Prev
            </button>

            {/* Page Numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3.5 py-1.5 text-sm font-medium rounded-lg border transition ${currentPage === page
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white/0 text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-400'
                  }`}
              >
                {page}
              </button>
            ))}

            {/* Next */}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-lg border transition ${currentPage === totalPages
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : 'bg-white/0 text-gray-700 border-gray-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-400'
                }`}
            >
              Next
            </button>

          </div>
        </div>
      )}

    </div>
  );
};

export default ViewSavedData;
