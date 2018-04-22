let path = require("path");
module.exports = {
    entry: "./dist/index.js",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "bundle.js"
    },
    externals: {
        "react": "React",
        "react-dom": "ReactDOM",
        "fs": "NODE_fs",
        "child_process": "NODE_child_process"
    }
};
