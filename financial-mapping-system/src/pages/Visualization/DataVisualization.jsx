// components/DataVisualization.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import api from '../../services/api';
import Swal from 'sweetalert2';
import {
    Play, Save, Trash2, Copy, Eye, Edit2, X, Search,
    RefreshCw, Download, Maximize2, Database,
    BarChart3, LineChart, PieChart, Circle, ScatterChart,
    ChevronLeft, Check, FileText, FolderOpen,
    Settings, Filter, TrendingUp, Shield,
    FileCode, Table, Grid,
    ShieldCheck, Zap, Clock,
    AlertCircle,
    Star as StarIcon
} from 'lucide-react';
import {
    generateChart,
    clearChart,
    exportChartAsSVG,
    exportChartAsPNG
} from '../../utils/VisualizationManager';

// Theme configuration
const THEME = {
    colors: {
        primary: '#3b82f6',
        primaryDark: '#1d4ed8',
        secondary: '#8b5cf6',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#06b6d4',
        light: '#f8fafc',
        dark: '#1e293b',
        gray: {
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            300: '#cbd5e1',
            400: '#94a3b8',
            500: '#64748b',
            600: '#475569',
            700: '#334155',
            800: '#1e293b',
            900: '#0f172a'
        }
    }
};

// Chart types configuration
const chartTypes = [
    { id: 'bar', name: 'Bar Chart', icon: BarChart3, description: 'Compare values across categories' },
    { id: 'line', name: 'Line Chart', icon: LineChart, description: 'Show trends over time/categories' },
    { id: 'pie', name: 'Pie Chart', icon: PieChart, description: 'Show parts of a whole' },
    { id: 'donut', name: 'Donut Chart', icon: Circle, description: 'Pie chart with center hole' },
    { id: 'scatter', name: 'Scatter Plot', icon: ScatterChart, description: 'Show relationships between numeric variables' },
];

// Cache for saved queries (module-level to persist across mounts)
const queryCache = {
    data: null,
    timestamp: 0,
    loading: false,
    CACHE_DURATION: 5 * 60 * 1000 // 5 minutes cache
};

