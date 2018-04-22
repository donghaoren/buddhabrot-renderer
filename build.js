let multirun = require("multirun");
let COMMANDS = {
    ts: "tsc -p .",
    webpack: "webpack",
    uglify: "uglifyjs dist/bundle.js -o dist/bundle.min.js",
    watch: [
        "tsc -p . -w",
        "webpack -w",
        "http-server -p 8000"
    ],
    deploy: () => multirun.sequence([
        "rm -rf deploy",
        "mkdir -p deploy",
        "cp node_modules/antd/dist/antd.min.css deploy/antd.min.css",
        "cp node_modules/react/umd/react.production.min.js deploy/react.min.js",
        "cp node_modules/react-dom/umd/react-dom.production.min.js deploy/react-dom.min.js",
        "cp dist/bundle.min.js deploy/scripts.min.js",
        "cp css/style.css deploy/style.css",
        "cp index-deploy.html deploy/index.html"
    ])
};
let sequence = process.argv.slice(2);
if (sequence.length == 0) {
    sequence = ["ts", "webpack", "uglify", "deploy"];
}
multirun.runCommands(COMMANDS, sequence, "Build");
