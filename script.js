const protoEditor = document.getElementById('proto-editor');
const jsonEditor = document.getElementById('json-editor');

const protoStatus = document.getElementById('proto-status');
const jsonStatus = document.getElementById('json-status');

let jsonData = {};
let protoData = "";

// editors
function reload() {
    //status
    protoStatus.classList.remove("bad");
    jsonStatus.classList.remove("bad");

    let jsonText = jsonEditor.textContent;
    let protoText = protoEditor.textContent;

    if (protoText.trim() == "") {
        protoStatus.classList.add("bad");
    }
    if (jsonText.trim() == "") {
        jsonStatus.classList.add("bad");
    }

    try {
        jsonData = JSON.parse(jsonText);
        jsonText = JSON.stringify(jsonData, null, 4);
    } catch (e) {
        console.error(e);
        jsonStatus.classList.add("bad");
    }

    try {
        protoText = formatProto(protoText);
        protoData = protoText;
    } catch (e) {
        console.error(e);
        protoStatus.classList.add("bad");
    }

    if (!jsonStatus.classList.contains("bad")) {
        jsonEditor.innerHTML = highlightJson(jsonText);
    }
    if (!protoStatus.classList.contains("bad")) {
        protoEditor.innerHTML = highlightProto(protoText);
    }
}


function setJson(json) {
    if (typeof json === "string") json = JSON.parse(json);
    jsonEditor.textContent = JSON.stringify(json, null, 4);
}
function setProto(proto) {
    protoEditor.textContent = proto;
}

function formatProto(proto) {
    // remove inline comments
    let lines = proto.split("\n");
    for (let i = 0; i < lines.length; i++) {
        lines[i] = lines[i].split("//")[0];
    }
    proto = lines.join("\n");

    // basic formatting
    proto = proto
        .replaceAll("\t", "    ")
        .replaceAll("\n", "")
        .replaceAll(";", ";\n")
        .replaceAll("{", "\n{\n")
        .replaceAll("}", "\n}\n");

    lines = proto.split("\n");
    
    // remove multiline comments
    let isComment = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("*/")) {
            isComment = false;
            lines[i] = lines[i].split("*/")[1];
        }

        if (isComment) {
            lines[i] = "";
        }

        if (lines[i].includes("/*")) {
            isComment = true;
            lines[i] = lines[i].split("/*")[0];
        }
    }

    // remove empty lines
    proto = lines.filter(l => l.trim() != "").join("\n");

    // spacing
    proto = proto
        .replaceAll("package ", "\npackage ")
        .replaceAll("message ", "\nmessage ")
        .replaceAll("extend ", "\nextend ")
        .replaceAll("enum ", "\nenum ");

    // indentation
    lines = proto.split("\n");
    let indent = 0;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        if (line.includes("}")) {
            indent--;
        }

        lines[i] = "    ".repeat(indent) + line;

        if (line.includes("{")) {
            indent++;
        }
    }
    proto = lines.join("\n");

    return proto;
}

function highlight(string, hex) {
    return `<span style='color: ${hex};'>${string}</span>`
}

function highlightJson(json) {
    json = json
        .replaceAll("{", highlight("{", "#939"))
        .replaceAll("}", highlight("}", "#939"))
        .replaceAll("[", highlight("[", "#399"))
        .replaceAll("]", highlight("]", "#399"))
        .replaceAll("\"", highlight("\"", "#999"));

    return json;
}

