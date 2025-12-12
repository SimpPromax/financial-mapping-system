import React, { useState, useRef, useEffect } from 'react';
import Swal from 'sweetalert2';
import api from '../../services/api';
import { Upload, FileText, RefreshCw, Trash2, Book, File } from 'lucide-react';

const ExcelDownload = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Load uploaded files on first render
  useEffect(() => {
    loadUploadedFiles();
  }, []);

  // SweetAlert helpers
  const showError = (title, text) => {
    Swal.fire({ icon: 'error', title, text, confirmButtonText: 'OK' });
  };

  const showSuccess = (title, text) => {
    Swal.fire({ icon: 'success', title, text, confirmButtonText: 'OK' });
  };

  // FILE SELECT + DUPLICATE CHECK
  const handleFileSelect = (file) => {
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(fileExt)) {
      showError('Invalid File Type', `"${fileExt}" files are not allowed. Please select an Excel file.`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError('File Too Large', 'Maximum file size is 10MB. Please select a smaller file.');
      return;
    }

    // 🚫 DUPLICATE NAME CHECK
    const fileExists = uploadedFiles.some(
      (uploaded) => uploaded.fileName.toLowerCase() === file.name.toLowerCase()
    );

    if (fileExists) {
      showError(
        'Duplicate File',
        `"${file.name}" already exists. Please rename the file before uploading.`
      );
      return;
    }

    setSelectedFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-green-500', 'bg-green-50');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-green-500', 'bg-green-50');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-green-500', 'bg-green-50');
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileSelect(files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showError('No File Selected', 'Please select an Excel file to upload');
      return;
    }
    setIsLoading(true);

    const formData = new FormData();
    formData.append('excelFile', selectedFile);

    try {
      const response = await api.post('/api/excel/upload', formData);
      showSuccess('Upload Successful', response.data.message);

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      loadUploadedFiles();
    } catch (error) {
      showError('Upload Failed', error.response?.data?.error || error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadUploadedFiles = async () => {
    try {
      const response = await api.get('/api/excel/files');
      setUploadedFiles(response.data);
    } catch (error) {
      showError('Load Failed', error.response?.data?.error || error.message);
    }
  };

  const handleDeleteFile = async (fileName) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `This will permanently delete "${fileName}"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d33',
    });

    if (!result.isConfirmed) return;

    try {
      const response = await api.delete('/api/excel/files', {
        data: { fileName },
        headers: { 'Content-Type': 'application/json' },
      });

      showSuccess('Deleted!', response.data.message || 'File deleted successfully');
      loadUploadedFiles();
    } catch (error) {
      showError('Delete Failed', error.response?.data?.error || error.message);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-green-50 py-6 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
            Excel File Manager
          </h2>
          <p className="text-gray-600 text-sm sm:text-base">
            Upload and manage your Excel files securely
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg overflow-hidden">
          <div className="p-5 sm:p-8">

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-6">
              <button
                className={`flex items-center px-4 py-2 sm:px-6 sm:py-3 font-medium text-sm transition-colors ${activeTab === 'upload'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
                onClick={() => setActiveTab('upload')}
              >
                <Upload size={16} className="mr-2 sm:mr-2" />
                <span className="hidden xs:inline">Upload Excel</span>
                <span className="xs:hidden">Upload</span>
              </button>

              <button
                className={`flex items-center px-4 py-2 sm:px-6 sm:py-3 font-medium text-sm transition-colors ${activeTab === 'view'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                  }`}
                onClick={() => {
                  setActiveTab('view');
                  loadUploadedFiles();
                }}
              >
                <FileText size={16} className="mr-2 sm:mr-2" />
                <span className="hidden xs:inline">View Uploads</span>
                <span className="xs:hidden">Files</span>
              </button>
            </div>

            <div className="min-h-80">
              {/* UPLOAD TAB */}
              {activeTab === 'upload' && (
                <div className="space-y-6">
                  <form onSubmit={handleUpload} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Upload Excel File
                      </label>

                      <div
                        className="border-2 border-dashed border-gray-300 rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-colors hover:border-green-500 hover:bg-green-50"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FileText size={40} className="mx-auto text-green-500 mb-3 sm:mb-4" />

                        <h5 className="text-base sm:text-lg font-medium text-gray-700 mb-2">
                          Drag & Drop Excel File Here
                        </h5>

                        <p className="text-gray-500 mb-3 sm:mb-4 text-sm">or</p>

                        <button
                          type="button"
                          className="px-4 py-1.5 sm:px-6 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Browse Files
                        </button>

                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept=".xlsx,.xls"
                          onChange={(e) => handleFileSelect(e.target.files?.[0])}
                        />

                        {selectedFile && (
                          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center">
                                <FileText size={18} className="text-green-500 mr-2 sm:mr-3" />
                                <div>
                                  <div className="font-medium text-gray-900 text-sm sm:text-base">
                                    {selectedFile.name}
                                  </div>
                                  <div className="text-xs sm:text-sm text-gray-500">
                                    {formatFileSize(selectedFile.size)}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedFile(null);
                                  if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors self-start sm:self-auto"
                              >
                                <Trash2 size={14} className="sm:size-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-center pt-2 sm:pt-4">
                      <button
                        type="submit"
                        disabled={isLoading || !selectedFile}
                        className="w-full sm:w-auto px-6 py-2.5 sm:px-8 sm:py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center mx-auto"
                      >
                        {isLoading ? (
                          <>
                            <RefreshCw size={16} className="animate-spin mr-2" />
                            <span className="text-sm sm:text-base">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={16} className="mr-2" />
                            <span className="text-sm sm:text-base">Upload File</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* VIEW UPLOADS TAB */}
              {activeTab === 'view' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h4 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
                      Uploaded Files
                    </h4>

                    <p className="text-gray-600 mb-4 text-sm sm:text-base">
                      Recently uploaded Excel files
                    </p>

                    <button
                      onClick={loadUploadedFiles}
                      className="px-4 py-1.5 sm:px-6 sm:py-2 text-sm sm:text-base border border-green-600 text-green-600 rounded-full hover:bg-green-50 transition-colors flex items-center mx-auto"
                    >
                      <RefreshCw size={14} className="mr-1 sm:mr-2" />
                      Refresh List
                    </button>
                  </div>

                  {/* MOBILE CARD VIEW */}
                  <div className="lg:hidden space-y-4">
                    {uploadedFiles.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText size={36} className="mx-auto text-gray-400 mb-3" />
                        <p className="text-gray-500 text-sm">No files uploaded yet.</p>
                      </div>
                    ) : (
                      uploadedFiles.map((file) => (
                        <div
                          key={file.id}
                          className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start">
                              {file.isWorkbook ? (
                                <Book size={18} className="text-green-500 mt-0.5 mr-2 shrink-0" />
                              ) : (
                                <File size={18} className="text-blue-500 mt-0.5 mr-2 shrink-0" />
                              )}

                              <div>
                                <div className="font-medium text-gray-900 text-sm">
                                  {file.fileName}
                                </div>

                                <span
                                  className={`inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded-full ${file.isWorkbook
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-blue-100 text-blue-800'
                                    }`}
                                >
                                  {file.isWorkbook ? 'Workbook' : 'Worksheet'}
                                </span>

                                <div className="text-xs text-gray-500 mt-1">
                                  {new Date(file.downloadDate).toLocaleString([], {
                                    year: '2-digit',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteFile(file.fileName)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* DESKTOP TABLE VIEW */}
                  <div className="hidden lg:block">
                    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-x-auto">
                      {uploadedFiles.length === 0 ? (
                        <div className="text-center py-12">
                          <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                          <p className="text-gray-500">No files uploaded yet.</p>
                        </div>
                      ) : (
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 sm:py-4">
                                File Name
                              </th>

                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 sm:py-4">
                                Type
                              </th>

                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 sm:py-4">
                                Upload Date
                              </th>

                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sm:px-6 sm:py-4">
                                Actions
                              </th>
                            </tr>
                          </thead>

                          <tbody className="bg-white divide-y divide-gray-200">
                            {uploadedFiles.map((file) => (
                              <tr key={file.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    {file.isWorkbook ? (
                                      <Book size={20} className="text-green-500 mr-3" />
                                    ) : (
                                      <File size={20} className="text-blue-500 mr-3" />
                                    )}
                                    <span className="text-sm font-medium text-gray-900">
                                      {file.fileName}
                                    </span>
                                  </div>
                                </td>

                                <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                                  <span
                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full sm:px-3 sm:py-1 sm:text-sm ${file.isWorkbook
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-blue-100 text-blue-800'
                                      }`}
                                  >
                                    {file.isWorkbook ? 'Workbook' : 'Worksheet'}
                                  </span>
                                </td>

                                <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap text-sm text-gray-500">
                                  {new Date(file.downloadDate).toLocaleString()}
                                </td>

                                <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                                  <button
                                    onClick={() => handleDeleteFile(file.fileName)}
                                    className="text-red-600 hover:text-red-900 p-1.5 hover:bg-red-50 rounded transition-colors"
                                    title="Delete file"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExcelDownload;
