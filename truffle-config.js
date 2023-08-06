module.exports = {
    contracts_directory: "./contracts/**/*.sol",

    networks: {
        ganache: {
            host: "127.0.0.1",
            port: 7545,
            network_id: 5777,
        },
    },

    plugins: ["eth-gas-reporter"],

    mocha: {
        reporter: "eth-gas-reporter",
        reporterOptions: {
            currency: "USD", // Shows gas prices in USD
            gasPrice: 21, // Default gas price in gwei
        },
    },

    compilers: {
        solc: {
            version: "pragma",
        },
    },
};