function highlightProto(proto) {
    let types = [
        "double",
        "float",
        "uint32",
        "sint32",
        "int32",
        "sfixed32",
        "fixed32",
        "uint64",
        "sint64",
        "int64",
        "sfixed64",
        "fixed64",
        "string",
        "bool",
        "bytes"
    ];
    
    const lines = proto.split("\n");
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.startsWith("message") || line.startsWith("enum")) {
            types.push(line.split(" ")[1]);
        }
    }

    proto = proto
        .replaceAll("{", highlight("{", "#939"))
        .replaceAll("}", highlight("}", "#939"))
        .replaceAll("[", highlight("[", "#399"))
        .replaceAll("]", highlight("]", "#399"))
        .replaceAll("\"", highlight("\"", "#999"))
        .replaceAll("message", highlight("message", "#393"))
        .replaceAll("package", highlight("package", "#933"))
        .replaceAll("syntax", highlight("syntax", "#933"))
        .replaceAll("extend", highlight("extend", "#993"))
        .replaceAll("enum", highlight("enum", "#339"))
        .replaceAll("optional", highlight("optional", "#993"))
        .replaceAll("repeated", highlight("repeated", "#993"))
        .replaceAll("required", highlight("required", "#933"));

    types.forEach(type => {
        proto = proto.replaceAll(type, highlight(type, "#3b7"));
    });
    
    return proto;
}

function getRootType() {
    let rootType = "";

    const lines = formatProto(protoEditor.textContent).split("\n");
    const packageMatches = lines.filter(line => {
        return line.startsWith("package ");
    });
    const messageMatches = lines.filter(line => {
        return line.startsWith("message ");
    });

    if(packageMatches.length) {
        rootType += packageMatches[0].trim().split(" ")[1].replaceAll(";", "");
    }
    if(messageMatches.length) {
        rootType += "."+messageMatches[0].trim().split(" ")[1].replaceAll("{", "");
    }

    return rootType;
}

function downloadEncoded() {
    reload();

    let { root } = protobuf.parse(protoData, { keepCase: true });
    let message = root.lookupType(getRootType());

    let errMsg = message.verify(jsonData);
    if(errMsg) {throw Error(errMsg)};

    let buffer = message.encode(message.fromObject(jsonData)).finish();

    let blob = new Blob([buffer], {type: "application/octet-stream"});

    let link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = (Date.now()).toString()+".data";
    link.click();
}

function loadEncoded(e) {
    if (!e.target.files.length) return;
    const file = e.target.files[0];

    let reader = new FileReader();
    reader.onload = function() {
        let { root } = protobuf.parse(protoData, { keepCase: true });
        let message = root.lookupType(getRootType());

        let decoded = message.decode(new Uint8Array(reader.result));
        let object = message.toObject(decoded);

        setJson(object);
    }
    reader.readAsArrayBuffer(file);
}

// keys
function onEditorKey(e) {
    if (e.code === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
            let selection = window.getSelection();
            let baseAndExtent = [selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset];
            selection.setBaseAndExtent(selection.anchorNode, 0, selection.focusNode, Math.min(4, selection.anchorNode.length));
            let range = selection.getRangeAt(0);
            let text = range.cloneContents().textContent;
            const spaces = 4 - text.slice(0, 4).trimStart().length;
            if (spaces > 0) {
                selection.deleteFromDocument();
                range.insertNode(document.createTextNode(text.slice(spaces)));
                selection = window.getSelection();
                selection.modify("move", "right", "character");
                selection.setBaseAndExtent(selection.anchorNode, Math.max(baseAndExtent[1] - spaces, 0), selection.focusNode, Math.max(baseAndExtent[3] - spaces, 0));
            } else {
                selection.setBaseAndExtent(selection.anchorNode, baseAndExtent[1], selection.focusNode, baseAndExtent[3]);
            }
        } else {
            let selection = window.getSelection();
            selection.collapseToStart();
            let range = selection.getRangeAt(0);
            range.insertNode(document.createTextNode("    "));
            selection.collapseToEnd();
        }
    }
}
jsonEditor.addEventListener("keydown", onEditorKey);
protoEditor.addEventListener("keydown", onEditorKey);

