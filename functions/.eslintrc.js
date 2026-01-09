/* eslint-env node */
module.exports = {
    root: true,
    env: {
        es6: true,
        node: true,
    },
    extends: [
        "eslint:recommended",
        "google",
    ],
    rules: {
        "quotes": ["error", "double"],
        "max-len": 0,
        "object-curly-spacing": 0,
        "indent": 0
    },
};
