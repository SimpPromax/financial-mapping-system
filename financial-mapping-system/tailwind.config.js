// tailwind.config.js
module.exports = {
    theme: {
        extend: {
            animation: {
                fadeIn: "fadeIn 0.3s ease-in-out",
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: 0, transform: "translateY(-10px)" },
                    "100%": { opacity: 1, transform: "translateY(0)" },
                },
            },
        },
    },
    plugins: [
        function ({ addUtilities }) {
            addUtilities({
                '.scrollbar-hide': {
                    /* IE and Edge */
                    '-ms-overflow-style': 'none',
                    /* Firefox */
                    'scrollbar-width': 'none',
                    /* Safari and Chrome */
                    '&::-webkit-scrollbar': {
                        display: 'none'
                    }
                },
                '.scrollbar-thin': {
                    /* Firefox */
                    'scrollbar-width': 'thin',
                    /* Safari and Chrome */
                    '&::-webkit-scrollbar': {
                        width: '6px',
                        height: '6px'
                    }
                },
                '.scrollbar-thumb-gray-300': {
                    /* Safari and Chrome */
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: '#d1d5db',
                        borderRadius: '3px'
                    }
                },
                '.scrollbar-thumb-gray-700': {
                    /* Safari and Chrome */
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: '#374151',
                        borderRadius: '3px'
                    }
                },
                '.scrollbar-track-gray-100': {
                    /* Safari and Chrome */
                    '&::-webkit-scrollbar-track': {
                        backgroundColor: '#f3f4f6'
                    }
                },
                '.scrollbar-track-gray-900': {
                    /* Safari and Chrome */
                    '&::-webkit-scrollbar-track': {
                        backgroundColor: '#111827'
                    }
                },
                '.wrap-break-word': {
                    'overflow-wrap': 'break-word',
                    'word-wrap': 'break-word',
                    'word-break': 'break-word'
                }
            })
        }
    ]
};