// validation
function validateJson() {
    try {
        JSON.parse(jsonEditor.textContent);

        jsonStatus.classList.remove("bad");
    } catch (e) {
        console.error(e);
        jsonStatus.classList.add("bad");
    }
    validateProto();
}
function validateProto() {
    try {
        let { root } = protobuf.parse(protoEditor.textContent, { keepCase: true });
        let message = root.lookupType(getRootType());

        let errMsg = message.verify(JSON.parse(jsonEditor.textContent));
        if(errMsg) throw Error(errMsg);

        protoStatus.classList.remove("bad");
    } catch (e) {
        console.error(e);
        if (jsonStatus.classList.contains("bad")) {
            protoStatus.classList.remove("bad");
        } else {
            protoStatus.classList.add("bad");
        }
    }
}

const validateConfig = { attributes: true, childList: true, subtree: true };
const jsonObserver = new MutationObserver(validateJson);
jsonObserver.observe(jsonEditor, validateConfig);
const protoObserver = new MutationObserver(validateProto);
protoObserver.observe(protoEditor, validateConfig);
jsonEditor.addEventListener('keyup', validateJson);
protoEditor.addEventListener('keyup', validateProto);

// resize
let isMouseDown = false;
const resizeElement = document.getElementById("resize");
const mainElement = document.getElementById("main");

function mouseDown(e) {
    isMouseDown = true;
}
function mouseUp() {
    isMouseDown = false;
}
function mouseMove(e) {
    if (isMouseDown) {
        const left = Math.min(Math.max(e.clientX - 2.5, window.innerWidth / 5), window.innerWidth / 5 * 4);
        mainElement.style.gridTemplateColumns = `${left}px 5px auto`;
    }
}
function resize() {
    const left = Math.min(Math.max(parseFloat(mainElement.style.gridTemplateColumns.split("px")[0]), window.innerWidth / 5), window.innerWidth / 5 * 4);
    mainElement.style.gridTemplateColumns = `${left}px 5px auto`;
}

resizeElement.addEventListener("mousedown", mouseDown);
document.body.addEventListener("mouseup", mouseUp);
document.body.addEventListener("mousemove", mouseMove);
window.addEventListener("resize", resize);

// buttons
const reloadButton = document.getElementById("btn-reload");
const clearButton = document.getElementById("btn-clear");
const clearProtoButton = document.getElementById("btn-clear-proto");
const clearJsonButton = document.getElementById("btn-clear-json");
const downloadButton = document.getElementById("btn-download");
const loadButton = document.getElementById("btn-load");

const encodedUpload = document.getElementById("encoded-upload");

downloadButton.addEventListener("click", downloadEncoded);
loadButton.addEventListener("click", () => {encodedUpload.click();});
encodedUpload.addEventListener("change", loadEncoded);
reloadButton.addEventListener("click", reload);
clearButton.addEventListener("click", () => {
    protoEditor.innerHTML = "";
    jsonEditor.innerHTML = "";
    reload();
});
clearProtoButton.addEventListener("click", () => {
    protoEditor.innerHTML = "";
    reload();
});
clearJsonButton.addEventListener("click", () => {
    jsonEditor.innerHTML = "";
    reload();
});

// setup
setJson(`{
    "id": 1,
    "name": "test",
    "position": {
        "x": 0.0,
        "y": 1.0,
        "z": 0.0
    },
    "rotation": {
        "x": 0.0,
        "y": 0.0,
        "z": 0.0,
        "w": 1.0
    },
    "color": {
        "r": 0.0,
        "g": 1.0,
        "b": 0.0,
        "a": 1.0
    },
    "children": [
        {
            "id": 2,
            "name": "child",
            "position": {},
            "rotation": {
                "w": 1.0
            },
            "color": {
                "b": 1.0,
                "a": 1.0
            }
        }
    ]
}`);
setProto(`syntax = "proto3";

package TEST.Object;

message Object
{
    uint32 id = 1;
    string name = 2;

    Vector position = 3;
    Quaternion rotation = 4;
    Color color = 5;

    repeated Object children = 6;
}

message Vector
{
    float x = 1;
    float y = 2;
    float z = 3;
}

message Quaternion
{
    float x = 1;
    float y = 2;
    float z = 3;
    float w = 4;
}

message Color
{
    float r = 1;
    float g = 2;
    float b = 3;
    float a = 4;
}`);
reload();