const DataVisualization = () => {
    // State management
    const [activeView, setActiveView] = useState('scripts');
    const [sqlQuery, setSqlQuery] = useState('');
    const [queryData, setQueryData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [columnInfo, setColumnInfo] = useState([]);
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [isValidQuery, setIsValidQuery] = useState(false);
    const [fullscreenChart, setFullscreenChart] = useState(false);
    const [quickSaving, setQuickSaving] = useState(false);
    const [refreshingQueries, setRefreshingQueries] = useState(false);
    // Chart configuration state
    const [chartConfig, setChartConfig] = useState({
        chartType: 'bar',
        xAxis: '',
        yAxis: '',
        sortData: false,
        title: '',
        showLegend: true
    });
    // Saved queries state
    const [savedQueries, setSavedQueries] = useState([]);
    const [editingQuery, setEditingQuery] = useState(null);
    const [creatingNew, setCreatingNew] = useState(false);
    const [savedQueryName, setSavedQueryName] = useState('');
    const [savedQueryDescription, setSavedQueryDescription] = useState('');
    const [querySearch, setQuerySearch] = useState('');
    // Refs for race condition prevention
    const chartRef = useRef(null);
    const fullscreenChartRef = useRef(null);
    const isMountedRef = useRef(true);
    const initialLoadDoneRef = useRef(false);

    // Load saved queries on component mount - Optimized with cache
    useEffect(() => {
        let isActive = true;
        console.log('🚀 Component mounted');
        isMountedRef.current = true;

        const loadInitialQueries = async () => {
            // Check if we already have cached data that's still valid
            const now = Date.now();
            if (queryCache.data && (now - queryCache.timestamp < queryCache.CACHE_DURATION)) {
                console.log('📦 Using cached queries');
                if (isActive) {
                    setSavedQueries(queryCache.data);
                }
                return;
            }

            // Prevent multiple loads
            if (queryCache.loading || refreshingQueries) {
                console.log('⏳ Query load already in progress, skipping...');
                return;
            }

            queryCache.loading = true;
            if (isActive) {
                setRefreshingQueries(true);
            }

            console.log('🔄 Loading saved queries...');

            try {
                const response = await api.get('/api/visualization/queries', {
                    params: { page: 0, size: 50 },
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });

                if (!isActive) {
                    console.log('⚠️ Component unmounted, ignoring response');
                    return;
                }

                console.log('✅ API Response received');

                // Extract queries from response
                let queriesData = [];
                if (response.data?.content && Array.isArray(response.data.content)) {
                    queriesData = response.data.content;
                } else if (Array.isArray(response.data)) {
                    queriesData = response.data;
                } else if (response.data?.savedQueries && Array.isArray(response.data.savedQueries)) {
                    queriesData = response.data.savedQueries;
                }

                // Validate queries
                const validQueries = queriesData.filter(query =>
                    query &&
                    (query.id || query.name) &&
                    query.sql !== undefined
                );

                if (isActive) {
                    setSavedQueries(validQueries);
                    // Update cache
                    queryCache.data = validQueries;
                    queryCache.timestamp = Date.now();
                    console.log(`✅ Loaded ${validQueries.length} saved queries`);
                }
            } catch (error) {
                if (!isActive) return;
                console.error('❌ Failed to load saved queries:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Load Failed',
                    text: `Could not load saved queries: ${error.response?.data?.error || error.message}`,
                    confirmButtonColor: THEME.colors.danger,
                });
                if (isActive) {
                    setSavedQueries([]);
                }
            } finally {
                if (isActive) {
                    setRefreshingQueries(false);
                    queryCache.loading = false;
                    console.log('✅ Finished loading queries');
                }
            }
        };

        // Use setTimeout to prevent double calls in React StrictMode
        const timer = setTimeout(() => {
            if (!initialLoadDoneRef.current) {
                loadInitialQueries();
                initialLoadDoneRef.current = true;
            }
        }, 10);

        return () => {
            console.log('🧹 Component unmounted');
            isActive = false;
            isMountedRef.current = false;
            clearTimeout(timer);
        };
    }, []);

    // Keep chartConfig synchronized when editing query
    useEffect(() => {
        if (editingQuery && activeView === 'scripts') {
            // When we're in SQL Scripts view editing a query,
            // ensure the form shows the correct chart type
            if (editingQuery.chartType && editingQuery.chartType !== chartConfig.chartType) {
                // If the query has a different chartType than current config, update it
                setChartConfig(prev => ({
                    ...prev,
                    chartType: editingQuery.chartType
                }));
            }
        }
    }, [editingQuery, activeView]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F' || e.key === 'f') {
                if (activeView === 'visualization' && isDataLoaded && !loading) {
                    e.preventDefault();
                    setFullscreenChart(prev => !prev);
                }
            }
            if (e.key === 'Escape') {
                setFullscreenChart(false);
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                if (activeView === 'scripts' && sqlQuery.trim()) {
                    e.preventDefault();
                    verifyQuery();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeView, isDataLoaded, loading, sqlQuery]);

    // Verify SQL query
    const verifyQuery = async (query = sqlQuery) => {
        console.log('Verifying query:', { query, type: typeof query });
        if (typeof query !== 'string') {
            Swal.fire({
                icon: 'error',
                title: 'Invalid Query',
                text: 'Query must be a valid SQL string.',
                confirmButtonColor: THEME.colors.danger,
            });
            setIsValidQuery(false);
            return false;
        }
        if (!query.trim()) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Please enter a SQL query',
                confirmButtonColor: THEME.colors.danger,
            });
            return false;
        }
        const trimmedQuery = query.trim().toUpperCase();
        if (!trimmedQuery.startsWith('SELECT')) {
            Swal.fire({
                icon: 'error',
                title: 'Invalid Query',
                text: 'Only SELECT queries are allowed for visualization',
                confirmButtonColor: THEME.colors.danger,
            });
            setIsValidQuery(false);
            return false;
        }
        const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE'];
        const hasDangerous = dangerousKeywords.some(keyword => trimmedQuery.includes(keyword));
        if (hasDangerous) {
            Swal.fire({
                icon: 'error',
                title: 'Security Restriction',
                text: 'Query contains restricted SQL operations. Only SELECT queries are allowed.',
                confirmButtonColor: THEME.colors.danger,
            });
            setIsValidQuery(false);
            return false;
        }
        setVerifying(true);
        setError('');
        try {
            const response = await api.post('/api/visualization/verify', {
                sql: query,
                maxRows: 5,
                chartType: chartConfig.chartType
            });
            const data = response.data;
            if (data.success) {
                setIsValidQuery(true);
                Swal.fire({
                    icon: 'success',
                    title: 'Query Valid!',
                    html: `
                        <div class="text-left">
                            <p class="text-sm text-gray-600 mb-2">✓ Query syntax is valid</p>
                            <p class="text-sm text-gray-600 mb-2">✓ Returns tabular data</p>
                            <p class="text-sm text-gray-600">✓ ${data.rowCount || 0} rows will be fetched</p>
                        </div>
                    `,
                    showConfirmButton: false,
                    timer: 2000,
                    background: '#f0f9ff',
                });
                return true;
            } else {
                setIsValidQuery(false);
                Swal.fire({
                    icon: 'error',
                    title: 'Query Invalid',
                    text: data.error || 'Query verification failed',
                    confirmButtonColor: THEME.colors.danger,
                });
                return false;
            }
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
            setError(errorMsg);
            setIsValidQuery(false);
            Swal.fire({
                icon: 'error',
                title: 'Verification Failed',
                text: `Failed to verify query: ${errorMsg}`,
                confirmButtonColor: THEME.colors.danger,
            });
            return false;
        } finally {
            setVerifying(false);
        }
    };

    // Execute SQL query
    const executeQuery = async (query = sqlQuery, autoNavigate = false) => {
        if (!query.trim()) {
            Swal.fire({
                icon: 'error',
                title: 'Cannot Execute',
                text: 'Please enter a SQL query',
                confirmButtonColor: THEME.colors.danger,
            });
            return false;
        }
        setLoading(true);
        setError('');
        try {
            const response = await api.post('/api/visualization/execute', {
                sql: query,
                maxRows: 1000,
                includeMetadata: true,
                includeData: true,
                chartType: chartConfig.chartType
            });
            const data = response.data;
            if (data.success) {
                setQueryData(data.data || []);
                setColumns(data.columns || []);
                setColumnInfo(data.metadata?.columnInfo || []);
                setIsDataLoaded(true);
                Swal.fire({
                    icon: 'success',
                    title: 'Success!',
                    html: `
                        <div class="text-left">
                            <div class="flex items-center gap-2 mb-2">
                                <Check className="w-5 h-5 text-green-500" />
                                <span class="font-semibold">Query executed successfully!</span>
                            </div>
                            <div class="text-sm text-gray-600 space-y-1">
                                <p>Retrieved: <span class="font-semibold">${data.rowCount || data.data?.length || 0} rows</span></p>
                                <p>Execution time: <span class="font-semibold">${data.executionTime || 0}ms</span></p>
                                <p>Columns: <span class="font-semibold">${data.columns?.length || 0}</span></p>
                            </div>
                        </div>
                    `,
                    showConfirmButton: false,
                    timer: 2000,
                    background: '#f0f9ff',
                });
                autoFillChartConfig(data.metadata?.columnInfo || []);
                if (autoNavigate) {
                    setActiveView('visualization');
                }
                return true;
            } else {
                setError(data.error || 'Query execution failed');
                Swal.fire({
                    icon: 'error',
                    title: 'Query Failed',
                    text: data.error || 'Query execution failed',
                    confirmButtonColor: THEME.colors.danger,
                });
                setIsValidQuery(false);
                return false;
            }
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
            setError(errorMsg);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: `Failed to execute query: ${errorMsg}`,
                confirmButtonColor: THEME.colors.danger,
            });
            setIsValidQuery(false);
            return false;
        } finally {
            setLoading(false);
        }
    };

    // Load visualization data for chart generation
    const loadVisualizationData = async () => {
        if (!sqlQuery.trim()) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Please enter a SQL query',
                confirmButtonColor: THEME.colors.danger,
            });
            return;
        }
        if (!chartConfig.xAxis || !chartConfig.yAxis) {
            Swal.fire({
                icon: 'error',
                title: 'Configuration Required',
                html: `
                    <div class="text-left">
                        <p class="text-sm text-gray-600 mb-2">Please select:</p>
                        <ul class="text-sm text-gray-600 list-disc pl-4 space-y-1">
                            <li>X-axis column</li>
                            <li>Y-axis column</li>
                        </ul>
                    </div>
                `,
                confirmButtonColor: THEME.colors.danger,
                showCancelButton: false,
                timer: 3000
            });
            return;
        }
        setLoading(true);
        try {
            const response = await api.post('/api/visualization/visualization-data', {
                sql: sqlQuery,
                xAxis: chartConfig.xAxis,
                yAxis: chartConfig.yAxis,
                chartType: chartConfig.chartType,
                maxRows: 1000,
                sortData: chartConfig.sortData
            });
            const data = response.data;
            if (data.success) {
                setQueryData(data.data || []);
                const success = generateChart(
                    chartRef.current,
                    data.data,
                    chartConfig.chartType,
                    chartConfig
                );
                if (success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Chart Generated!',
                        html: `
                            <div class="text-left">
                                <div class="flex items-center gap-2 mb-2">
                                    <BarChart3 className="w-5 h-5 text-green-500" />
                                    <span class="font-semibold">Visualization created successfully!</span>
                                </div>
                                <div class="text-sm text-gray-600">
                                    <p>Chart type: <span class="font-semibold">${chartConfig.chartType}</span></p>
                                    <p>Data points: <span class="font-semibold">${data.data?.length || 0}</span></p>
                                </div>
                            </div>
                        `,
                        showConfirmButton: false,
                        timer: 2000,
                        background: '#f0f9ff',
                    });
                } else {
                    throw new Error('Failed to generate chart');
                }
            } else {
                setError(data.error || 'Failed to generate chart');
                Swal.fire({
                    icon: 'error',
                    title: 'Chart Generation Failed',
                    text: data.error || 'Failed to generate chart',
                    confirmButtonColor: THEME.colors.danger,
                });
            }
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
            setError(errorMsg);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: `Failed to load visualization data: ${errorMsg}`,
                confirmButtonColor: THEME.colors.danger,
            });
        } finally {
            setLoading(false);
        }
    };

    // Auto-fill chart configuration
    const autoFillChartConfig = (columnInfo) => {
        if (!columnInfo || columnInfo.length === 0) return;
        const numericColumns = columnInfo.filter(col => col.isNumeric).map(col => col.name);
        const textColumns = columnInfo.filter(col => !col.isNumeric).map(col => col.name);
        let newXAxis = '';
        let newYAxis = '';
        switch (chartConfig.chartType) {
            case 'bar':
            case 'line':
                if (textColumns.length > 0) newXAxis = textColumns[0];
                if (numericColumns.length > 0) newYAxis = numericColumns[0];
                break;
            case 'pie':
            case 'donut':
                if (textColumns.length > 0) newXAxis = textColumns[0];
                if (numericColumns.length > 0) newYAxis = numericColumns[0];
                break;
            case 'scatter':
                if (numericColumns.length > 0) {
                    newXAxis = numericColumns[0];
                    if (numericColumns.length > 1) newYAxis = numericColumns[1];
                }
                break;
        }
        setChartConfig(prev => ({
            ...prev,
            xAxis: newXAxis || prev.xAxis,
            yAxis: newYAxis || prev.yAxis
        }));
    };

    // Load saved queries - Manual refresh function
    const loadSavedQueries = useCallback(async () => {
        if (!isMountedRef.current || refreshingQueries) return;

        console.log('🔄 Manual refresh: Loading saved queries...');
        setRefreshingQueries(true);

        try {
            const response = await api.get('/api/visualization/queries', {
                params: { page: 0, size: 50 },
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            if (!isMountedRef.current) return;
            console.log('✅ API Response received');

            let queriesData = [];
            if (response.data?.content && Array.isArray(response.data.content)) {
                queriesData = response.data.content;
            } else if (Array.isArray(response.data)) {
                queriesData = response.data;
            } else if (response.data?.savedQueries && Array.isArray(response.data.savedQueries)) {
                queriesData = response.data.savedQueries;
            }

            const validQueries = queriesData.filter(query =>
                query &&
                (query.id || query.name) &&
                query.sql !== undefined
            );

            if (isMountedRef.current) {
                setSavedQueries(validQueries);
                queryCache.data = validQueries;
                queryCache.timestamp = Date.now();
                console.log(`✅ Loaded ${validQueries.length} saved queries`);
            }
        } catch (error) {
            if (!isMountedRef.current) return;
            console.error('❌ Failed to load saved queries:', error);
            Swal.fire({
                icon: 'error',
                title: 'Load Failed',
                text: `Could not load saved queries: ${error.response?.data?.error || error.message}`,
                confirmButtonColor: THEME.colors.danger,
            });
            setSavedQueries([]);
        } finally {
            if (isMountedRef.current) {
                setRefreshingQueries(false);
                console.log('✅ Finished loading queries');
            }
        }
    }, [refreshingQueries]);

    // Save SQL Only (Quick Save)
    const saveCurrentSqlOnly = async () => {
        if (!sqlQuery.trim()) return;
        setQuickSaving(true);
        const autoName = `SQL Snippet - ${new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}`;
        try {
            await api.post('/api/visualization/queries/save', {
                name: autoName,
                sql: sqlQuery,
                description: 'Auto-saved SQL snippet',
                chartType: 'bar',
                visualizationConfig: JSON.stringify({
                    chartType: 'bar',
                    xAxis: '',
                    yAxis: '',
                    sortData: false,
                    title: '',
                    showLegend: true
                }),
                isPublic: false,
                isFavorite: false
            });
            Swal.fire({
                icon: 'success',
                title: 'SQL Saved!',
                html: `
                    <div class="text-left">
                        <div class="flex items-center gap-2 mb-2">
                            <Save className="w-5 h-5 text-green-500" />
                            <span class="font-semibold">SQL snippet saved!</span>
                        </div>
                        <p class="text-sm text-gray-600">Saved as: ${autoName}</p>
                    </div>
                `,
                showConfirmButton: false,
                timer: 2000,
                background: '#f0f9ff',
            });
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
            Swal.fire({
                icon: 'error',
                title: 'Save Failed',
                text: `Failed to save SQL: ${errorMsg}`,
                confirmButtonColor: THEME.colors.danger,
            });
        } finally {
            setQuickSaving(false);
        }
    };

    // Save query function (full save)
    const saveQuery = async () => {
        if (!savedQueryName.trim()) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Please enter a name for the query',
                confirmButtonColor: THEME.colors.danger,
            });
            return;
        }
        try {
            await api.post('/api/visualization/queries/save', {
                name: savedQueryName,
                sql: sqlQuery,
                description: savedQueryDescription,
                chartType: chartConfig.chartType,  // Always use current chart type
                visualizationConfig: JSON.stringify(chartConfig),  // Save full config
                isPublic: false,
                isFavorite: false
            });

            Swal.fire({
                icon: 'success',
                title: 'Query Saved!',
                html: `
                    <div class="text-left">
                        <div class="flex items-center gap-2 mb-2">
                            <Save className="w-5 h-5 text-green-500" />
                            <span class="font-semibold">Query ${editingQuery ? 'Updated' : 'Saved'} Successfully!</span>
                        </div>
                        <div class="text-sm text-gray-600">
                            <p>Name: <span class="font-semibold">${savedQueryName}</span></p>
                            <p>Chart type: <span class="font-semibold">${chartConfig.chartType}</span></p>
                        </div>
                    </div>
                `,
                showConfirmButton: false,
                timer: 2000,
                background: '#f0f9ff',
            });

            // Reset form and refresh queries
            setSavedQueryName('');
            setSavedQueryDescription('');
            setEditingQuery(null);
            setCreatingNew(false);

            // Refresh the queries list to show updated label
            await loadSavedQueries();

        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
            Swal.fire({
                icon: 'error',
                title: 'Save Failed',
                text: `Failed to save query: ${errorMsg}`,
                confirmButtonColor: THEME.colors.danger,
            });
        }
    };

    // Load and visualize saved query
    const loadAndVisualizeQuery = async (query) => {
        if (!query || !query.sql || typeof query.sql !== 'string') {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Query SQL is empty or invalid',
                confirmButtonColor: THEME.colors.danger,
            });
            return;
        }
        Swal.fire({
            title: 'Loading Query...',
            html: `
                <div class="text-left">
                    <div class="flex items-center gap-2 mb-2">
                        <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                        <span class="font-semibold">Loading "${query.name}"</span>
                    </div>
                    <p class="text-sm text-gray-600">Verifying and executing query...</p>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        try {
            setSqlQuery(typeof query.sql === 'string' ? query.sql : '');
            if (query.chartType) {
                setChartConfig(prev => ({
                    ...prev,
                    chartType: query.chartType
                }));
            }
            if (query.visualizationConfig) {
                try {
                    const config = JSON.parse(query.visualizationConfig);
                    setChartConfig(prev => ({ ...prev, ...config }));
                } catch (e) {
                    console.error('Failed to parse visualization config:', e);
                }
            }
            const isVerified = await verifyQuery(query.sql);
            if (!isVerified) {
                Swal.fire({
                    icon: 'error',
                    title: 'Verification Failed',
                    text: 'Query verification failed',
                    confirmButtonColor: THEME.colors.danger,
                });
                return;
            }
            const isExecuted = await executeQuery(query.sql, true);
            if (isExecuted) {
                Swal.close();
                Swal.fire({
                    icon: 'success',
                    title: 'Ready to Visualize!',
                    html: `
                        <div class="text-left">
                            <div class="flex items-center gap-2 mb-2">
                                <Check className="w-5 h-5 text-green-500" />
                                <span class="font-semibold">Query loaded successfully!</span>
                            </div>
                            <p class="text-sm text-gray-600">Switching to visualization view...</p>
                        </div>
                    `,
                    showConfirmButton: false,
                    timer: 1500,
                    background: '#f0f9ff',
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Execution Failed',
                    text: 'Failed to execute query',
                    confirmButtonColor: THEME.colors.danger,
                });
            }
        } catch (error) {
            console.error('Error loading query:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: `Failed to load query: ${error.message}`,
                confirmButtonColor: THEME.colors.danger,
            });
        }
    };

    const deleteSavedQuery = async (queryId, queryName) => {
        const result = await Swal.fire({
            title: 'Delete Query?',
            html: `
                <div class="text-left">
                    <div class="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5 text-yellow-500" />
                        <span class="font-semibold">Confirm Deletion</span>
                    </div>
                    <p class="text-sm text-gray-600 mb-2">Are you sure you want to delete <span class="font-semibold">"${queryName}"</span>?</p>
                    <p class="text-xs text-gray-500">This action cannot be undone.</p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: THEME.colors.danger,
            cancelButtonColor: THEME.colors.gray[500],
            confirmButtonText: 'Yes, delete it',
            cancelButtonText: 'Cancel',
            reverseButtons: true
        });
        if (result.isConfirmed) {
            try {
                await api.delete(`/api/visualization/queries/${queryId}`);
                Swal.fire({
                    icon: 'success',
                    title: 'Deleted!',
                    html: `
                        <div class="text-left">
                            <div class="flex items-center gap-2 mb-2">
                                <Trash2 className="w-5 h-5 text-green-500" />
                                <span class="font-semibold">Query deleted successfully!</span>
                            </div>
                            <p class="text-sm text-gray-600">"${queryName}" has been permanently removed.</p>
                        </div>
                    `,
                    showConfirmButton: false,
                    timer: 1500,
                    background: '#f0f9ff',
                });
                // Refresh queries list after deletion
                await loadSavedQueries();
            } catch (error) {
                const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
                Swal.fire({
                    icon: 'error',
                    title: 'Delete Failed',
                    text: `Failed to delete query: ${errorMsg}`,
                    confirmButtonColor: THEME.colors.danger,
                });
            }
        }
    };

    const startEditingQuery = (query) => {
        setEditingQuery(query);
        setCreatingNew(false);
        setSqlQuery(typeof query.sql === 'string' ? query.sql : '');
        setSavedQueryName(query.name || '');
        setSavedQueryDescription(query.description || '');

        // Always parse and set the complete chart config from saved query
        if (query.visualizationConfig) {
            try {
                const config = JSON.parse(query.visualizationConfig);
                setChartConfig({
                    chartType: query.chartType || config.chartType || 'bar',
                    xAxis: config.xAxis || '',
                    yAxis: config.yAxis || '',
                    sortData: config.sortData || false,
                    title: config.title || '',
                    showLegend: config.showLegend !== undefined ? config.showLegend : true
                });
            } catch (e) {
                console.error('Failed to parse visualization config:', e);
                // Fallback to chartType from query
                setChartConfig(prev => ({
                    ...prev,
                    chartType: query.chartType || 'bar'
                }));
            }
        } else if (query.chartType) {
            // If no visualizationConfig but has chartType
            setChartConfig(prev => ({
                ...prev,
                chartType: query.chartType
            }));
        }
    };

    const startCreatingNewQuery = () => {
        setCreatingNew(true);
        setEditingQuery(null);
        setSqlQuery('');
        setSavedQueryName('');
        setSavedQueryDescription('');
        setIsValidQuery(false);
        setChartConfig({
            chartType: 'bar',
            xAxis: '',
            yAxis: '',
            sortData: false,
            title: '',
            showLegend: true
        });
    };

    const cancelEdit = () => {
        setEditingQuery(null);
        setCreatingNew(false);
        setSavedQueryName('');
        setSavedQueryDescription('');
        setIsValidQuery(false);
        // Reset chart config to default
        setChartConfig({
            chartType: 'bar',
            xAxis: '',
            yAxis: '',
            sortData: false,
            title: '',
            showLegend: true
        });
    };

    const getColumnOptions = (requireNumeric = false) => {
        if (!columnInfo || columnInfo.length === 0) {
            return columns.map(col => ({ value: col, label: col }));
        }
        return columnInfo
            .filter(col => requireNumeric ? col.isNumeric : true)
            .map(col => ({
                value: col.name,
                label: `${col.name} (${col.type}${col.isNumeric ? ', numeric' : ''})`
            }));
    };

    const clearAll = () => {
        Swal.fire({
            title: 'Clear Workspace?',
            html: `
                <div class="text-left">
                    <div class="flex items-center gap-2 mb-2">
                        <Trash2 className="w-5 h-5 text-yellow-500" />
                        <span class="font-semibold">Confirm Clear</span>
                    </div>
                    <p class="text-sm text-gray-600 mb-2">This will clear:</p>
                    <ul class="text-sm text-gray-600 list-disc pl-4 space-y-1">
                        <li>Current SQL query</li>
                        <li>Loaded data</li>
                        <li>Chart visualization</li>
                    </ul>
                    <p class="text-xs text-gray-500 mt-3">Saved queries will not be affected.</p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: THEME.colors.danger,
            cancelButtonColor: THEME.colors.gray[500],
            confirmButtonText: 'Clear Everything',
            cancelButtonText: 'Cancel',
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                setSqlQuery('');
                setQueryData([]);
                setColumns([]);
                setColumnInfo([]);
                setError('');
                setIsDataLoaded(false);
                setIsValidQuery(false);
                clearChart(chartRef);
                Swal.fire({
                    icon: 'success',
                    title: 'Cleared!',
                    html: `
                        <div class="text-left">
                            <div class="flex items-center gap-2 mb-2">
                                <Check className="w-5 h-5 text-green-500" />
                                <span class="font-semibold">Workspace cleared!</span>
                            </div>
                            <p class="text-sm text-gray-600">Ready for a new query.</p>
                        </div>
                    `,
                    showConfirmButton: false,
                    timer: 1500,
                    background: '#f0f9ff',
                });
            }
        });
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(sqlQuery);
        Swal.fire({
            icon: 'success',
            title: 'Copied!',
            html: `
                <div class="text-left">
                    <div class="flex items-center gap-2 mb-2">
                        <Copy className="w-5 h-5 text-green-500" />
                        <span class="font-semibold">SQL copied to clipboard!</span>
                    </div>
                    <p class="text-sm text-gray-600">Ready to paste anywhere.</p>
                </div>
            `,
            showConfirmButton: false,
            timer: 1500,
            background: '#f0f9ff',
        });
    };

    // Filter queries with memoization
    const filteredQueries = useMemo(() => {
        if (!Array.isArray(savedQueries) || savedQueries.length === 0) {
            return [];
        }
        if (!querySearch.trim()) {
            return savedQueries;
        }
        const searchTerm = querySearch.toLowerCase();
        return savedQueries.filter(query => {
            if (!query) return false;
            return (
                (query.name && query.name.toLowerCase().includes(searchTerm)) ||
                (query.description && query.description.toLowerCase().includes(searchTerm)) ||
                (query.sql && query.sql.toLowerCase().includes(searchTerm))
            );
        });
    }, [savedQueries, querySearch]);

    const calculateLocalStats = () => {
        if (!queryData.length) return null;
        const totalRecords = queryData.length;
        const yValues = queryData.map(d => {
            const val = d[chartConfig.yAxis];
            return typeof val === 'number' ? val : parseFloat(val) || 0;
        });
        const yTotal = d3.sum(yValues);
        const yAverage = d3.mean(yValues);
        const uniqueXValues = new Set(queryData.map(d => d[chartConfig.xAxis])).size;
        return {
            totalRecords,
            uniqueXValues,
            yTotal,
            yAverage: yAverage || 0
        };
    };

    const localStats = calculateLocalStats();

    const handleExportPNG = () => {
        const container = document.getElementById('chart-container-wrapper');
        if (!container) {
            Swal.fire({
                icon: 'error',
                title: 'Export Error',
                text: 'Chart container not found.',
                confirmButtonColor: THEME.colors.danger,
            });
            return;
        }
        exportChartAsPNG(container, `chart-${chartConfig.chartType}-${Date.now()}.png`);
    };

    const handleExportSVG = () => {
        const container = document.getElementById('chart-container-wrapper');
        if (!container) {
            Swal.fire({
                icon: 'error',
                title: 'Export Error',
                text: 'Chart container not found.',
                confirmButtonColor: THEME.colors.danger,
            });
            return;
        }
        exportChartAsSVG(container, `chart-${chartConfig.chartType}-${Date.now()}.svg`);
    };

    // Render fullscreen chart
    useEffect(() => {
        if (fullscreenChart && fullscreenChartRef.current && queryData.length > 0) {
            generateChart(fullscreenChartRef.current, queryData, chartConfig.chartType, chartConfig);
        }
    }, [fullscreenChart, queryData, chartConfig]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 md:p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 flex items-center gap-3">
                        <Database className="w-10 h-10 text-blue-600" />
                        <span>Data Visualization Studio</span>
                    </h1>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                            SELECT Only
                        </span>
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                            Interactive
                        </span>
                    </div>
                </div>
                <p className="text-gray-600">Create, verify, and visualize SQL queries with professional interactive charts</p>
            </div>
            {/* View Toggle */}
            <div className="mb-8">
                <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
                    <button
                        onClick={() => setActiveView('scripts')}
                        className={`px-6 py-3 rounded-md font-medium transition-all flex items-center gap-2 ${activeView === 'scripts'
                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                    >
                        <FileCode className="w-5 h-5" />
                        SQL Scripts
                    </button>
                    <button
                        onClick={() => setActiveView('visualization')}
                        className={`px-6 py-3 rounded-md font-medium transition-all flex items-center gap-2 ${activeView === 'visualization'
                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                    >
                        <BarChart3 className="w-5 h-5" />
                        Visualization Studio
                    </button>
                </div>
            </div>
            {/* SQL Scripts View */}
            {activeView === 'scripts' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Panel - Query Editor */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                            {/* Editor Header */}
                            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 rounded-lg">
                                            <FileCode className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">
                                                {editingQuery ? `Edit Query: ${savedQueryName}` : creatingNew ? 'Create New Query' : 'SQL Query Editor'}
                                            </h2>
                                            <p className="text-sm text-gray-600">
                                                {editingQuery ? `Editing ${chartConfig.chartType} chart configuration` : 'Write and verify your SQL queries'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={copyToClipboard}
                                            disabled={!sqlQuery.trim()}
                                            className={`p-2.5 rounded-lg transition-all ${!sqlQuery.trim()
                                                ? 'text-gray-300 cursor-not-allowed'
                                                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                                                }`}
                                            title="Copy SQL"
                                        >
                                            <Copy className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={clearAll}
                                            className="p-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Clear workspace"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {/* Editor Content */}
                            <div className="p-6">
                                {/* Query Name & Description */}
                                {(editingQuery || creatingNew) && (
                                    <div className="space-y-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                <FileText className="w-4 h-4" />
                                                Query Name *
                                            </label>
                                            <input
                                                type="text"
                                                value={savedQueryName}
                                                onChange={(e) => setSavedQueryName(e.target.value)}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                                placeholder="Enter a descriptive name"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                <FileText className="w-4 h-4" />
                                                Description
                                            </label>
                                            <textarea
                                                value={savedQueryDescription}
                                                onChange={(e) => setSavedQueryDescription(e.target.value)}
                                                rows={2}
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-all"
                                                placeholder="Describe what this query does..."
                                            />
                                        </div>
                                    </div>
                                )}
                                {/* Query Editor */}
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                                            <Database className="w-4 h-4" />
                                            SQL Query (SELECT only)
                                        </label>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <Shield className="w-4 h-4" />
                                            <span>Read-only operations</span>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <textarea
                                            value={sqlQuery}
                                            onChange={(e) => {
                                                setSqlQuery(e.target.value);
                                                setIsValidQuery(false);
                                            }}
                                            rows={12}
                                            className="w-full px-4 py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm bg-gray-50 resize-none transition-all"
                                            placeholder="SELECT category, SUM(value) FROM sales GROUP BY category ORDER BY SUM(value) DESC"
                                        />
                                        <div className="absolute top-2 right-2 flex items-center gap-2">
                                            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
                                                {sqlQuery.length} chars
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {/* Action Buttons */}
                                <div className="space-y-4">
                                    {/* Verification Step */}
                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="w-5 h-5 text-blue-600" />
                                                <span className="font-semibold text-gray-900">Step 1: Verify Query</span>
                                            </div>
                                            {isValidQuery && (
                                                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full font-medium flex items-center gap-1">
                                                    <Check className="w-3 h-3" />
                                                    Verified
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 mb-3">Verify your SQL query syntax and check for tabular data.</p>
                                        <button
                                            onClick={() => verifyQuery()}
                                            disabled={verifying || !sqlQuery.trim()}
                                            className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 w-full ${verifying || !sqlQuery.trim()
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                                                }`}
                                        >
                                            {verifying ? (
                                                <>
                                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                                    Verifying...
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldCheck className="w-5 h-5" />
                                                    {isValidQuery ? 'Re-verify Query' : 'Verify Query'}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    {/* Execution Step */}
                                    {isValidQuery && (
                                        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <Play className="w-5 h-5 text-green-600" />
                                                    <span className="font-semibold text-gray-900">Step 2: Execute & Visualize</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <button
                                                    onClick={() => executeQuery()}
                                                    disabled={loading || !isValidQuery}
                                                    className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${loading || !isValidQuery
                                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                        : 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]'
                                                        }`}
                                                >
                                                    {loading ? (
                                                        <>
                                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                                            Executing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play className="w-5 h-5" />
                                                            Execute Query
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={saveCurrentSqlOnly}
                                                    disabled={loading || !sqlQuery.trim() || quickSaving}
                                                    className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${loading || !sqlQuery.trim() || quickSaving
                                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
                                                        }`}
                                                >
                                                    {quickSaving ? (
                                                        <>
                                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                                            Saving...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Save className="w-5 h-5" />
                                                            Save SQL Only
                                                        </>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => setActiveView('visualization')}
                                                    disabled={!isDataLoaded}
                                                    className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${!isDataLoaded
                                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                        : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 active:scale-[0.98]'
                                                        }`}
                                                >
                                                    <Eye className="w-5 h-5" />
                                                    View Visualization
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {/* Save/Edit Actions */}
                                    <div className="flex flex-wrap gap-3">
                                        {(editingQuery || creatingNew) ? (
                                            <>
                                                <button
                                                    onClick={saveQuery}
                                                    disabled={!savedQueryName.trim()}
                                                    className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${!savedQueryName.trim()
                                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                        : 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]'
                                                        }`}
                                                >
                                                    <Save className="w-5 h-5" />
                                                    {editingQuery ? 'Update Query' : 'Save Query'}
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="px-6 py-3 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2"
                                                >
                                                    <X className="w-5 h-5" />
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={startCreatingNewQuery}
                                                className="px-6 py-3 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all flex items-center gap-2"
                                            >
                                                <FileCode className="w-5 h-5" />
                                                Create New Query
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Right Panel - Saved Queries */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden h-full">
                            {/* Saved Queries Header */}
                            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 rounded-lg">
                                            <FolderOpen className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">Saved Queries</h2>
                                            <p className="text-sm text-gray-600">Your SQL scripts and visualizations</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={loadSavedQueries}
                                        disabled={refreshingQueries}
                                        className={`p-2 rounded-lg transition-all ${refreshingQueries
                                            ? 'text-gray-400 cursor-not-allowed'
                                            : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 active:scale-95'
                                            }`}
                                        title="Refresh queries"
                                    >
                                        <RefreshCw className={`w-5 h-5 ${refreshingQueries ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={querySearch}
                                        onChange={(e) => setQuerySearch(e.target.value)}
                                        placeholder="Search queries..."
                                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                            {/* Saved Queries List */}
                            <div className="p-4 max-h-[calc(100vh-300px)] overflow-y-auto">
                                {refreshingQueries ? (
                                    <div className="flex flex-col items-center justify-center py-12">
                                        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                                        <p className="text-gray-700 font-medium">Loading saved queries...</p>
                                        <p className="text-sm text-gray-500 mt-2">Fetching your saved SQL queries</p>
                                    </div>
                                ) : filteredQueries.length > 0 ? (
                                    <div className="space-y-3">
                                        {filteredQueries.map((query, index) => {
                                            const createdAt = query.createdAt || query.updatedAt;
                                            const isRecentlySaved = createdAt
                                                ? Date.now() - new Date(createdAt).getTime() < 60000
                                                : false;
                                            return (
                                                <div
                                                    key={query.id || `query-${index}`}
                                                    className={`group p-4 rounded-lg border transition-all ${isRecentlySaved
                                                        ? 'border-green-300 bg-green-50/50'
                                                        : 'border-gray-200 hover:border-blue-300 hover:shadow-md bg-white'}`}
                                                >
                                                    {isRecentlySaved && (
                                                        <div className="mb-3 px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full inline-flex items-center gap-1">
                                                            <StarIcon className="w-3 h-3" />
                                                            Newly Saved
                                                        </div>
                                                    )}
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex items-start gap-3">
                                                            <div className={`p-2 rounded-lg ${isRecentlySaved ? 'bg-green-100' : 'bg-blue-50'}`}>
                                                                <FileCode className={`w-5 h-5 ${isRecentlySaved ? 'text-green-600' : 'text-blue-600'}`} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="font-semibold text-gray-900 truncate">
                                                                    {query.name || 'Unnamed Query'}
                                                                    {isRecentlySaved && (
                                                                        <span className="ml-2 text-xs text-green-600 font-normal">(New)</span>
                                                                    )}
                                                                </h3>
                                                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                                                    {query.description || 'No description provided'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => startEditingQuery(query)}
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Edit query"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => deleteSavedQuery(query.id, query.name)}
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete query"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-gray-500 font-mono bg-gray-50 p-3 rounded-lg overflow-x-auto mb-3">
                                                        {query.sql ? (
                                                            query.sql.length > 100 ? query.sql.substring(0, 100) + '...' : query.sql
                                                        ) : (
                                                            <span className="text-gray-400">No SQL content</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-2 py-1 text-xs rounded-full ${(query.chartType || 'bar') === 'bar' ? 'bg-blue-100 text-blue-800' :
                                                                query.chartType === 'line' ? 'bg-green-100 text-green-800' :
                                                                    query.chartType === 'pie' ? 'bg-purple-100 text-purple-800' :
                                                                        'bg-yellow-100 text-yellow-800'
                                                                }`}>
                                                                {query.chartType || 'bar'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => loadAndVisualizeQuery(query)}
                                                                disabled={!query.sql}
                                                                className={`text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${!query.sql
                                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                    : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90'
                                                                    }`}
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                                Visualize
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500">
                                        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                                            <FolderOpen className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <p className="font-medium text-gray-900 mb-2">No saved queries found</p>
                                        <p className="text-sm text-gray-600">Create your first SQL query to get started!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Visualization Studio View */}
            {activeView === 'visualization' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Panel - Chart Configuration */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                            {/* Configuration Header */}
                            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 rounded-lg">
                                            <Settings className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">Chart Configuration</h2>
                                            <p className="text-sm text-gray-600">Customize your visualization</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setActiveView('scripts')}
                                            className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            Back to Scripts
                                        </button>
                                        {editingQuery && (
                                            <button
                                                onClick={saveQuery}
                                                disabled={!savedQueryName.trim()}
                                                className={`text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${!savedQueryName.trim()
                                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                    : 'bg-green-600 text-white hover:bg-green-700'
                                                    }`}
                                            >
                                                <Save className="w-4 h-4" />
                                                Save Changes
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="p-6">
                                {/* Chart Type Selection */}
                                <div className="mb-8">
                                    <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4" />
                                        Chart Type
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {chartTypes.map(chart => {
                                            const Icon = chart.icon;
                                            return (
                                                <button
                                                    key={chart.id}
                                                    onClick={() => setChartConfig(prev => ({ ...prev, chartType: chart.id }))}
                                                    className={`p-4 rounded-lg border-2 transition-all text-left ${chartConfig.chartType === chart.id
                                                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className={`p-2 rounded-lg ${chartConfig.chartType === chart.id ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                                            <Icon className={`w-5 h-5 ${chartConfig.chartType === chart.id ? 'text-blue-600' : 'text-gray-600'}`} />
                                                        </div>
                                                        <div className="font-medium text-gray-900 text-sm">{chart.name}</div>
                                                    </div>
                                                    <p className="text-xs text-gray-500">{chart.description}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                {isDataLoaded && (
                                    <>
                                        {/* Column Selection */}
                                        <div className="space-y-6 mb-8">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                    <Table className="w-4 h-4" />
                                                    X-Axis ({chartConfig.chartType === 'scatter' ? 'Numeric Value' : 'Category/Text'})
                                                </label>
                                                <select
                                                    value={chartConfig.xAxis}
                                                    onChange={(e) => setChartConfig(prev => ({ ...prev, xAxis: e.target.value }))}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all"
                                                >
                                                    <option value="">Select X-axis column</option>
                                                    {getColumnOptions(chartConfig.chartType === 'scatter').map(col => (
                                                        <option key={col.value} value={col.value}>
                                                            {col.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                    <TrendingUp className="w-4 h-4" />
                                                    Y-Axis (Numeric Value)
                                                </label>
                                                <select
                                                    value={chartConfig.yAxis}
                                                    onChange={(e) => setChartConfig(prev => ({ ...prev, yAxis: e.target.value }))}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all"
                                                >
                                                    <option value="">Select Y-axis column</option>
                                                    {getColumnOptions(true).map(col => (
                                                        <option key={col.value} value={col.value}>
                                                            {col.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                    <FileText className="w-4 h-4" />
                                                    Chart Title
                                                </label>
                                                <input
                                                    type="text"
                                                    value={chartConfig.title}
                                                    onChange={(e) => setChartConfig(prev => ({ ...prev, title: e.target.value }))}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                                    placeholder="Enter chart title"
                                                />
                                            </div>
                                        </div>
                                        {/* Chart Options */}
                                        <div className="space-y-4 mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                            <label className="flex items-center justify-between cursor-pointer">
                                                <div className="flex items-center gap-3">
                                                    <Filter className="w-4 h-4 text-gray-600" />
                                                    <span className="text-sm text-gray-700">Sort data by value</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={chartConfig.sortData}
                                                    onChange={(e) => setChartConfig(prev => ({ ...prev, sortData: e.target.checked }))}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                            </label>
                                            <label className="flex items-center justify-between cursor-pointer">
                                                <div className="flex items-center gap-3">
                                                    <Grid className="w-4 h-4 text-gray-600" />
                                                    <span className="text-sm text-gray-700">Show legend</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={chartConfig.showLegend}
                                                    onChange={(e) => setChartConfig(prev => ({ ...prev, showLegend: e.target.checked }))}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                            </label>
                                        </div>
                                        {/* Generate Chart Button */}
                                        <button
                                            onClick={loadVisualizationData}
                                            disabled={!chartConfig.xAxis || !chartConfig.yAxis}
                                            className={`w-full px-4 py-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${!chartConfig.xAxis || !chartConfig.yAxis
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 active:scale-[0.98] shadow-md'
                                                }`}
                                        >
                                            <Zap className="w-5 h-5" />
                                            Generate Chart
                                        </button>
                                    </>
                                )}
                                {/* Column Preview */}
                                {columnInfo.length > 0 && (
                                    <div className="mt-8 pt-8 border-t border-gray-200">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <Database className="w-5 h-5" />
                                            Detected Columns
                                        </h3>
                                        <div className="space-y-2">
                                            {columnInfo.map(col => (
                                                <div key={col.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                                    <div>
                                                        <div className="font-medium text-gray-900 text-sm">{col.name}</div>
                                                        <div className="text-xs text-gray-500">{col.type}</div>
                                                    </div>
                                                    <span className={`px-2 py-1 text-xs rounded-full ${col.isNumeric
                                                        ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                                        : 'bg-green-100 text-green-800 border border-green-200'
                                                        }`}>
                                                        {col.isNumeric ? 'Numeric' : 'Text'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* Data Summary */}
                                {isDataLoaded && localStats && (
                                    <div className="mt-8 pt-8 border-t border-gray-200">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                            <BarChart3 className="w-5 h-5" />
                                            Data Summary
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-3 bg-gray-50 rounded-lg">
                                                <div className="text-xs text-gray-600 mb-1">Total Records</div>
                                                <div className="font-bold text-gray-900">{localStats.totalRecords}</div>
                                            </div>
                                            <div className="p-3 bg-gray-50 rounded-lg">
                                                <div className="text-xs text-gray-600 mb-1">Unique X Values</div>
                                                <div className="font-bold text-green-600">{localStats.uniqueXValues}</div>
                                            </div>
                                            <div className="p-3 bg-gray-50 rounded-lg">
                                                <div className="text-xs text-gray-600 mb-1">Y-Axis Total</div>
                                                <div className="font-bold text-blue-600">{d3.format(',.0f')(localStats.yTotal)}</div>
                                            </div>
                                            <div className="p-3 bg-gray-50 rounded-lg">
                                                <div className="text-xs text-gray-600 mb-1">Y-Axis Average</div>
                                                <div className="font-bold text-purple-600">{d3.format(',.2f')(localStats.yAverage)}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Right Panel - Chart Visualization */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden h-full">
                            {/* Visualization Header */}
                            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 rounded-lg">
                                            <Eye className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-900">Visualization</h2>
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                {isDataLoaded && (
                                                    <>
                                                        <span className="flex items-center gap-1">
                                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                            {queryData.length} data points
                                                        </span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <BarChart3 className="w-4 h-4" />
                                                            {chartConfig.chartType} chart
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {isDataLoaded && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setFullscreenChart(true)}
                                                className="px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                <Maximize2 className="w-4 h-4" />
                                                Fullscreen (F)
                                            </button>
                                            <button
                                                onClick={handleExportPNG}
                                                className="px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors flex items-center gap-2"
                                            >
                                                <Download className="w-4 h-4" />
                                                Export
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Chart Display Area */}
                            <div className="p-6">
                                <div className="relative min-h-[500px] rounded-lg border-2 border-gray-100 bg-gray-50">
                                    <div ref={chartRef} id="chart-container-wrapper" className="chart-container" />
                                    {/* Empty State */}
                                    {!isDataLoaded && !loading && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                            <div className="w-24 h-24 mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                                                <BarChart3 className="w-12 h-12 text-blue-400" />
                                            </div>
                                            <h3 className="text-xl font-semibold text-gray-500 mb-2">No Data to Visualize</h3>
                                            <p className="text-gray-400 text-center max-w-md mb-6">
                                                Execute a SQL query to see beautiful visualizations here.
                                            </p>
                                            <button
                                                onClick={() => setActiveView('scripts')}
                                                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:opacity-90 transition-all flex items-center gap-2"
                                            >
                                                <ChevronLeft className="w-5 h-5" />
                                                Go to SQL Scripts
                                            </button>
                                        </div>
                                    )}
                                    {/* Loading State */}
                                    {loading && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-lg">
                                            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                                            <p className="text-gray-700 font-medium">Generating visualization...</p>
                                            <p className="text-sm text-gray-500 mt-2">Creating {chartConfig.chartType} chart</p>
                                        </div>
                                    )}
                                </div>
                                {/* Current Query Preview */}
                                {sqlQuery && (
                                    <div className="mt-8">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                                <FileCode className="w-5 h-5" />
                                                Current Query
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={copyToClipboard}
                                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Copy SQL"
                                                >
                                                    <Copy className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => setActiveView('scripts')}
                                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Edit query"
                                                >
                                                    <Edit2 className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => setFullscreenChart(true)}
                                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="View in fullscreen"
                                                >
                                                    <Maximize2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-gray-100 overflow-x-auto">
                                            <pre className="whitespace-pre-wrap">{sqlQuery}</pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Fullscreen Chart Modal */}
            {fullscreenChart && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/20 backdrop-blur-md">
                    <div className="relative w-full max-w-7xl max-h-[95vh] bg-white/80 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border border-white/30">
                        {/* Fullscreen Header */}
                        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Maximize2 className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">Fullscreen Visualization</h3>
                                    <p className="text-sm text-gray-600">{chartConfig.title || `${chartConfig.yAxis} by ${chartConfig.xAxis}`}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleExportPNG}
                                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    PNG
                                </button>
                                <button
                                    onClick={handleExportSVG}
                                    className="px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    SVG
                                </button>
                                <button
                                    onClick={() => setFullscreenChart(false)}
                                    className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <X className="w-5 h-5" />
                                    Close (Esc)
                                </button>
                            </div>
                        </div>
                        {/* Fullscreen Chart Content */}
                        <div className="p-6 h-[80vh] overflow-auto">
                            <div
                                ref={fullscreenChartRef}
                                className="w-full h-full min-h-[600px]"
                            />
                        </div>
                        {/* Fullscreen Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                            <div className="flex items-center justify-between text-sm text-gray-600">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <Database className="w-4 h-4" />
                                        <span>{queryData.length} data points</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4" />
                                        <span>{chartConfig.chartType} chart</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        <span>Generated just now</span>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-500">
                                    Press <kbd className="px-2 py-1 bg-gray-200 rounded">Esc</kbd> to exit fullscreen
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Footer */}
            <div className="mt-8 pt-8 border-t border-gray-200">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-600">
                        <p className="font-medium text-gray-900 mb-1">Data Visualization Studio</p>
                        <p className="text-gray-500">Professional SQL query visualization • Read-only operations</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            <span>SELECT queries only</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            <span>Interactive charts</span>
                        </div>
                        {activeView === 'visualization' && isDataLoaded && (
                            <div className="flex items-center gap-2 text-blue-600 font-medium">
                                <Maximize2 className="w-4 h-4" />
                                <span>Press <kbd className="px-2 py-1 bg-blue-100 rounded">F</kbd> for fullscreen</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DataVisualization;