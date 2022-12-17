module.exports = {
    contracts_directory: "./contracts/**/*.sol",

    networks: {
        ganache: {
            host: "127.0.0.1",
            port: 7545,
            network_id: 5777,
        },
    },

    mocha: {},

    compilers: {
        solc: {
            version: "pragma",
        },
    },
};
