const LANGUAGE = "image-grid-captions";
const PREFIX = "Image Grid Captions Error:\n";
function errorText(error) {
    return PREFIX + (error instanceof Error ? error.message : String(error));
}
// Only a leading H2/H3 marker is interpreted; all other content stays literal.
function parseCaption(value) {
    if (/^\\#{2,3}[ \t]+\S/.test(value)) return { text: value.slice(1), headingLevel: null };
    const match = /^(#{2,3})[ \t]+(\S.*)$/.exec(value);
    return match
        ? { text: match[2], headingLevel: match[1].length }
        : { text: value, headingLevel: null };
}
function parseCaptionBlocks(value) {
    const blocks = [];
    let paragraph = [];
    const flush = () => {
        if (paragraph.length) blocks.push({ text: paragraph.join("\n"), headingLevel: null });
        paragraph = [];
    };
    for (const raw of value.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) { flush(); continue; }
        const parsed = parseCaption(line);
        if (parsed.headingLevel) { flush(); blocks.push(parsed); }
        else paragraph.push(parsed.text);
    }
    flush();
    return blocks;
}
function parseGrid(source) {
    const params = new Map();
    const images = [];
    const lines = source.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        if (line.startsWith("![[")) {
            if (!line.endsWith("]]")) {
                if (!line.includes("|")) throw new Error("A multiline image caption must start with ![[path|.");
                while (!line.endsWith("]]")) {
                    if (++i >= lines.length || lines[i].trim().startsWith("![[")) throw new Error("Unclosed image caption: expected ]].");
                    line += "\n" + lines[i].trim();
                }
            }
            const parts = line.slice(3, -2).split("|");
            if (parts.length > 2) throw new Error("Additional image parameters are not supported.");
            const path = parts[0].trim();
            const caption = parts[1]?.trim() ?? "";
            if (!path || /[:#?\[\]\\\r\n]/.test(path) || path.startsWith("/") || !/\.(png|jpe?g|webp|gif|bmp|avif|svg)$/i.test(path)) {
                throw new Error(`Unsupported local image path: ${path}`);
            }
            images.push({
                path,
                caption,
                alt: parseCaptionBlocks(caption).map(block => block.text.replace(/\n/g, " ")).join(" ") || path.split("/").pop()
            });
            continue;
        }
        const colon = line.indexOf(":");
        if (colon < 0) throw new Error(`Invalid line: ${line}`);
        const key = line.slice(0, colon).trim();
        if (key !== "columns" && key !== "gap") throw new Error(`Unknown parameter: ${key}`);
        if (params.has(key)) throw new Error(`Duplicate parameter: ${key}`);
        params.set(key, line.slice(colon + 1).trim());
    }
    if (!params.has("columns")) throw new Error("columns is required.");
    const columns = params.get("columns");
    if (!/^[234]$/.test(columns)) throw new Error("columns must be 2, 3, or 4.");
    const gap = params.get("gap") ?? "8";
    if (!/^\d+$/.test(gap) || !Number.isSafeInteger(Number(gap))) throw new Error("gap must be a non-negative safe integer.");
    if (images.length !== Number(columns)) throw new Error(`columns is ${columns}, but ${images.length} images were found.`);
    return {
        columns: Number(columns),
        gap: Number(gap),
        images
    };
}
module.exports = {
    LANGUAGE,
    PREFIX,
    errorText,
    parseCaption,
    parseCaptionBlocks,
    parseGrid
};
