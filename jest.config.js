module.exports = {
    "testPathIgnorePatterns": [
        "/helpers/",
        "/node_modules/"
    ],
    "coveragePathIgnorePatterns": [
        "/node_modules/"
    ],
    "coverageReporters": [
        "lcov",
        "text",
        "clover"
    ],
    "coverageDirectory": "../test-results"
}